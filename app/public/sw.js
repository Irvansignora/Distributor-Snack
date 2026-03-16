// ─────────────────────────────────────────────────────────────────────────────
// SnackHub Service Worker
//
// Strategi cache yang benar untuk Vite + Vercel:
//
//   /index.html          → NETWORK FIRST (selalu fresh, jangan pernah stale)
//   /assets/*.js|css     → CACHE FIRST tapi validasi 404 — kalau asset lama
//                          sudah tidak ada di server (hash berubah setelah
//                          deploy baru), hapus cache dan fetch ulang dari network
//   /manifest.json, icon → STALE WHILE REVALIDATE (jarang berubah, boleh stale)
//   /api/*               → BYPASS (tidak pernah di-cache)
//   external origin      → BYPASS
//
// Kenapa crash sebelumnya:
//   - SW menyimpan index.html lama yang referensi /assets/index-OldHash.js
//   - Setelah deploy baru, file dengan hash lama sudah tidak ada → 404
//   - Browser crash karena SW serve index.html stale dari cache
// ─────────────────────────────────────────────────────────────────────────────

// PENTING: Ganti angka ini setiap deploy baru agar SW lama langsung mati.
// Di pipeline CI/CD bisa di-inject otomatis via sed atau vite plugin.
const CACHE_VERSION = 'snackhub-v__BUILD_TIMESTAMP__';

// Cache untuk asset statis (icon, manifest) — jarang berubah
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
// Cache untuk Vite asset bundles — TIDAK di-preload, hanya disimpan saat pertama kali diakses
const ASSETS_CACHE  = `${CACHE_VERSION}-assets`;

// Asset statis ringan yang boleh di-preload saat install
const PRECACHE_URLS = [
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      // skipWaiting: SW baru langsung aktif, tidak tunggu tab lama ditutup
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()) // tetap lanjut walau precache gagal
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          // Hapus SEMUA cache yang bukan versi saat ini
          .filter((key) => key !== STATIC_CACHE && key !== ASSETS_CACHE)
          .map((key) => caches.delete(key))
      ))
      // clients.claim: SW langsung kontrol semua tab yang terbuka
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Hanya handle GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Bypass: API requests
  if (url.pathname.startsWith('/api/')) return;

  // Bypass: request ke domain lain (Cloudinary, Supabase, dll)
  if (url.origin !== self.location.origin) return;

  // ── Strategi 1: index.html → NETWORK FIRST ─────────────────────────────
  // index.html TIDAK PERNAH di-cache. Selalu fetch dari network.
  // Kalau offline, baru fallback ke cache (agar app tetap bisa dibuka).
  if (url.pathname === '/' || url.pathname === '/index.html' || !url.pathname.includes('.')) {
    event.respondWith(networkFirstHTML(request));
    return;
  }

  // ── Strategi 2: /assets/*.js|css → CACHE FIRST dengan validasi 404 ─────
  // Vite menghasilkan nama file dengan content hash (misal index-A1b2C3.js).
  // Kalau file di-cache tapi sudah tidak ada di server (deploy baru),
  // hapus cache entry dan fetch ulang.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirstWithFallback(request));
    return;
  }

  // ── Strategi 3: asset statis lain → STALE WHILE REVALIDATE ─────────────
  event.respondWith(staleWhileRevalidate(request));
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * NETWORK FIRST untuk index.html:
 * 1. Coba fetch dari network
 * 2. Kalau sukses → simpan ke cache, return response
 * 3. Kalau offline/gagal → fallback ke cache
 */
async function networkFirstHTML(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = await caches.match(request)
      || await caches.match('/index.html')
      || await caches.match('/');
    if (cached) return cached;
    // Kalau benar-benar offline dan tidak ada cache sama sekali
    return new Response('<h1>Offline</h1><p>Periksa koneksi internet Anda.</p>', {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

/**
 * CACHE FIRST dengan validasi 404 untuk /assets/*:
 * 1. Cek cache — kalau ada, return dari cache
 * 2. Kalau tidak ada, fetch dari network → simpan ke cache
 * 3. Kalau network return 404 (asset lama setelah deploy baru):
 *    → Hapus semua cache /assets/ yang stale
 *    → Paksa reload semua client agar pakai SW + index.html baru
 */
async function cacheFirstWithFallback(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.status === 404) {
      // Asset tidak ditemukan = deploy baru dengan hash berbeda
      // Bersihkan cache assets lama dan minta semua tab reload
      await clearAssetsCache();
      notifyClientsToReload();
      // Kembalikan 404 agar browser tidak stuck
      return networkResponse;
    }

    if (networkResponse.ok) {
      const cache = await caches.open(ASSETS_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch {
    // Offline dan tidak ada cache → kembalikan response kosong
    return new Response('', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * STALE WHILE REVALIDATE untuk asset statis (icon, manifest):
 * Return cache dulu (cepat), update cache di background.
 */
async function staleWhileRevalidate(request) {
  const cache  = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => cached);

  return cached || fetchPromise;
}

/**
 * Hapus semua cache entry di ASSETS_CACHE.
 * Dipanggil saat deteksi deploy baru (asset 404).
 */
async function clearAssetsCache() {
  await caches.delete(ASSETS_CACHE);
  // Hapus juga versi cache lama (dari CACHE_VERSION berbeda)
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((k) => k.includes('-assets') && k !== ASSETS_CACHE)
      .map((k) => caches.delete(k))
  );
}

/**
 * Kirim pesan ke semua tab yang terbuka agar reload halaman.
 * Tab menerima event ini dan bisa tampilkan toast "Update tersedia, reload otomatis."
 */
function notifyClientsToReload() {
  self.clients.matchAll({ type: 'window' }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'SW_CACHE_CLEARED', action: 'reload' });
    });
  });
}

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  const options = {
    body: event.data?.text() || 'Ada notifikasi baru dari SnackHub',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: { url: self.location.origin },
    actions: [
      { action: 'open',  title: 'Buka' },
      { action: 'close', title: 'Tutup' },
    ],
  };
  event.waitUntil(
    self.registration.showNotification('SnackHub', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow(event.notification.data?.url || '/')
    );
  }
});

// ── Background Sync ───────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(Promise.resolve()); // placeholder
  }
});
