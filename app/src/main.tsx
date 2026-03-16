import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// ── Service Worker registration ───────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      console.log('SW registered:', registration.scope);
    }).catch((err) => {
      console.warn('SW registration failed:', err);
    });

    // Terima pesan dari SW: kalau SW detect deploy baru (asset 404),
    // SW kirim { type: 'SW_CACHE_CLEARED', action: 'reload' }
    // → reload halaman agar ambil index.html + asset bundle terbaru
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_CACHE_CLEARED' && event.data?.action === 'reload') {
        console.log('[SW] Cache lama dibersihkan, reload halaman...');
        window.location.reload();
      }
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
