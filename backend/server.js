import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { body, validationResult } from 'express-validator';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();

// Cloudinary config (untuk foto produk)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
const app = express();
const PORT = process.env.PORT || 3001;

// ── CORS ─────────────────────────────────────────────────────────────────────
// Approach: set headers UNCONDITIONALLY on every response, termasuk error responses.
// Ini penting di Vercel karena serverless function bisa return error sebelum
// Express middleware sempat jalan.

function setCorsHeaders(res, origin) {
  const isAllowed =
    !origin ||
    /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
    /^https:\/\/[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9-]+)*\.vercel\.app$/.test(origin) ||
    origin === (process.env.FRONTEND_URL || '');

  res.setHeader('Access-Control-Allow-Origin',      isAllowed ? (origin || '*') : 'https://distributor-snack.vercel.app');
  res.setHeader('Access-Control-Allow-Methods',     'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',     'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age',           '86400');
  res.setHeader('Vary', 'Origin');
}

// Middleware #1 — CORS, dipasang sebelum SEMUA middleware lain termasuk express.json()
app.use((req, res, next) => {
  setCorsHeaders(res, req.headers.origin);
  if (req.method === 'OPTIONS') {
    return res.status(200).end(); // 200 bukan 204 — lebih compatible dengan Vercel
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Backend pakai service_role key agar bisa bypass RLS
// JANGAN expose key ini ke frontend
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
const JWT_SECRET = process.env.JWT_SECRET;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ['image/jpeg','image/png','image/webp','application/pdf'].includes(file.mimetype)),
});

// ════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ════════════════════════════════════════════════════════════════

const authenticateToken = async (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Alias
const auth = authenticateToken;

const requireRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) return res.status(403).json({ error: 'Insufficient permissions' });
  next();
};

// Alias
const role = (...roles) => requireRole(roles);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════

// Upload dokumen & bukti bayar → Supabase Storage
async function uploadFile(buffer, mimetype, bucket, filename) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filename, buffer, { contentType: mimetype, upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return publicUrl;
}

// Upload foto produk → Cloudinary
async function uploadProductImage(buffer, mimetype, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'snackhub/products',
        public_id: publicId,
        overwrite: true,
        resource_type: 'image',
        transformation: [
          { width: 800, height: 800, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

async function sendWhatsApp(phone, message, storeId = null) {
  try {
    const { data: setting } = await supabase.from('settings').select('value').eq('key', 'wa_provider').single();
    if (!setting?.value?.enabled) return;
    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { 'Authorization': process.env.FONNTE_TOKEN },
      body: JSON.stringify({ target: phone, message }),
    });
    await supabase.from('wa_message_log').insert({
      store_id: storeId, phone_number: phone,
      message_body: message, provider: 'fonnte',
      status: res.ok ? 'sent' : 'failed',
    });
  } catch (e) { console.error('WA error:', e.message); }
}

async function createNotification(userId, type, title, message, data = {}) {
  await supabase.from('notifications').insert({ user_id: userId, type, title, message, data });
}

// ════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════

app.post('/api/auth/register',
  [body('email').isEmail().normalizeEmail(), body('password').isLength({ min: 6 }), body('name').trim().notEmpty()],
  validate,
  async (req, res) => {
    try {
      const { email, password, name, phone, company_name } = req.body;

      // FIX-11a: normalize email
      const normalizedEmail = email.toString().trim().toLowerCase();

      // FIX-11b: fail fast jika JWT_SECRET tidak ada
      if (!JWT_SECRET) {
        console.error('FATAL: JWT_SECRET env variable is not set');
        return res.status(500).json({ error: 'Konfigurasi server bermasalah, hubungi admin' });
      }

      // FIX-11c: cek duplikat dengan normalizedEmail
      const { data: existing, error: checkError } = await supabase
        .from('users').select('id').eq('email', normalizedEmail).single();
      // PGRST116 = no rows found → berarti email belum terdaftar (oke)
      if (checkError && checkError.code !== 'PGRST116') throw checkError;
      if (existing) return res.status(409).json({ error: 'Email sudah terdaftar' });

      const hashedPassword = await bcrypt.hash(password, 12);
      const { data: user, error } = await supabase
        .from('users')
        .insert({ email: normalizedEmail, password: hashedPassword, name, phone, role: 'customer' })
        .select()
        .single();
      if (error) throw error;

      // Auto-create store profile — langsung approved, tidak perlu onboarding
      const { data: store } = await supabase.from('customer_stores').insert({
        user_id: user.id,
        store_name: company_name || name,
        owner_name: name,
        status: 'approved',
        tier: 'reseller',
      }).select().single();

      // Notify admins
      const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
      for (const admin of admins || []) {
        await createNotification(admin.id, 'new_store_registration',
          'Pendaftaran Toko Baru', `${name} baru saja mendaftar`, { user_id: user.id });
      }

      const token = jwt.sign({ id: user.id, userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      // FIX-11d: sertakan store dalam response (sama seperti login)
      res.status(201).json({
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        store: store || null,
      });
    } catch (e) {
      console.error('Register error:', e);
      res.status(500).json({ error: e.message || 'Registration failed' });
    }
  }
);

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'Email dan password wajib diisi' });

    // FIX-10a: normalize email (lowercase + trim) agar tidak case-sensitive
    const normalizedEmail = email.toString().trim().toLowerCase();

    // FIX-10b: pastikan JWT_SECRET ada sebelum query DB (fail fast)
    if (!JWT_SECRET) {
      console.error('FATAL: JWT_SECRET env variable is not set');
      return res.status(500).json({ error: 'Konfigurasi server bermasalah, hubungi admin' });
    }

    const { data: user, error: dbError } = await supabase
      .from('users').select('*').eq('email', normalizedEmail).single();

    if (dbError) {
      // FIX-10c: PGRST116 = "no rows returned" — artinya email tidak ada (bukan error DB)
      if (dbError.code === 'PGRST116') {
        return res.status(401).json({ error: 'Email tidak terdaftar' });
      }
      console.error('Login DB error:', JSON.stringify(dbError));
      return res.status(500).json({ error: 'Gagal mengakses database: ' + dbError.message });
    }

    if (!user)
      return res.status(401).json({ error: 'Email tidak terdaftar' });

    // FIX-10d: handle user yang passwordnya NULL (misal akun OAuth/SSO tanpa password)
    if (!user.password) {
      return res.status(401).json({ error: 'Akun ini tidak mendukung login dengan password' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch)
      return res.status(401).json({ error: 'Password salah' });

    if (user.is_active === false)
      return res.status(403).json({ error: 'Akun dinonaktifkan, hubungi admin' });

    // update last_login async — jangan tunggu hasilnya agar tidak block response
    supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', user.id)
      .then(() => {}).catch(e => console.warn('last_login update failed:', e.message));

    const token = jwt.sign(
      { id: user.id, userId: user.id, email: user.email, role: user.role },
      JWT_SECRET, { expiresIn: '7d' }
    );

    let store = null;
    if (user.role === 'customer') {
      const { data } = await supabase.from('customer_stores').select('*').eq('user_id', user.id).single();
      store = data;
    }

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, company_name: user.company_name || user.name },
      store,
    });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Login gagal: ' + (e.message || 'unknown error') });
  }
});

// Reset password (tanpa token — cukup email + password baru)
// Untuk keperluan admin/debug. Di production sebaiknya tambah OTP/email verification
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, new_password } = req.body;
    if (!email || !new_password) return res.status(400).json({ error: 'Email dan password baru wajib diisi' });
    if (new_password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter' });

    // FIX-12: normalize email + handle PGRST116 correctly
    const normalizedEmail = email.toString().trim().toLowerCase();
    const { data: user, error: findError } = await supabase
      .from('users').select('id').eq('email', normalizedEmail).single();
    if (findError && findError.code !== 'PGRST116') throw findError;
    if (!user) return res.status(404).json({ error: 'Email tidak terdaftar' });

    const hashed = await bcrypt.hash(new_password, 12);
    await supabase.from('users').update({ password: hashed, is_active: true }).eq('id', user.id);

    res.json({ message: 'Password berhasil diubah' });
  } catch (e) {
    console.error('Reset password error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const { data: user } = await supabase
      .from('users').select('id, email, name, role, phone').eq('id', req.user.id).single();

    let store = null;
    if (user?.role === 'customer') {
      const { data } = await supabase.from('customer_stores').select('*').eq('user_id', user.id).single();
      store = data;
    }

    res.json({ user, store });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════
// STORE ONBOARDING (Customer)
// ════════════════════════════════════════════════════════════════

app.get('/api/store/profile', auth, role('customer'), async (req, res) => {
  const { data, error } = await supabase.from('v_stores_full').select('*').eq('user_id', req.user.id).single();
  if (error) return res.status(404).json({ error: 'Store not found' });
  res.json({ store: data });
});

app.put('/api/store/profile', auth, role('customer'), async (req, res) => {
  try {
    const allowed = ['store_name','store_type','owner_name','phone_store','whatsapp',
      'address_line','city_id','province_id','postal_code','monthly_gmv_estimate'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabase.from('customer_stores').update(updates).eq('user_id', req.user.id).select().single();
    if (error) throw error;
    res.json({ store: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Endpoint: admin update allowed_payment_methods per store
app.patch('/api/admin/stores/:id/payment-methods', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { allowed_payment_methods } = req.body;
    if (!Array.isArray(allowed_payment_methods))
      return res.status(400).json({ error: 'allowed_payment_methods harus berupa array' });

    const validMethods = ['bank_transfer','cod','consignment','top_14','top_30'];
    const invalid = allowed_payment_methods.filter(m => !validMethods.includes(m));
    if (invalid.length)
      return res.status(400).json({ error: `Metode tidak valid: ${invalid.join(', ')}` });

    const { data, error } = await supabase
      .from('customer_stores')
      .update({ allowed_payment_methods })
      .eq('id', req.params.id)
      .select('id,store_name,allowed_payment_methods,tier')
      .single();
    if (error) throw error;
    res.json({ store: data, message: 'Metode pembayaran berhasil diperbarui' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/store/documents', auth, role('customer'),
  upload.fields([
    { name: 'ktp_photo', maxCount: 1 },
    { name: 'npwp_photo', maxCount: 1 },
    { name: 'store_photo', maxCount: 1 },
    { name: 'selfie_ktp', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { ktp_number, npwp_number, nib_number } = req.body;
      const updates = {};
      if (ktp_number) updates.ktp_number = ktp_number;
      if (npwp_number) updates.npwp_number = npwp_number;
      if (nib_number) updates.nib_number = nib_number;

      const { data: store } = await supabase.from('customer_stores').select('id').eq('user_id', req.user.id).single();

      for (const [field, files] of Object.entries(req.files || {})) {
        const file = files[0];
        const ext = file.originalname.split('.').pop();
        updates[`${field}_url`] = await uploadFile(
          file.buffer, file.mimetype, 'documents',
          `stores/${store.id}/${field}_${Date.now()}.${ext}`
        );
      }

      await supabase.from('customer_stores').update(updates).eq('user_id', req.user.id);
      res.json({ message: 'Dokumen berhasil diupload' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

app.post('/api/store/submit-review', auth, role('customer'), async (req, res) => {
  try {
    const { data: store } = await supabase.from('customer_stores').select('*').eq('user_id', req.user.id).single();
    if (!store) return res.status(404).json({ error: 'Store not found' });
    if (!['draft','rejected'].includes(store.status))
      return res.status(400).json({ error: 'Tidak bisa submit dengan status: ' + store.status });
    if (!store.ktp_photo_url || !store.store_photo_url)
      return res.status(400).json({ error: 'Foto KTP dan foto toko wajib diupload' });

    await supabase.from('customer_stores')
      .update({ status: 'pending_review', rejection_reason: null })
      .eq('id', store.id);

    const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
    for (const a of admins || []) {
      await createNotification(a.id, 'new_store_registration',
        '🔔 Toko Menunggu Review', `${store.store_name} mengirim dokumen verifikasi`, { store_id: store.id });
    }

    res.json({ message: 'Dokumen dikirim, menunggu review tim SnackHub' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════
// ADMIN: STORE MANAGEMENT
// ════════════════════════════════════════════════════════════════

app.get('/api/admin/stores', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { status, tier, search, page = 1, limit = 20 } = req.query;
    let q = supabase.from('v_stores_full').select('*', { count: 'exact' });
    if (status) q = q.eq('status', status);
    if (tier) q = q.eq('tier', tier);
    if (search) q = q.or(`store_name.ilike.%${search}%,owner_name.ilike.%${search}%,email.ilike.%${search}%`);
    const offset = (page - 1) * limit;
    const { data, count, error } = await q.range(offset, offset + limit - 1).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ stores: data, total: count, page: Number(page), limit: Number(limit) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/stores/:id', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { data: store } = await supabase.from('v_stores_full').select('*').eq('id', req.params.id).single();
    if (!store) return res.status(404).json({ error: 'Store not found' });
    const { data: orders } = await supabase.from('orders')
      .select('id,order_number,status,payment_status,total,created_at')
      .eq('store_id', req.params.id).order('created_at', { ascending: false }).limit(10);
    const { data: credit } = await supabase.from('credit_ledger')
      .select('*').eq('store_id', req.params.id).order('created_at', { ascending: false }).limit(20);
    res.json({ store, recent_orders: orders, credit_history: credit });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/admin/stores/:id/approve', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { tier = 'reseller', credit_limit = 0, notes, allowed_payment_methods } = req.body;
    // Default metode pembayaran berdasarkan tier
    const defaultPaymentMethods = tier === 'agent'
      ? ['bank_transfer','cod','consignment','top_14','top_30']
      : ['bank_transfer','cod'];
    const paymentMethods = allowed_payment_methods || defaultPaymentMethods;

    // Cari store: coba by store.id dulu, fallback by user_id
    const storeId = req.params.id;
    let { data: existingStore } = await supabase.from('customer_stores')
      .select('id').eq('id', storeId).maybeSingle();
    
    // Kalau tidak ketemu by store.id, coba by user_id (untuk user yg ditambah admin)
    if (!existingStore) {
      const { data: byUser } = await supabase.from('customer_stores')
        .select('id').eq('user_id', storeId).maybeSingle();
      if (!byUser) {
        // Belum punya store profile sama sekali — ambil nama dari tabel users dulu
        const { data: userData } = await supabase.from('users')
          .select('name, phone').eq('id', storeId).maybeSingle();
        const { data: newStore, error: createErr } = await supabase.from('customer_stores')
          .insert({
            user_id: storeId,
            store_name: userData?.name || 'Toko Baru',
            owner_name: userData?.name || '-',
            address_line: '-',
            store_type: 'warung',
            status: 'approved',
            tier,
            credit_limit,
            allowed_payment_methods: paymentMethods,
          })
          .select('id').single();
        if (createErr) throw createErr;
        existingStore = newStore;
      } else {
        existingStore = byUser;
      }
    }

    // Update store status
    const { data: store, error } = await supabase.from('customer_stores')
      .update({ status: 'approved', tier, credit_limit, reviewed_by: req.user.id, reviewed_at: new Date().toISOString(), notes, allowed_payment_methods: paymentMethods })
      .eq('id', existingStore.id)
      .select('*')
      .single();
    if (error) throw error;
    if (!store) throw new Error('Store tidak ditemukan');

    // Ambil user secara terpisah agar tidak crash jika join gagal
    const { data: storeUser } = await supabase.from('users')
      .select('id, name, phone').eq('id', store.user_id).single();

    if (storeUser) {
      await createNotification(storeUser.id, 'store_approved',
        '✅ Toko Disetujui!', `Toko ${store.store_name} telah diverifikasi. Tier: ${tier.toUpperCase()}`, { tier });

      const waNum = store.whatsapp || store.phone_store || storeUser.phone;
      if (waNum) {
        await sendWhatsApp(waNum,
          `Halo ${store.owner_name}! 🎉\n\nToko *${store.store_name}* telah berhasil diverifikasi di SnackHub.\n\nTier Anda: *${tier.toUpperCase()}*\nLimit Kredit: *Rp ${Number(credit_limit).toLocaleString('id-ID')}*\n\nSilakan login dan mulai berbelanja!\nhttps://snackhub.id`,
          store.id
        );
      }
    }

    await supabase.from('activity_log').insert({
      user_id: req.user.id, action: 'approve_store', entity_type: 'store', entity_id: req.params.id,
    });

    res.json({ message: 'Toko berhasil disetujui', store });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/admin/stores/:id/reject', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Alasan penolakan wajib diisi' });

    // Cari store: coba by store.id dulu, fallback by user_id
    const storeId = req.params.id;
    let { data: existingStore } = await supabase.from('customer_stores')
      .select('id').eq('id', storeId).maybeSingle();
    if (!existingStore) {
      const { data: byUser } = await supabase.from('customer_stores')
        .select('id').eq('user_id', storeId).maybeSingle();
      existingStore = byUser;
    }
    if (!existingStore) throw new Error('Store tidak ditemukan');

    const { data: store, error } = await supabase.from('customer_stores')
      .update({ status: 'rejected', rejection_reason: reason, reviewed_by: req.user.id, reviewed_at: new Date().toISOString() })
      .eq('id', existingStore.id)
      .select('*')
      .single();
    if (error) throw error;
    if (!store) throw new Error('Store tidak ditemukan');

    const { data: storeUser } = await supabase.from('users')
      .select('id, name, phone').eq('id', store.user_id).single();

    if (storeUser) {
      await createNotification(storeUser.id, 'store_rejected',
        '❌ Verifikasi Ditolak', `Alasan: ${reason}. Silakan perbaiki dan kirim ulang.`, { reason });

      const waNum = store.whatsapp || store.phone_store || storeUser.phone;
      if (waNum) {
        await sendWhatsApp(waNum,
          `Halo ${store.owner_name},\n\nMaaf, verifikasi toko *${store.store_name}* belum dapat kami setujui.\n\nAlasan: ${reason}\n\nSilakan perbaiki dokumen dan submit ulang di aplikasi SnackHub.`,
          store.id
        );
      }
    }

    res.json({ message: 'Toko ditolak', store });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/admin/stores/:id/tier', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { tier, credit_limit, credit_due_days, allowed_payment_methods } = req.body;
    const updates = {};
    if (tier) {
      updates.tier = tier;
      // Auto-update metode pembayaran saat tier berubah (kecuali sudah diset manual)
      if (!allowed_payment_methods) {
        updates.allowed_payment_methods = tier === 'agent'
          ? ['bank_transfer','cod','consignment','top_14','top_30']
          : ['bank_transfer','cod'];
      }
    }
    if (credit_limit !== undefined) updates.credit_limit = credit_limit;
    if (credit_due_days !== undefined) updates.credit_due_days = credit_due_days;
    if (allowed_payment_methods) updates.allowed_payment_methods = allowed_payment_methods;

    const { data } = await supabase.from('customer_stores').update(updates).eq('id', req.params.id).select().single();
    await supabase.from('activity_log').insert({
      user_id: req.user.id, action: 'update_tier', entity_type: 'store', entity_id: req.params.id, new_value: updates,
    });
    res.json({ store: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════
// SUPPLIERS (legacy endpoints — mapped to customer_stores)
// ════════════════════════════════════════════════════════════════

app.get('/api/suppliers', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { search, status, page = 1, limit = 50 } = req.query;

    // Primary: get from v_stores_full (customers with store profile)
    let q = supabase.from('v_stores_full').select('*', { count: 'exact' });
    if (status) q = q.eq('status', status);
    if (search) q = q.or(`store_name.ilike.%${search}%,owner_name.ilike.%${search}%,email.ilike.%${search}%`);
    const { data: storeData, count, error } = await q.order('created_at', { ascending: false });
    if (error) throw error;

    const storeUserIds = new Set((storeData || []).map(s => s.user_id).filter(Boolean));

    // Secondary: get customer users who don't have a store profile yet
    let q2 = supabase.from('users').select('id,email,name,phone,created_at')
      .eq('role', 'customer');
    if (search) q2 = q2.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    const { data: usersData } = await q2.order('created_at', { ascending: false });
    
    // Merge: users without store profile
    const extraUsers = (usersData || [])
      .filter(u => !storeUserIds.has(u.id))
      .map(u => ({
        id: u.id,
        user_id: u.id,
        store_name: u.company_name || u.name,
        owner_name: u.name,
        email: u.email,
        phone: u.phone,
        status: 'active',
        tier: 'reseller',
        credit_limit: 0,
        credit_used: 0,
        created_at: u.created_at,
        company_name: u.company_name || u.name,
        current_credit: 0,
        address: null,
      }));

    const storeSuppliers = (storeData || []).map(s => ({
      ...s,
      name: s.owner_name || s.user_name || s.email || 'Unknown',
      company_name: s.store_name || s.owner_name,
      phone: s.whatsapp || s.phone_store,
      current_credit: s.credit_used || 0,
      address: s.address_line,
      status: s.status || 'draft',
    }));

    // If status filter applied, don't add extra users (they don't have status yet)
    const suppliers = status ? storeSuppliers : [...storeSuppliers, ...extraUsers];
    // Sort by created_at desc
    suppliers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    res.json({ suppliers, total: suppliers.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// BUG-08 FIX: Admin bisa tambah supplier/customer baru
app.post('/api/suppliers', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { name, email, password, company_name, phone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, dan password wajib diisi' });
    if (password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter' });

    const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
    if (existing) return res.status(409).json({ error: 'Email sudah terdaftar' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const { data: user, error } = await supabase.from('users')
      .insert({ email, password: hashedPassword, name, phone, role: 'customer' })
      .select('id,email,name,role,phone')
      .single();
    if (error) throw error;

    // Auto-create store profile
    await supabase.from('customer_stores').insert({
      user_id: user.id,
      store_name: company_name || name,
      owner_name: name,
      status: 'active',
      tier: 'reseller',
    });

    res.status(201).json({ supplier: user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/suppliers/:id', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const lookupId = req.params.id;

    // Coba by store.id dulu
    let { data: store } = await supabase.from('v_stores_full').select('*').eq('id', lookupId).maybeSingle();

    // Fallback: coba by user_id (untuk user yang ditambah admin tanpa onboarding)
    if (!store) {
      const { data: byUser } = await supabase.from('v_stores_full').select('*').eq('user_id', lookupId).maybeSingle();
      store = byUser;
    }

    // Fallback terakhir: ambil dari tabel users langsung
    if (!store) {
      const { data: user } = await supabase.from('users')
        .select('id, name, email, phone, created_at').eq('id', lookupId).maybeSingle();
      if (!user) return res.status(404).json({ error: 'Supplier not found' });

      return res.json({
        supplier: {
          id: user.id,
          user_id: user.id,
          store_name: user.name,
          owner_name: user.name,
          email: user.email,
          phone: user.phone,
          status: 'active',
          tier: 'reseller',
          credit_limit: 0,
          credit_used: 0,
          company_name: user.name,
          current_credit: 0,
          address: null,
          created_at: user.created_at,
        },
        orders: [],
        stats: { totalOrders: 0, totalSpent: 0, completedOrders: 0 },
      });
    }

    const storeId = store.id;
    const { data: orders } = await supabase.from('orders')
      .select('id, order_number, status, total, created_at')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    const completed = orders?.filter(o => o.status === 'completed') || [];
    const totalSpent = completed.reduce((sum, o) => sum + o.total, 0);

    res.json({
      supplier: { ...store, company_name: store.store_name, current_credit: store.credit_used, address: store.address_line },
      orders: orders || [],
      stats: { totalOrders: orders?.length || 0, totalSpent, completedOrders: completed.length },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/suppliers/:id/credit', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { credit_limit } = req.body;
    const { data } = await supabase.from('customer_stores')
      .update({ credit_limit: parseFloat(credit_limit) })
      .eq('id', req.params.id)
      .select()
      .single();
    res.json({ supplier: { ...data, company_name: data.store_name, current_credit: data.credit_used } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════
// PUBLIC ENDPOINTS (no auth)
// ════════════════════════════════════════════════════════════════

app.get('/api/products/public', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, sku, image_url, is_featured, price_tiers(tier, price_per_karton)')
      .eq('is_active', true)
      .order('is_featured', { ascending: false })
      .limit(8);
    if (error) throw error;
    const products = (data || []).map(p => {
      const reseller = p.price_tiers?.find(t => t.tier === 'reseller') || p.price_tiers?.[0];
      return { ...p, price: reseller?.price_per_karton || null, price_tiers: undefined };
    });
    res.json({ products });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/categories/public', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, slug, image_url')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(12);
    if (error) throw error;
    // Count products per category
    const catIds = (data || []).map(c => c.id);
    const counts = {};
    if (catIds.length > 0) {
      const { data: countData } = await supabase
        .from('products')
        .select('category_id')
        .eq('is_active', true)
        .in('category_id', catIds);
      (countData || []).forEach(p => {
        if (p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1;
      });
    }
    const categories = (data || []).map(c => ({ ...c, product_count: counts[c.id] || 0 }));
    res.json({ categories });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════
// PRODUCTS
// ════════════════════════════════════════════════════════════════

app.get('/api/products', auth, async (req, res) => {
  try {
    const { search, category, page = 1, limit = 24 } = req.query;

    let q = supabase
      .from('products')
      .select('*, categories(id,name,slug), price_tiers(tier,price_per_karton,price_per_pack,price_per_pcs,min_karton)', { count: 'exact' })
      .eq('is_active', true);

    if (search) q = q.ilike('name', `%${search}%`);
    if (category) q = q.eq('category_id', category);

    const offset = (page - 1) * limit;
    const { data, count, error } = await q.range(offset, offset + limit - 1).order('created_at', { ascending: false });
    if (error) throw error;

    // Resolve tier pricing
    let customerTier = null;
    let storeApproved = false;
    if (req.user.role === 'customer') {
      const { data: store } = await supabase.from('customer_stores').select('tier,status').eq('user_id', req.user.id).single();
      storeApproved = store?.status === 'approved';
      customerTier = store?.tier || 'reseller';
    } else {
      storeApproved = true;
      customerTier = 'reseller'; // admin: tampilkan harga reseller sebagai referensi
    }

    const TIER_ORDER = ['agent', 'reseller'];
    const products = (data || []).map(p => {
      // Cari harga sesuai tier customer
      let tierPrice = p.price_tiers?.find(t => t.tier === customerTier);
      if (!tierPrice && p.price_tiers?.length) {
        tierPrice = TIER_ORDER.map(tier => p.price_tiers?.find(t => t.tier === tier)).find(Boolean);
      }
      // Harga reseller = harga standar (tampil besar)
      const resellerPrice = p.price_tiers?.find(t => t.tier === 'reseller');
      // Harga agent = harga grosir (tampil kecil di bawah)
      const agentPrice = p.price_tiers?.find(t => t.tier === 'agent');

      return {
        ...p,
        // price = harga sesuai tier customer (yang mereka bayar)
        price: storeApproved ? (tierPrice?.price_per_karton || 0) : null,
        // wholesale_price = harga agent, untuk ditampilkan sebagai "Grosir"
        wholesale_price: storeApproved ? (agentPrice?.price_per_karton || resellerPrice?.price_per_karton || 0) : null,
        stock_quantity: p.stock_karton,
        price_hidden: !storeApproved,
        price_tiers: ['admin','staff'].includes(req.user.role) ? p.price_tiers : undefined,
      };
    });

    res.json({ 
      products, 
      total: count,
      page: Number(page), 
      limit: Number(limit),
      pagination: { 
        page: Number(page), 
        limit: Number(limit), 
        total: count, 
        totalPages: Math.ceil((count || 0) / Number(limit)) 
      } 
    });
  } catch (e) {
    console.error('Get products error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/products/:id', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(*), price_tiers(*)')
      .eq('id', req.params.id)
      .single();
    if (error) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: { ...data, stock_quantity: data.stock_karton, price: data.price_tiers?.[0]?.price_per_karton } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/products', auth, requireRole(['admin','staff']),
  upload.single('image'),
  async (req, res) => {
    try {
      const { price_tiers, ...productData } = req.body;

      // Auto-generate slug from name + timestamp (slug is UNIQUE NOT NULL in DB)
      if (!productData.slug && productData.name) {
        productData.slug = productData.name
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-')
          + '-' + Date.now();
      }

      // Parse numeric fields
      if (productData.pcs_per_pack) productData.pcs_per_pack = parseInt(productData.pcs_per_pack);
      if (productData.pack_per_karton) productData.pack_per_karton = parseInt(productData.pack_per_karton);
      if (productData.stock_karton !== undefined) productData.stock_karton = parseInt(productData.stock_karton) || 0;
      if (productData.reorder_level) productData.reorder_level = parseInt(productData.reorder_level);
      if (productData.weight_gram) productData.weight_gram = parseInt(productData.weight_gram);

      // Handle legacy field names from frontend
      if (productData.stock_quantity !== undefined) {
        if (!productData.stock_karton) {
          productData.stock_karton = parseInt(productData.stock_quantity);
        }
        delete productData.stock_quantity;
      }
      // Remove fields that don't exist in products table (price is in price_tiers)
      delete productData.price;
      delete productData.wholesale_price;
      delete productData.price_per_karton;
      delete productData.price_per_pack;
      delete productData.price_per_pcs;

      if (req.file) {
        const publicId = `product_${Date.now()}`;
        productData.image_url = await uploadProductImage(req.file.buffer, req.file.mimetype, publicId);
      }

      const { data: product, error } = await supabase.from('products').insert(productData).select().single();
      if (error) throw error;

      // Insert price tiers
      const tiers = typeof price_tiers === 'string' ? JSON.parse(price_tiers) : price_tiers;
      if (Array.isArray(tiers) && tiers.length) {
        await supabase.from('price_tiers').insert(tiers.map(t => ({ ...t, product_id: product.id })));
      }

      res.status(201).json({ product });
    } catch (e) {
      console.error('Create product error:', e);
      res.status(500).json({ error: e.message });
    }
  }
);

app.put('/api/products/:id', auth, requireRole(['admin','staff']), upload.single('image'), async (req, res) => {
  try {
    const { price_tiers, ...productData } = req.body;

    // Parse numeric fields (sama seperti POST)
    if (productData.pcs_per_pack)    productData.pcs_per_pack    = parseInt(productData.pcs_per_pack);
    if (productData.pack_per_karton) productData.pack_per_karton = parseInt(productData.pack_per_karton);
    if (productData.stock_karton !== undefined) productData.stock_karton = parseInt(productData.stock_karton) || 0;
    if (productData.reorder_level)   productData.reorder_level   = parseInt(productData.reorder_level);
    if (productData.weight_gram)     productData.weight_gram     = parseInt(productData.weight_gram);

    // Handle legacy field names
    if (productData.stock_quantity !== undefined) {
      if (!productData.stock_karton) productData.stock_karton = parseInt(productData.stock_quantity) || 0;
      delete productData.stock_quantity;
    }
    // Remove fields that don't exist in products table (price is in price_tiers)
    delete productData.price;
    delete productData.wholesale_price;
    delete productData.price_per_karton;
    delete productData.price_per_pack;
    delete productData.price_per_pcs;

    // Upload gambar baru jika ada
    if (req.file) {
      const publicId = `product_${req.params.id}`;
      productData.image_url = await uploadProductImage(req.file.buffer, req.file.mimetype, publicId);
    }

    const { data: product, error } = await supabase.from('products').update(productData).eq('id', req.params.id).select().single();
    if (error) throw error;

    if (price_tiers) {
      const tiers = typeof price_tiers === 'string' ? JSON.parse(price_tiers) : price_tiers;
      for (const t of tiers) {
        await supabase.from('price_tiers').upsert({ ...t, product_id: req.params.id }, { onConflict: 'product_id,tier' });
      }
    }

    res.json({ product });
  } catch (e) {
    console.error('Update product error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/products/:id/prices', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { price_tiers } = req.body;
    for (const t of price_tiers) {
      await supabase.from('price_tiers').upsert({ ...t, product_id: req.params.id }, { onConflict: 'product_id,tier' });
    }
    const { data } = await supabase.from('price_tiers').select('*').eq('product_id', req.params.id);
    res.json({ price_tiers: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/products/:id', auth, requireRole(['admin']), async (req, res) => {
  await supabase.from('products').update({ is_active: false }).eq('id', req.params.id);
  res.json({ message: 'Produk dinonaktifkan' });
});

// ════════════════════════════════════════════════════════════════
// CATEGORIES
// ════════════════════════════════════════════════════════════════

app.get('/api/categories', auth, async (req, res) => {
  const { data, error } = await supabase.from('categories').select('*').eq('is_active', true).order('sort_order');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ categories: data });
});

app.post('/api/categories', auth, requireRole(['admin','staff']), async (req, res) => {
  const { data, error } = await supabase.from('categories').insert(req.body).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ category: data });
});

app.put('/api/categories/:id', auth, requireRole(['admin','staff']), async (req, res) => {
  const { data, error } = await supabase.from('categories').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ category: data });
});

// ════════════════════════════════════════════════════════════════
// INVENTORY
// ════════════════════════════════════════════════════════════════

app.get('/api/inventory', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, sku, stock_karton, stock_pack, reorder_level, unit_type, pack_per_karton, categories(name)')
      .eq('is_active', true)
      .order('stock_karton', { ascending: true });
    if (error) throw error;
    // Add legacy field
    const inventory = (data || []).map(p => ({ ...p, stock_quantity: p.stock_karton }));
    const summary = {
      total: inventory.length,
      lowStock: inventory.filter(p => p.stock_karton <= p.reorder_level && p.stock_karton > 0).length,
      outOfStock: inventory.filter(p => p.stock_karton === 0).length,
    };
    res.json({ products: inventory, inventory, summary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/inventory/adjust', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { product_id, type, quantity, qty_karton, notes, warehouse_id } = req.body;
    const qty = qty_karton || quantity || 0;

    const { data: product } = await supabase.from('products').select('stock_karton').eq('id', product_id).single();
    const isIncoming = ['purchase_in','adjustment_in','transfer_in','return_in'].includes(type) || type === 'incoming';
    const newStock = isIncoming ? product.stock_karton + qty : product.stock_karton - qty;

    await supabase.from('products').update({ stock_karton: newStock }).eq('id', product_id);
    await supabase.from('stock_movements').insert({
      product_id,
      type: type === 'incoming' ? 'purchase_in' : type === 'outgoing' ? 'adjustment_out' : type,
      qty_karton: qty,
      stock_before: product.stock_karton,
      stock_after: newStock,
      warehouse_id: warehouse_id || null,
      notes,
      created_by: req.user.id,
    });

    res.json({ message: 'Stok berhasil diperbarui', new_stock: newStock });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/inventory/history', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { product_id, page = 1, limit = 50 } = req.query;
    let q = supabase.from('stock_movements').select('*, products(name,sku), users(name)');
    if (product_id) q = q.eq('product_id', product_id);
    const offset = (page - 1) * limit;
    const { data, error } = await q.range(offset, offset + limit - 1).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ history: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════
// SHIPPING & REGIONS
// ════════════════════════════════════════════════════════════════

app.post('/api/shipping/calculate', auth, async (req, res) => {
  try {
    const { province_id, total_weight_kg } = req.body;
    const zoneMap = {
      jawa:         [1,2,3,4,5,6],
      bali_ntt_ntb: [7,8,9],
      sumatera:     [10,11,12,13,14,15,16,17,18,19],
      kalimantan:   [20,21,22,23,24],
      sulawesi:     [25,26,27,28,29,30],
      maluku_papua: [31,32,33,34],
    };
    let zone = 'jawa';
    for (const [z, provs] of Object.entries(zoneMap)) {
      if (provs.includes(Number(province_id))) { zone = z; break; }
    }
    const { data: rates } = await supabase.from('shipping_rates').select('*').eq('zone', zone).eq('is_active', true).order('rate_per_kg');
    const weight = Math.max(1, total_weight_kg || 1);
    const options = (rates || []).map(r => ({
      courier: r.courier,
      service: r.service,
      etd: `${r.etd_days_min}-${r.etd_days_max} hari`,
      cost: Math.ceil(weight * r.rate_per_kg / 1000) * 1000,
      is_cod: r.is_cod_available,
    }));
    res.json({ zone, options });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/regions/provinces', auth, async (req, res) => {
  const { data } = await supabase.from('provinces').select('*').order('name');
  res.json({ provinces: data });
});

app.get('/api/regions/cities', auth, async (req, res) => {
  const { province_id } = req.query;
  let q = supabase.from('cities').select('*').eq('is_active', true).order('name');
  if (province_id) q = q.eq('province_id', province_id);
  const { data } = await q;
  res.json({ cities: data });
});

// ════════════════════════════════════════════════════════════════
// ORDERS
// ════════════════════════════════════════════════════════════════

app.get('/api/orders', auth, async (req, res) => {
  try {
    const { status, payment_status, page = 1, limit = 20, search } = req.query;
    let q = supabase.from('v_orders_summary').select('*', { count: 'exact' });

    if (req.user.role === 'customer') {
      const { data: store } = await supabase.from('customer_stores').select('id').eq('user_id', req.user.id).single();
      if (!store) return res.json({ orders: [], total: 0 });
      q = q.eq('store_id', store.id);
    }

    if (status) q = q.eq('status', status);
    if (payment_status) q = q.eq('payment_status', payment_status);
    // BUG-05 FIX: support search by order_number
    if (search) q = q.ilike('order_number', `%${search}%`);

    const offset = (page - 1) * limit;
    const { data, count, error } = await q.range(offset, offset + limit - 1).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ orders: data, total: count, pagination: { page: Number(page), limit: Number(limit), total: count, totalPages: Math.ceil(count / limit) } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/orders/:id', auth, async (req, res) => {
  try {
    const { data: order, error } = await supabase.from('orders').select(`
      *,
      customer_stores(store_name, owner_name, whatsapp, tier),
      order_items(*, products(name, sku, image_url)),
      order_status_history(status, notes, created_at, users(name))
    `).eq('id', req.params.id).single();

    if (error) return res.status(404).json({ error: 'Order not found' });

    if (req.user.role === 'customer') {
      const { data: store } = await supabase.from('customer_stores').select('id').eq('user_id', req.user.id).single();
      if (order.store_id !== store?.id) return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({ order });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/orders', auth, role('customer'), async (req, res) => {
  try {
    const { items, payment_method, shipping_address, courier, courier_service, notes, promo_code, use_credit } = req.body;

    const { data: store } = await supabase.from('customer_stores').select('*').eq('user_id', req.user.id).single();
    if (!store || store.status !== 'approved')
      return res.status(403).json({ error: 'Toko belum diverifikasi. Selesaikan proses onboarding terlebih dahulu.' });

    // Validasi metode pembayaran sesuai yang diizinkan untuk store ini
    const allowedMethods = store.allowed_payment_methods || ['bank_transfer','cod'];
    if (payment_method && !allowedMethods.includes(payment_method)) {
      return res.status(400).json({
        error: `Metode pembayaran '${payment_method}' tidak tersedia untuk akun Anda. Tersedia: ${allowedMethods.join(', ')}`
      });
    }

    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const { data: product } = await supabase.from('products').select('*, price_tiers(*)').eq('id', item.product_id).single();
      if (!product?.is_active) return res.status(400).json({ error: `Produk tidak tersedia` });

      const qty = item.qty_karton || item.quantity || 1;
      if (product.stock_karton < qty)
        return res.status(400).json({ error: `Stok ${product.name} tidak cukup (tersedia: ${product.stock_karton} karton)` });

      const tierPrice = product.price_tiers?.find(t => t.tier === store.tier);
      if (!tierPrice)
        return res.status(400).json({ error: `Harga untuk tier ${store.tier} belum dikonfigurasi pada produk ${product.name}` });

      const itemSubtotal = tierPrice.price_per_karton * qty;
      subtotal += itemSubtotal;
      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        product_sku: product.sku,
        qty_karton: qty,
        tier_applied: store.tier,
        price_per_karton: tierPrice.price_per_karton,
        subtotal: itemSubtotal,
        weight_kg: product.weight_karton_gram ? (product.weight_karton_gram / 1000) * qty : 0,
      });
    }

    // Minimum order check
    const { data: minSetting } = await supabase.from('settings').select('value').eq('key', 'min_order_value').single();
    const minOrder = minSetting?.value?.amount || 0;
    if (subtotal < minOrder)
      return res.status(400).json({ error: `Minimum order Rp ${minOrder.toLocaleString('id-ID')}` });

    // Shipping cost (simplified)
    let shippingCost = 0;
    if (shipping_address?.province_id && courier) {
      const totalWeight = orderItems.reduce((s, i) => s + (i.weight_kg || 0), 0);
      const zoneMap = { jawa:[1,2,3,4,5,6], bali_ntt_ntb:[7,8,9], sumatera:[10,11,12,13,14,15,16,17,18,19], kalimantan:[20,21,22,23,24], sulawesi:[25,26,27,28,29,30], maluku_papua:[31,32,33,34] };
      let zone = 'jawa';
      for (const [z, provs] of Object.entries(zoneMap)) { if (provs.includes(Number(shipping_address.province_id))) { zone = z; break; } }
      const { data: rate } = await supabase.from('shipping_rates').select('rate_per_kg').eq('zone', zone).eq('courier', courier).eq('service', courier_service || 'reg').single();
      if (rate) shippingCost = Math.ceil(Math.max(1, totalWeight) * rate.rate_per_kg / 1000) * 1000;
    }

    // Promo
    let discountAmount = 0;
    let promoId = null;
    if (promo_code) {
      const { data: promo } = await supabase.from('promos').select('*').eq('code', promo_code).eq('is_active', true).single();
      if (promo && new Date(promo.valid_until) > new Date() && subtotal >= (promo.min_order_value || 0)) {
        promoId = promo.id;
        if (promo.type === 'percentage') discountAmount = Math.min(subtotal * promo.discount_percent / 100, promo.max_discount_cap || Infinity);
        else if (promo.type === 'fixed_amount') discountAmount = promo.discount_amount;
        else if (promo.type === 'free_shipping') shippingCost = 0;
      }
    }

    const total = subtotal - discountAmount + shippingCost;

    // Credit check
    const isCreditOrder = !!use_credit && payment_method === 'credit_tempo';
    if (isCreditOrder) {
      const available = store.credit_limit - store.credit_used;
      if (total > available)
        return res.status(400).json({ error: `Limit kredit tidak cukup. Tersedia: Rp ${available.toLocaleString('id-ID')}` });
    }

    const { data: order, error: orderError } = await supabase.from('orders').insert({
      store_id: store.id,
      created_by: req.user.id,
      status: 'pending',
      payment_status: 'unpaid',
      payment_method,
      subtotal,
      discount_amount: discountAmount,
      shipping_cost: shippingCost,
      total,
      ship_to_name: shipping_address?.name || store.owner_name,
      ship_to_phone: shipping_address?.phone || store.whatsapp,
      ship_to_address: shipping_address?.address || store.address_line,
      ship_to_city: shipping_address?.city,
      ship_to_province: shipping_address?.province,
      ship_to_postal: shipping_address?.postal_code,
      courier,
      courier_service,
      is_credit_order: isCreditOrder,
      credit_due_date: isCreditOrder
        ? new Date(Date.now() + store.credit_due_days * 86400000).toISOString().split('T')[0]
        : null,
      notes,
    }).select().single();

    if (orderError) throw orderError;

    await supabase.from('order_items').insert(orderItems.map(i => ({ ...i, order_id: order.id })));

    // Decrement stock
    for (const item of orderItems) {
      const { data: p } = await supabase.from('products').select('stock_karton').eq('id', item.product_id).single();
      await supabase.from('products').update({ stock_karton: p.stock_karton - item.qty_karton }).eq('id', item.product_id);

      await supabase.from('stock_movements').insert({
        product_id: item.product_id, type: 'order_out',
        qty_karton: item.qty_karton, reference_type: 'order', reference_id: order.id,
        created_by: req.user.id,
      });
    }

    if (isCreditOrder) {
      await supabase.from('customer_stores').update({ credit_used: store.credit_used + total }).eq('id', store.id);
      await supabase.from('credit_ledger').insert({
        store_id: store.id, type: 'order_credit',
        debit: total, credit: 0, balance_after: store.credit_used + total,
        reference_id: order.id, reference_type: 'order',
        notes: `Order ${order.order_number}`,
      });
    }

    if (promoId) {
      await supabase.from('promo_usage').insert({ promo_id: promoId, store_id: store.id, order_id: order.id, discount_applied: discountAmount });
    }

    await supabase.from('order_status_history').insert({ order_id: order.id, status: 'pending', created_by: req.user.id });

    const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
    for (const a of admins || []) {
      await createNotification(a.id, 'new_order', '🛒 Order Baru',
        `${order.order_number} dari ${store.store_name} — Rp ${total.toLocaleString('id-ID')}`, { order_id: order.id });
    }

    if (store.whatsapp) {
      await sendWhatsApp(store.whatsapp,
        `Halo ${store.owner_name}! 🎉\n\nOrder *${order.order_number}* berhasil dibuat.\nTotal: *Rp ${total.toLocaleString('id-ID')}*\n\nTim kami akan segera memproses pesanan Anda.`,
        store.id
      );
    }

    res.status(201).json({ order });
  } catch (e) {
    console.error('Create order error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/orders/:id/status', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { status, notes, tracking_number, courier, courier_service, estimated_delivery } = req.body;
    const updates = { status };
    if (tracking_number) updates.tracking_number = tracking_number;
    if (courier) updates.courier = courier;
    if (courier_service) updates.courier_service = courier_service;
    if (estimated_delivery) updates.estimated_delivery = estimated_delivery;

    const now = new Date().toISOString();
    if (status === 'confirmed')  { updates.confirmed_at = now; updates.confirmed_by = req.user.id; }
    if (status === 'packing')    { updates.packed_at = now; updates.packed_by = req.user.id; }
    if (status === 'shipped')      updates.shipped_at = now;
    if (status === 'delivered')    updates.delivered_at = now;
    if (status === 'completed')  { updates.payment_status = 'paid'; setImmediate(recalculateAllTiers); }
    if (status === 'cancelled')  { updates.cancelled_at = now; updates.cancelled_by = req.user.id; updates.cancel_reason = notes; }

    const { data: order, error } = await supabase.from('orders').update(updates).eq('id', req.params.id)
      .select('*, customer_stores(store_name, owner_name, whatsapp, user_id)')
      .single();
    if (error) throw error;

    await supabase.from('order_status_history').insert({ order_id: order.id, status, notes, created_by: req.user.id });

    const msgMap = {
      confirmed:  ['order_confirmed', '✅ Pesanan Dikonfirmasi', 'Pesanan sedang diproses'],
      shipped:    ['order_shipped',   '🚚 Pesanan Dikirim',     `No. resi: ${tracking_number || '-'}`],
      delivered:  ['order_delivered', '📦 Pesanan Tiba',        'Pesanan Anda telah sampai!'],
      cancelled:  ['order_confirmed', '❌ Pesanan Dibatalkan',   notes || 'Pesanan dibatalkan'],
    };

    if (msgMap[status]) {
      const [type, title, msg] = msgMap[status];
      // BUG-3 FIX: ambil user_id dari customer_stores.user_id, bukan join users!inner
      const storeUserId = order.customer_stores?.user_id;
      if (storeUserId) {
        await createNotification(storeUserId, type, title, msg, { order_id: order.id });
      }
      if (order.customer_stores?.whatsapp) {
        await sendWhatsApp(order.customer_stores.whatsapp,
          `${title}\n\nOrder *${order.order_number}*\n${msg}`, order.store_id);
      }
    }

    res.json({ order });
  } catch (e) {
    console.error('Update order status error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════
// PAYMENTS
// ════════════════════════════════════════════════════════════════

app.get('/api/payments', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let q = supabase.from('payments')
      .select('*, orders(order_number, total), customer_stores(store_name)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (req.user.role === 'customer') {
      const { data: store } = await supabase.from('customer_stores').select('id').eq('user_id', req.user.id).single();
      q = q.eq('store_id', store?.id);
    }

    if (status) q = q.eq('status', status);

    const offset = (page - 1) * limit;
    const { data, count, error } = await q.range(offset, offset + limit - 1);
    if (error) throw error;
    res.json({ payments: data, total: count, pagination: { page: Number(page), limit: Number(limit), total: count } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/payments', auth, role('customer'), upload.single('proof'), async (req, res) => {
  try {
    const { order_id, payment_method, amount, bank_from, account_from, transfer_date, notes } = req.body;

    if (!req.file) return res.status(400).json({ error: 'Bukti pembayaran wajib diupload' });

    const { data: store } = await supabase.from('customer_stores').select('id').eq('user_id', req.user.id).single();
    const { data: order } = await supabase.from('orders').select('id,total,store_id,order_number').eq('id', order_id).single();
    if (!order || order.store_id !== store?.id) return res.status(403).json({ error: 'Forbidden' });

    const ext = req.file.originalname.split('.').pop();
    const proof_url = await uploadFile(req.file.buffer, req.file.mimetype, 'payments', `${store.id}/${order_id}_${Date.now()}.${ext}`);

    const { data: payment, error } = await supabase.from('payments').insert({
      order_id, store_id: store.id, payment_method,
      amount: Number(amount), bank_from, account_from,
      transfer_date, proof_url, notes, status: 'pending',
    }).select().single();

    if (error) throw error;

    const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
    for (const a of admins || []) {
      await createNotification(a.id, 'new_payment_proof', '💰 Bukti Pembayaran Masuk',
        `Order ${order.order_number} — Rp ${Number(amount).toLocaleString('id-ID')}`, { payment_id: payment.id, order_id });
    }

    res.status(201).json({ payment });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Legacy endpoint: /payments/:id/status
app.patch('/api/payments/:id/status', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!['approved','rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const { data: payment, error } = await supabase.from('payments')
      .update({ status: status === 'approved' ? 'verified' : 'rejected', notes, approved_by: req.user.id, approved_at: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    if (error) throw error;

    if (status === 'approved') {
      await supabase.from('orders').update({ payment_status: 'paid' }).eq('id', payment.order_id);
    }
    res.json({ payment });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// New endpoint: /payments/:id/verify (with full credit handling)
app.patch('/api/payments/:id/verify', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { action, rejection_reason } = req.body;

    const { data: payment } = await supabase.from('payments')
      .select('*, orders(id,total,total_paid,store_id,order_number,is_credit_order), customer_stores(owner_name,whatsapp,credit_used,user_id)')
      .eq('id', req.params.id).single();

    if (action === 'verify') {
      await supabase.from('payments').update({ status: 'verified', verified_by: req.user.id, verified_at: new Date().toISOString() }).eq('id', req.params.id);
      const newPaid = (payment.orders.total_paid || 0) + payment.amount;
      const newStatus = newPaid >= payment.orders.total ? 'paid' : 'partial';
      await supabase.from('orders').update({ total_paid: newPaid, payment_status: newStatus }).eq('id', payment.orders.id);

      if (payment.orders.is_credit_order) {
        const newCreditUsed = Math.max(0, (payment.customer_stores.credit_used || 0) - payment.amount);
        await supabase.from('customer_stores').update({ credit_used: newCreditUsed }).eq('id', payment.orders.store_id);
        await supabase.from('credit_ledger').insert({
          store_id: payment.orders.store_id, type: 'payment',
          debit: 0, credit: payment.amount, balance_after: newCreditUsed,
          reference_id: payment.id, reference_type: 'payment',
          notes: `Pembayaran order ${payment.orders.order_number}`,
        });
      }

      // BUG-3 FIX: pakai customer_stores.user_id, bukan users!inner(id)
      const storeUserId = payment.customer_stores?.user_id;
      if (storeUserId) {
        await createNotification(storeUserId, 'payment_verified',
          '✅ Pembayaran Dikonfirmasi',
          `Rp ${payment.amount.toLocaleString('id-ID')} untuk order ${payment.orders.order_number}`,
          { order_id: payment.orders.id });
      }

      if (payment.customer_stores.whatsapp) {
        await sendWhatsApp(payment.customer_stores.whatsapp,
          `✅ *Pembayaran Dikonfirmasi*\n\nHalo ${payment.customer_stores.owner_name}!\nPembayaran *Rp ${payment.amount.toLocaleString('id-ID')}* untuk order *${payment.orders.order_number}* telah dikonfirmasi.`,
          payment.orders.store_id
        );
      }
    } else {
      await supabase.from('payments').update({ status: 'rejected', rejection_reason }).eq('id', req.params.id);
      // BUG-3 FIX: pakai customer_stores.user_id, bukan users!inner(id)
      const storeUserId = payment.customer_stores?.user_id;
      if (storeUserId) {
        await createNotification(storeUserId, 'payment_rejected',
          '❌ Bukti Bayar Ditolak', `Alasan: ${rejection_reason}`, { order_id: payment.orders.id });
      }
    }

    res.json({ message: action === 'verify' ? 'Pembayaran dikonfirmasi' : 'Pembayaran ditolak' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════
// DASHBOARD & ANALYTICS
// ════════════════════════════════════════════════════════════════

app.get('/api/dashboard/stats', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const today = new Date();
    const todayStart = startOfDay(today).toISOString();
    const todayEnd = endOfDay(today).toISOString();
    const monthStart = startOfMonth(today).toISOString();
    const monthEnd = endOfMonth(today).toISOString();

    const [todayOrders, monthOrders, pendingCount, storesData, productsData, creditData] = await Promise.all([
      supabase.from('orders').select('total').eq('status', 'completed').gte('created_at', todayStart).lte('created_at', todayEnd),
      supabase.from('orders').select('total').eq('status', 'completed').gte('created_at', monthStart).lte('created_at', monthEnd),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('customer_stores').select('status, tier'),
      supabase.from('products').select('stock_karton, reorder_level').eq('is_active', true),
      supabase.from('v_credit_outstanding').select('total_outstanding'),
    ]);

    const todaySales = todayOrders.data?.reduce((s, o) => s + o.total, 0) || 0;
    const monthSales = monthOrders.data?.reduce((s, o) => s + o.total, 0) || 0;
    const lowStockCount = productsData.data?.filter(p => p.stock_karton <= p.reorder_level).length || 0;
    const totalOutstanding = creditData.data?.reduce((s, r) => s + (r.total_outstanding || 0), 0) || 0;

    res.json({
      // Legacy fields (for existing dashboard page)
      todaySales,
      monthSales,
      todayOrders: pendingCount.count || 0,
      pendingOrders: pendingCount.count || 0,
      lowStockCount,
      totalSuppliers: storesData.data?.filter(s => s.status === 'approved').length || 0,
      totalProducts: productsData.data?.length || 0,
      // New fields
      today_revenue: todaySales,
      pending_stores: storesData.data?.filter(s => s.status === 'pending_review').length || 0,
      approved_stores: storesData.data?.filter(s => s.status === 'approved').length || 0,
      low_stock: lowStockCount,
      total_outstanding_credit: totalOutstanding,
      store_tiers: {
        agent:    storesData.data?.filter(s => s.tier === 'agent').length || 0,
        reseller: storesData.data?.filter(s => s.tier === 'reseller').length || 0,
      },
    });
  } catch (e) {
    console.error('Dashboard stats error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/dashboard/chart', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    const days = period === '30d' ? 30 : 7;
    const data = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const start = startOfDay(date).toISOString();
      const end = endOfDay(date).toISOString();
      const { data: orders } = await supabase
        .from('orders').select('total')
        .eq('status', 'completed')
        .gte('created_at', start).lte('created_at', end);
      data.push({ date: format(date, 'MMM dd'), sales: orders?.reduce((s, o) => s + o.total, 0) || 0 });
    }

    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/dashboard/top-products', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('order_items')
      .select('product_name, qty_karton, product_id, products(image_url, sku)')
      .order('qty_karton', { ascending: false })
      .limit(10);
    if (error) throw error;

    // Aggregate by product
    const map = new Map();
    for (const item of data || []) {
      const key = item.product_id;
      if (!map.has(key)) map.set(key, { ...item, qty_karton: 0 });
      map.get(key).qty_karton += item.qty_karton;
    }
    const products = [...map.values()].sort((a, b) => b.qty_karton - a.qty_karton).slice(0, 5);

    res.json({ products });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/dashboard/recent', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const [stores, orders, payments] = await Promise.all([
      supabase.from('customer_stores').select('id,store_name,status,created_at').eq('status', 'pending_review').order('created_at', { ascending: false }).limit(5),
      supabase.from('v_orders_summary').select('id,order_number,store_name,total,status').order('created_at', { ascending: false }).limit(5),
      supabase.from('payments').select('id,amount,status,created_at,customer_stores(store_name)').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
    ]);
    res.json({ new_stores: stores.data, new_orders: orders.data, pending_payments: payments.data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════
// REPORTS
// ════════════════════════════════════════════════════════════════

app.get('/api/reports/sales', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let q = supabase.from('orders')
      .select('*, customer_stores(store_name, owner_name), order_items(*)')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });
    if (start_date) q = q.gte('created_at', start_date);
    if (end_date) q = q.lte('created_at', end_date);

    const { data: orders, error } = await q;
    if (error) throw error;

    const summary = {
      totalSales: orders?.reduce((s, o) => s + o.total, 0) || 0,
      totalOrders: orders?.length || 0,
      averageOrder: orders?.length ? (orders.reduce((s, o) => s + o.total, 0) / orders.length) : 0,
      completedOrders: orders?.filter(o => o.status === 'completed').length || 0,
    };

    res.json({ orders: orders || [], summary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/reports/inventory', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('*, categories(name)')
      .eq('is_active', true)
      .order('stock_karton', { ascending: true });
    if (error) throw error;

    const summary = {
      totalProducts: products?.length || 0,
      lowStock: products?.filter(p => p.stock_karton <= p.reorder_level && p.stock_karton > 0).length || 0,
      outOfStock: products?.filter(p => p.stock_karton === 0).length || 0,
      totalValue: products?.reduce((s, p) => s + (p.price_tiers?.[0]?.price_per_karton || 0) * (p.stock_karton || 0), 0) || 0,
    };

    res.json({ products: products || [], summary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ════════════════════════════════════════════════════════════════

app.get('/api/notifications', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications').select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json({ notifications: data, unread: data?.filter(n => !n.is_read).length || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/notifications/:id/read', auth, async (req, res) => {
  await supabase.from('notifications').update({ is_read: true }).eq('id', req.params.id).eq('user_id', req.user.id);
  res.json({ success: true });
});

app.patch('/api/notifications/read-all', auth, async (req, res) => {
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', req.user.id);
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════════
// PROMOS
// ════════════════════════════════════════════════════════════════

app.get('/api/promos', auth, async (req, res) => {
  const { data } = await supabase.from('promos').select('*').eq('is_active', true).gte('valid_until', new Date().toISOString());
  res.json({ promos: data });
});

app.post('/api/promos', auth, requireRole(['admin']), async (req, res) => {
  const { data, error } = await supabase.from('promos').insert({ ...req.body, created_by: req.user.id }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ promo: data });
});

app.post('/api/promos/validate', auth, async (req, res) => {
  const { code, order_value } = req.body;
  const { data: promo } = await supabase.from('promos').select('*').eq('code', code).eq('is_active', true).single();
  if (!promo) return res.status(404).json({ error: 'Kode promo tidak valid' });
  if (new Date(promo.valid_until) < new Date()) return res.status(400).json({ error: 'Promo sudah expired' });
  if (promo.min_order_value && order_value < promo.min_order_value)
    return res.status(400).json({ error: `Minimum order Rp ${promo.min_order_value.toLocaleString('id-ID')}` });
  res.json({ promo, valid: true });
});

// ════════════════════════════════════════════════════════════════
// CREDIT
// ════════════════════════════════════════════════════════════════

app.get('/api/credit/ledger', auth, async (req, res) => {
  try {
    let storeId = req.query.store_id;
    if (req.user.role === 'customer') {
      const { data: s } = await supabase.from('customer_stores').select('id').eq('user_id', req.user.id).single();
      storeId = s?.id;
    }
    const { data } = await supabase.from('credit_ledger').select('*').eq('store_id', storeId).order('created_at', { ascending: false });
    res.json({ ledger: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/credit/outstanding', auth, requireRole(['admin','staff']), async (req, res) => {
  const { data } = await supabase.from('v_credit_outstanding').select('*').order('total_outstanding', { ascending: false });
  res.json({ outstanding: data });
});

// ════════════════════════════════════════════════════════════════
// SAVED CARTS
// ════════════════════════════════════════════════════════════════

app.get('/api/saved-carts', auth, role('customer'), async (req, res) => {
  const { data: store } = await supabase.from('customer_stores').select('id').eq('user_id', req.user.id).single();
  const { data } = await supabase.from('saved_carts').select('*').eq('store_id', store.id);
  res.json({ saved_carts: data });
});

app.post('/api/saved-carts', auth, role('customer'), async (req, res) => {
  const { data: store } = await supabase.from('customer_stores').select('id').eq('user_id', req.user.id).single();
  const { data } = await supabase.from('saved_carts').insert({ store_id: store.id, ...req.body }).select().single();
  res.status(201).json({ saved_cart: data });
});

// ════════════════════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════════════════════

// ── Helper: hitung ulang tier semua toko berdasarkan order bulan ini ─────────
async function recalculateAllTiers() {
  try {
    const { data: thresholds } = await supabase.from('settings')
      .select('key,value').in('key', ['tier_agent_min', 'tier_reseller_min']);
    const tMap = {};
    for (const t of thresholds || []) tMap[t.key] = (t.value?.value ?? t.value?.amount ?? 0);
    const agentMin = Number(tMap['tier_agent_min']) || 0;
    if (agentMin === 0) return; // belum dikonfigurasi, skip

    const { data: stores } = await supabase.from('customer_stores')
      .select('id').eq('status', 'approved');
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    for (const store of stores || []) {
      const { data: orders } = await supabase.from('orders')
        .select('total').eq('store_id', store.id)
        .gte('created_at', startOfMonth)
        .not('status', 'eq', 'cancelled');
      const monthlyTotal = (orders || []).reduce((s, o) => s + (Number(o.total) || 0), 0);
      const newTier = monthlyTotal >= agentMin ? 'agent' : 'reseller';
      await supabase.from('customer_stores').update({ tier: newTier }).eq('id', store.id);
    }
  } catch (e) {
    console.error('recalculateAllTiers error:', e.message);
  }
}

// Endpoint: simpan threshold tier agent & reseller, lalu recalculate semua toko
app.patch('/api/settings/tier_thresholds', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { agent_min } = req.body;
    if (agent_min === undefined || agent_min === null) {
      return res.status(400).json({ error: 'agent_min wajib diisi' });
    }
    await supabase.from('settings').upsert([
      { key: 'tier_agent_min', value: { value: Number(agent_min) }, description: 'Min. pembelian bulanan untuk tier Agent (Rp)', updated_by: req.user.id },
    ], { onConflict: 'key' });
    await recalculateAllTiers();
    res.json({ message: 'Threshold tier berhasil disimpan dan tier toko diperbarui' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/settings', auth, requireRole(['admin']), async (req, res) => {
  const { data } = await supabase.from('settings').select('*');
  res.json({ settings: Object.fromEntries((data || []).map(s => [s.key, s.value])) });
});

// Public endpoint — hanya expose setting non-sensitif (ppn_rate, dll)
app.get('/api/settings/public', async (req, res) => {
  try {
    const PUBLIC_KEYS = [
      'ppn_rate', 'app_name', 'min_order',
      'landing_hero_title', 'landing_hero_subtitle', 'landing_hero_badge',
      'landing_stats_products', 'landing_stats_customers', 'landing_stats_rating',
      'landing_about_title', 'landing_about_desc', 'landing_about_year',
      'landing_contact_phone', 'landing_contact_email', 'landing_contact_address',
      'landing_contact_city', 'landing_promo_badge',
      // Rekening bank distributor — customer butuh ini saat checkout transfer
      'bank_accounts',
    ];
    const { data } = await supabase.from('settings').select('*').in('key', PUBLIC_KEYS);
    res.json({ settings: Object.fromEntries((data || []).map(s => [s.key, s.value])) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Endpoint khusus: admin simpan/update rekening bank distributor
app.patch('/api/settings/bank_accounts', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { accounts } = req.body;
    // accounts = [{bank_name, account_number, account_name, is_primary}]
    if (!Array.isArray(accounts))
      return res.status(400).json({ error: 'accounts harus berupa array' });

    const { data, error } = await supabase.from('settings').upsert({
      key: 'bank_accounts',
      value: accounts,
      description: 'Rekening bank distributor untuk pembayaran transfer',
      updated_by: req.user.id,
    }, { onConflict: 'key' }).select().single();
    if (error) throw error;
    res.json({ setting: data, message: 'Rekening bank berhasil disimpan' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/settings/:key', auth, requireRole(['admin']), async (req, res) => {
  const { data } = await supabase.from('settings')
    .upsert({ key: req.params.key, value: req.body.value, updated_by: req.user.id }, { onConflict: 'key' })
    .select().single();
  res.json({ setting: data });
});

// Update profile (admin/staff/customer)
app.put('/api/auth/profile', auth, async (req, res) => {
  try {
    const allowed = ['name', 'phone', 'address'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    const { data: user, error } = await supabase.from('users').update(updates).eq('id', req.user.id).select('id,email,name,role,phone,address').single();
    if (error) throw error;
    res.json({ user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Change password
app.put('/api/auth/change-password', auth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'current_password dan new_password wajib diisi' });
    if (new_password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter' });

    const { data: user } = await supabase.from('users').select('password').eq('id', req.user.id).single();
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

    const valid = await bcrypt.compare(current_password, user.password);
    if (!valid) return res.status(401).json({ error: 'Password lama tidak benar' });

    const hashed = await bcrypt.hash(new_password, 12);
    await supabase.from('users').update({ password: hashed }).eq('id', req.user.id);
    res.json({ message: 'Password berhasil diubah' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ════════════════════════════════════════════════════════════════
// SALESMAN MODULE
// ════════════════════════════════════════════════════════════════

// Helper: require salesman or admin
function requireSalesman(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!['salesman','admin','staff'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Akses ditolak' });
  }
  next();
}

// ── Dashboard salesman ──────────────────────────────────────────
app.get('/api/salesman/dashboard', auth, requireSalesman, async (req, res) => {
  try {
    const salesmanId = req.user.role === 'salesman' ? req.user.id : req.query.salesman_id;
    const now = new Date();
    const monthStart = startOfMonth(now).toISOString();
    const monthEnd   = endOfMonth(now).toISOString();
    const todayStart = startOfDay(now).toISOString();
    const todayEnd   = endOfDay(now).toISOString();

    const [visitsToday, visitsMonth, ordersMonth, target, storesAssigned, arData] = await Promise.all([
      // kunjungan hari ini
      supabase.from('store_visits').select('*', { count: 'exact', head: true })
        .eq('salesman_id', salesmanId)
        .gte('checkin_at', todayStart).lte('checkin_at', todayEnd),
      // kunjungan bulan ini
      supabase.from('store_visits').select('id, order_id, payment_collected')
        .eq('salesman_id', salesmanId)
        .gte('checkin_at', monthStart).lte('checkin_at', monthEnd),
      // order bulan ini (via visits)
      supabase.from('store_visits').select('orders(total)')
        .eq('salesman_id', salesmanId)
        .not('order_id', 'is', null)
        .gte('checkin_at', monthStart).lte('checkin_at', monthEnd),
      // target bulan ini
      supabase.from('salesman_targets')
        .select('*')
        .eq('salesman_id', salesmanId)
        .eq('period_month', now.getMonth() + 1)
        .eq('period_year', now.getFullYear())
        .single(),
      // toko yang di-assign
      supabase.from('customer_stores').select('id', { count: 'exact', head: true })
        .eq('assigned_salesman_id', salesmanId),
      // piutang toko yang di-assign
      supabase.from('customer_stores')
        .select('credit_used, credit_limit')
        .eq('assigned_salesman_id', salesmanId),
    ]);

    const revenueMonth = (ordersMonth.data || []).reduce((s, v) => s + (v.orders?.total || 0), 0);
    const paymentCollected = (visitsMonth.data || []).reduce((s, v) => s + (v.payment_collected || 0), 0);
    const totalAR = (arData.data || []).reduce((s, s2) => s + (s2.credit_used || 0), 0);
    const targetRevenue = target.data?.target_revenue || 0;
    const achievementPct = targetRevenue > 0 ? Math.round((revenueMonth / targetRevenue) * 100) : 0;
    const estimatedCommission = revenueMonth * (target.data?.commission_rate || 0.02);

    res.json({
      today: {
        visits: visitsToday.count || 0,
      },
      month: {
        visits: (visitsMonth.data || []).length,
        orders: (ordersMonth.data || []).length,
        revenue: revenueMonth,
        payment_collected: paymentCollected,
        achievement_pct: achievementPct,
        estimated_commission: estimatedCommission,
      },
      target: target.data || null,
      stores_assigned: storesAssigned.count || 0,
      total_ar: totalAR,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Daftar toko yang di-assign ke salesman ──────────────────────
app.get('/api/salesman/stores', auth, requireSalesman, async (req, res) => {
  try {
    const salesmanId = req.user.role === 'salesman' ? req.user.id : req.query.salesman_id;
    const { search, status } = req.query;

    let q = supabase.from('customer_stores')
      .select('*, users(name, email, phone)')
      .eq('assigned_salesman_id', salesmanId)
      .order('route_order', { ascending: true });

    if (status) q = q.eq('status', status);
    if (search) q = q.ilike('store_name', `%${search}%`);

    const { data, error } = await q;
    if (error) throw error;

    // Tambah info AR per toko
    const stores = (data || []).map(s => ({
      ...s,
      name: s.owner_name || s.users?.name,
      email: s.users?.email,
      ar_percentage: s.credit_limit > 0 ? Math.round((s.credit_used / s.credit_limit) * 100) : 0,
      days_since_visit: s.last_visit_at
        ? Math.floor((Date.now() - new Date(s.last_visit_at).getTime()) / 86400000)
        : null,
    }));

    res.json({ stores });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Detail toko (untuk salesman: lihat histori beli + AR) ───────
app.get('/api/salesman/stores/:id', auth, requireSalesman, async (req, res) => {
  try {
    const { data: store, error } = await supabase
      .from('customer_stores')
      .select('*, users(name, email, phone)')
      .eq('id', req.params.id)
      .single();
    if (error || !store) return res.status(404).json({ error: 'Toko tidak ditemukan' });

    // Ambil 10 order terakhir
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_number, total, status, payment_status, created_at, order_items(product_name, qty_karton, price_per_karton, subtotal)')
      .eq('store_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Ambil 5 kunjungan terakhir
    const { data: visits } = await supabase
      .from('store_visits')
      .select('id, checkin_at, visit_result, notes, payment_collected, salesman_id')
      .eq('store_id', req.params.id)
      .order('checkin_at', { ascending: false })
      .limit(5);

    res.json({
      store: {
        ...store,
        name: store.owner_name || store.users?.name,
        email: store.users?.email,
        ar_percentage: store.credit_limit > 0 ? Math.round((store.credit_used / store.credit_limit) * 100) : 0,
      },
      orders: orders || [],
      visits: visits || [],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Buat order dari aplikasi salesman ──────────────────────────
app.post('/api/salesman/orders', auth, requireSalesman, async (req, res) => {
  try {
    const { store_id, items, notes, payment_method, is_credit } = req.body;
    if (!store_id || !items?.length) return res.status(400).json({ error: 'store_id dan items wajib diisi' });

    const { data: store } = await supabase.from('customer_stores').select('*').eq('id', store_id).single();
    if (!store) return res.status(404).json({ error: 'Toko tidak ditemukan' });

    // Hitung subtotal
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const { data: product } = await supabase.from('products')
        .select('*, price_tiers(*)')
        .eq('id', item.product_id).single();
      if (!product) continue;

      const tier = product.price_tiers?.find(t => t.tier === store.tier) || product.price_tiers?.[0];
      const pricePerKarton = tier?.price_per_karton || 0;
      const qty = item.qty_karton || 1;
      const itemSubtotal = pricePerKarton * qty;
      subtotal += itemSubtotal;

      orderItems.push({
        product_id: item.product_id,
        product_name: product.name,
        product_sku: product.sku,
        qty_karton: qty,
        tier_applied: store.tier,
        price_per_karton: pricePerKarton,
        subtotal: itemSubtotal,
      });
    }

    const total = subtotal;

    // Buat order
    const { data: order, error: orderError } = await supabase.from('orders').insert({
      store_id,
      created_by: req.user.id,
      subtotal,
      total,
      notes,
      payment_method: payment_method || 'transfer',
      is_credit_order: is_credit || false,
      status: 'confirmed', // salesman langsung confirmed
    }).select().single();
    if (orderError) throw orderError;

    // Insert order items
    const itemsWithOrderId = orderItems.map(i => ({ ...i, order_id: order.id }));
    await supabase.from('order_items').insert(itemsWithOrderId);

    // Kurangi stok
    for (const item of items) {
      await supabase.from('products').select('stock_karton').eq('id', item.product_id).single()
        .then(({ data: p }) => {
          if (p) supabase.from('products').update({ stock_karton: Math.max(0, p.stock_karton - (item.qty_karton || 1)) }).eq('id', item.product_id);
        });
    }

    res.status(201).json({ message: 'Order berhasil dibuat', order });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Check-in toko ──────────────────────────────────────────────
app.post('/api/salesman/checkin', auth, requireSalesman, async (req, res) => {
  try {
    const { store_id, lat, lng, photo_url } = req.body;
    if (!store_id) return res.status(400).json({ error: 'store_id wajib diisi' });

    // Cek apakah sudah ada visit aktif (belum checkout)
    const { data: activeVisit } = await supabase
      .from('store_visits')
      .select('id')
      .eq('salesman_id', req.user.id)
      .eq('store_id', store_id)
      .is('checkout_at', null)
      .gte('checkin_at', startOfDay(new Date()).toISOString())
      .single();

    if (activeVisit) return res.status(409).json({ error: 'Sudah check-in di toko ini, harap checkout dulu' });

    const { data: visit, error } = await supabase.from('store_visits').insert({
      salesman_id: req.user.id,
      store_id,
      checkin_at: new Date().toISOString(),
      checkin_lat: lat,
      checkin_lng: lng,
      checkin_photo_url: photo_url,
      visit_result: 'visited',
    }).select().single();
    if (error) throw error;

    res.status(201).json({ message: 'Check-in berhasil', visit });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Check-out toko ─────────────────────────────────────────────
app.patch('/api/salesman/visits/:id/checkout', auth, requireSalesman, async (req, res) => {
  try {
    const { lat, lng, visit_result, notes, order_id, payment_collected } = req.body;

    const { data: visit, error } = await supabase
      .from('store_visits')
      .update({
        checkout_at: new Date().toISOString(),
        checkout_lat: lat,
        checkout_lng: lng,
        visit_result: visit_result || 'visited',
        notes,
        order_id: order_id || null,
        payment_collected: payment_collected || 0,
      })
      .eq('id', req.params.id)
      .eq('salesman_id', req.user.id)
      .select().single();
    if (error) throw error;

    res.json({ message: 'Check-out berhasil', visit });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Riwayat kunjungan salesman ──────────────────────────────────
app.get('/api/salesman/visits', auth, requireSalesman, async (req, res) => {
  try {
    const salesmanId = req.user.role === 'salesman' ? req.user.id : req.query.salesman_id;
    const { date, store_id } = req.query;

    let q = supabase.from('store_visits')
      .select('*, customer_stores(store_name, owner_name, address_line), orders(order_number, total, status)')
      .eq('salesman_id', salesmanId)
      .order('checkin_at', { ascending: false });

    if (date) {
      const d = new Date(date);
      q = q.gte('checkin_at', startOfDay(d).toISOString())
           .lte('checkin_at', endOfDay(d).toISOString());
    }
    if (store_id) q = q.eq('store_id', store_id);

    const { data, error } = await q.limit(50);
    if (error) throw error;
    res.json({ visits: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Stok kendaraan ─────────────────────────────────────────────
app.get('/api/salesman/vehicle-stock', auth, requireSalesman, async (req, res) => {
  try {
    const salesmanId = req.user.role === 'salesman' ? req.user.id : req.query.salesman_id;
    const date = req.query.date || new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('vehicle_stocks')
      .select('*, products(id, name, sku, image_url, unit_type)')
      .eq('salesman_id', salesmanId)
      .eq('date', date);
    if (error) throw error;

    res.json({ stocks: data || [], date });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/salesman/vehicle-stock/load', auth, requireSalesman, async (req, res) => {
  try {
    const { items, date } = req.body; // items: [{product_id, qty_loaded}]
    const today = date || new Date().toISOString().split('T')[0];

    const inserts = items.map(i => ({
      salesman_id: req.user.id,
      product_id: i.product_id,
      date: today,
      qty_loaded: i.qty_loaded,
      qty_sold: 0,
      qty_returned: 0,
    }));

    const { data, error } = await supabase.from('vehicle_stocks').upsert(inserts, {
      onConflict: 'salesman_id,product_id,date'
    }).select();
    if (error) throw error;

    res.json({ message: 'Stok kendaraan berhasil diperbarui', stocks: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/salesman/vehicle-stock/:id/opname', auth, requireSalesman, async (req, res) => {
  try {
    const { qty_sold, qty_returned, notes } = req.body;
    const { data, error } = await supabase.from('vehicle_stocks')
      .update({ qty_sold, qty_returned, notes, closed_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('salesman_id', req.user.id)
      .select().single();
    if (error) throw error;
    res.json({ message: 'Opname berhasil', stock: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Target & performa ──────────────────────────────────────────
app.get('/api/salesman/performance', auth, requireSalesman, async (req, res) => {
  try {
    const salesmanId = req.user.role === 'salesman' ? req.user.id : req.query.salesman_id;
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const year  = parseInt(req.query.year) || new Date().getFullYear();

    const { data: achievement } = await supabase
      .from('v_salesman_monthly_achievement')
      .select('*')
      .eq('salesman_id', salesmanId)
      .eq('period_month', month)
      .eq('period_year', year)
      .single();

    // Daily breakdown
    const monthStart = new Date(year, month - 1, 1).toISOString();
    const monthEnd   = new Date(year, month, 0, 23, 59, 59).toISOString();

    const { data: dailyVisits } = await supabase
      .from('store_visits')
      .select('checkin_at, order_id, payment_collected, orders(total)')
      .eq('salesman_id', salesmanId)
      .gte('checkin_at', monthStart)
      .lte('checkin_at', monthEnd)
      .order('checkin_at');

    // Group by day
    const dailyMap = {};
    for (const v of dailyVisits || []) {
      const day = v.checkin_at.split('T')[0];
      if (!dailyMap[day]) dailyMap[day] = { date: day, visits: 0, revenue: 0, payment: 0 };
      dailyMap[day].visits++;
      dailyMap[day].revenue += v.orders?.total || 0;
      dailyMap[day].payment += v.payment_collected || 0;
    }

    res.json({
      achievement: achievement || null,
      daily: Object.values(dailyMap),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: semua salesman ──────────────────────────────────────
app.get('/api/admin/salesmen', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, email, phone, created_at')
      .eq('role', 'salesman')
      .order('name');
    if (error) throw error;

    // Performa bulan ini untuk setiap salesman
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const { data: achievements } = await supabase
      .from('v_salesman_monthly_achievement')
      .select('*')
      .eq('period_month', month)
      .eq('period_year', year);

    const achMap = {};
    (achievements || []).forEach(a => { achMap[a.salesman_id] = a; });

    const salesmen = (users || []).map(u => ({
      ...u,
      achievement: achMap[u.id] || null,
    }));

    res.json({ salesmen });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ── Admin: tambah akun salesman baru ──────────────────────────
app.post('/api/admin/salesmen', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, dan password wajib diisi' });
    if (password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter' });

    const normalizedEmail = email.toString().trim().toLowerCase();
    const { data: existing } = await supabase.from('users').select('id').eq('email', normalizedEmail).maybeSingle();
    if (existing) return res.status(409).json({ error: 'Email sudah terdaftar' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const { data: user, error } = await supabase.from('users')
      .insert({ email: normalizedEmail, password: hashedPassword, name, phone, role: 'salesman', is_active: true })
      .select('id, email, name, phone, role, created_at')
      .single();
    if (error) throw error;

    res.status(201).json({ salesman: user, message: 'Akun salesman berhasil dibuat' });
  } catch (e) {
    console.error('Create salesman error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: edit akun salesman ──────────────────────────────────
app.put('/api/admin/salesmen/:id', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { name, phone, password, is_active } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (is_active !== undefined) updates.is_active = is_active;
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter' });
      updates.password = await bcrypt.hash(password, 12);
    }
    const { data: user, error } = await supabase.from('users')
      .update(updates).eq('id', req.params.id).eq('role', 'salesman')
      .select('id, email, name, phone, role, is_active, created_at').single();
    if (error) throw error;
    res.json({ salesman: user, message: 'Akun salesman berhasil diperbarui' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: nonaktifkan/hapus akun salesman ─────────────────────
app.delete('/api/admin/salesmen/:id', auth, requireRole(['admin']), async (req, res) => {
  try {
    await supabase.from('users').update({ is_active: false }).eq('id', req.params.id).eq('role', 'salesman');
    res.json({ message: 'Akun salesman dinonaktifkan' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Absensi Salesman ──────────────────────────────────────────

// GET: status absen hari ini
app.get('/api/attendance/today', auth, requireRole(['salesman']), async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from('attendances')
      .select('*')
      .eq('salesman_id', req.user.id)
      .eq('date', today)
      .maybeSingle();
    res.json({ attendance: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST: clock in
app.post('/api/attendance/clock-in', auth, requireRole(['salesman']), async (req, res) => {
  try {
    const { latitude, longitude, face_image_url, address } = req.body;
    if (!latitude || !longitude) return res.status(400).json({ error: 'GPS wajib diisi' });

    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabase
      .from('attendances')
      .select('id')
      .eq('salesman_id', req.user.id)
      .eq('date', today)
      .maybeSingle();

    if (existing) return res.status(409).json({ error: 'Sudah clock in hari ini' });

    const { data, error } = await supabase
      .from('attendances')
      .insert({
        salesman_id: req.user.id,
        date: today,
        clock_in: new Date().toISOString(),
        clock_in_lat: latitude,
        clock_in_lng: longitude,
        clock_in_address: address || null,
        clock_in_photo: face_image_url || null,
        status: 'hadir',
      })
      .select()
      .single();
    if (error) throw error;

    res.status(201).json({ attendance: data, message: 'Clock in berhasil' });
  } catch (e) {
    console.error('Clock in error:', e);
    res.status(500).json({ error: e.message });
  }
});

// PUT: clock out
app.put('/api/attendance/clock-out', auth, requireRole(['salesman']), async (req, res) => {
  try {
    const { latitude, longitude, face_image_url, address } = req.body;
    if (!latitude || !longitude) return res.status(400).json({ error: 'GPS wajib diisi' });

    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabase
      .from('attendances')
      .select('id, clock_out')
      .eq('salesman_id', req.user.id)
      .eq('date', today)
      .maybeSingle();

    if (!existing) return res.status(404).json({ error: 'Belum clock in hari ini' });
    if (existing.clock_out) return res.status(409).json({ error: 'Sudah clock out hari ini' });

    const { data, error } = await supabase
      .from('attendances')
      .update({
        clock_out: new Date().toISOString(),
        clock_out_lat: latitude,
        clock_out_lng: longitude,
        clock_out_address: address || null,
        clock_out_photo: face_image_url || null,
      })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;

    res.json({ attendance: data, message: 'Clock out berhasil' });
  } catch (e) {
    console.error('Clock out error:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET: riwayat absen (30 hari terakhir)
app.get('/api/attendance/history', auth, requireRole(['salesman']), async (req, res) => {
  try {
    const { data } = await supabase
      .from('attendances')
      .select('*')
      .eq('salesman_id', req.user.id)
      .order('date', { ascending: false })
      .limit(30);
    res.json({ history: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET: admin lihat semua absensi
app.get('/api/admin/attendance', auth, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const { date, salesman_id } = req.query;
    let query = supabase
      .from('attendances')
      .select('*, users(name, email)')
      .order('date', { ascending: false })
      .limit(100);
    if (date) query = query.eq('date', date);
    if (salesman_id) query = query.eq('salesman_id', salesman_id);
    const { data } = await query;
    res.json({ attendance: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: buat/edit target salesman ──────────────────────────
app.post('/api/admin/salesman-targets', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { salesman_id, period_month, period_year, target_revenue, target_visits,
            commission_rate, bonus_threshold, bonus_amount, notes } = req.body;

    const { data, error } = await supabase.from('salesman_targets').upsert({
      salesman_id, period_month, period_year, target_revenue, target_visits,
      commission_rate, bonus_threshold, bonus_amount, notes,
      created_by: req.user.id,
    }, { onConflict: 'salesman_id,period_month,period_year' }).select().single();
    if (error) throw error;

    res.json({ message: 'Target berhasil disimpan', target: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: assign toko ke salesman ────────────────────────────
app.post('/api/admin/assign-store', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { store_id, salesman_id } = req.body;
    const { error } = await supabase.from('customer_stores')
      .update({ assigned_salesman_id: salesman_id })
      .eq('id', store_id);
    if (error) throw error;
    res.json({ message: 'Toko berhasil di-assign' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: semua kunjungan (monitoring) ───────────────────────
app.get('/api/admin/visits', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { salesman_id, date, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let q = supabase.from('store_visits')
      .select('*, users!salesman_id(name), customer_stores(store_name, owner_name), orders(order_number, total)', { count: 'exact' })
      .order('checkin_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (salesman_id) q = q.eq('salesman_id', salesman_id);
    if (date) {
      const d = new Date(date);
      q = q.gte('checkin_at', startOfDay(d).toISOString())
           .lte('checkin_at', endOfDay(d).toISOString());
    }

    const { data, error, count } = await q;
    if (error) throw error;
    res.json({ visits: data || [], total: count || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════
// RETURNS & KLAIM
// ════════════════════════════════════════════════════════════════

// GET semua retur (admin/staff)
app.get('/api/returns', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { status, store_id, page = 1, limit = 20 } = req.query;
    let q = supabase.from('returns')
      .select('*, orders(order_number), customer_stores(store_name, owner_name)', { count: 'exact' })
      .order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    if (store_id) q = q.eq('store_id', store_id);
    const offset = (page - 1) * limit;
    const { data, count, error } = await q.range(offset, offset + limit - 1);
    if (error) throw error;
    res.json({ returns: data || [], total: count || 0, pagination: { page: Number(page), limit: Number(limit), total: count, totalPages: Math.ceil((count || 0) / limit) } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET retur milik customer sendiri
app.get('/api/returns/my', auth, role('customer'), async (req, res) => {
  try {
    const { data: store } = await supabase.from('customer_stores').select('id').eq('user_id', req.user.id).single();
    if (!store) return res.json({ returns: [] });
    const { data, error } = await supabase.from('returns')
      .select('*, orders(order_number, total)')
      .eq('store_id', store.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ returns: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST buat retur baru (customer)
app.post('/api/returns', auth, role('customer'), async (req, res) => {
  try {
    const { order_id, reason, items } = req.body;
    if (!order_id || !reason || !items?.length)
      return res.status(400).json({ error: 'order_id, reason, dan items wajib diisi' });

    const { data: store } = await supabase.from('customer_stores').select('id').eq('user_id', req.user.id).single();
    const { data: order } = await supabase.from('orders').select('id, store_id, status').eq('id', order_id).single();
    if (!order || order.store_id !== store?.id) return res.status(403).json({ error: 'Forbidden' });
    if (!['delivered','completed'].includes(order.status))
      return res.status(400).json({ error: 'Retur hanya bisa dilakukan setelah pesanan diterima' });

    const { data: ret, error } = await supabase.from('returns').insert({
      order_id, store_id: store.id, reason, items, status: 'requested',
    }).select().single();
    if (error) throw error;

    // Notif admin
    const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
    for (const a of admins || []) {
      await createNotification(a.id, 'new_return', '↩️ Permintaan Retur',
        `Toko mengajukan retur untuk order #${order_id.slice(0,8)}`, { return_id: ret.id });
    }
    res.status(201).json({ return: ret });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH proses retur (admin)
app.patch('/api/returns/:id/process', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { status, admin_notes, refund_amount, refund_method } = req.body;
    const validStatuses = ['approved','rejected','processed'];
    if (!validStatuses.includes(status))
      return res.status(400).json({ error: 'Status tidak valid' });

    const { data: ret, error } = await supabase.from('returns')
      .update({ status, admin_notes, refund_amount, refund_method, processed_by: req.user.id })
      .eq('id', req.params.id)
      .select('*, customer_stores(user_id, store_name, whatsapp, owner_name)')
      .single();
    if (error) throw error;

    // Jika approved + ada refund → catat ke credit_ledger sebagai kredit
    if (status === 'approved' && refund_amount && refund_method === 'credit_note') {
      const { data: store } = await supabase.from('customer_stores').select('credit_used').eq('id', ret.store_id).single();
      const newCredit = Math.max(0, (store?.credit_used || 0) - refund_amount);
      await supabase.from('customer_stores').update({ credit_used: newCredit }).eq('id', ret.store_id);
      await supabase.from('credit_ledger').insert({
        store_id: ret.store_id, type: 'return_credit',
        debit: 0, credit: refund_amount, balance_after: newCredit,
        reference_id: ret.id, reference_type: 'return',
        notes: `Kredit retur #${ret.id.slice(0,8)}`,
      });
    }

    if (ret.customer_stores?.user_id) {
      const label = status === 'approved' ? '✅ Retur Disetujui' : status === 'rejected' ? '❌ Retur Ditolak' : '📦 Retur Diproses';
      await createNotification(ret.customer_stores.user_id, 'return_update', label,
        admin_notes || `Status retur diperbarui: ${status}`, { return_id: ret.id });
    }
    res.json({ return: ret });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════
// HARGA KHUSUS PER TOKO (special_prices)
// ════════════════════════════════════════════════════════════════

app.get('/api/special-prices', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { store_id, product_id } = req.query;
    let q = supabase.from('special_prices')
      .select('*, products(name,sku), customer_stores(store_name,owner_name)')
      .order('created_at', { ascending: false });
    if (store_id) q = q.eq('store_id', store_id);
    if (product_id) q = q.eq('product_id', product_id);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ special_prices: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/special-prices', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { product_id, store_id, price_per_karton, notes, valid_from, valid_until } = req.body;
    if (!product_id || !store_id || !price_per_karton)
      return res.status(400).json({ error: 'product_id, store_id, dan price_per_karton wajib diisi' });
    const { data, error } = await supabase.from('special_prices')
      .upsert({ product_id, store_id, price_per_karton, notes, valid_from: valid_from || null, valid_until: valid_until || null, created_by: req.user.id },
        { onConflict: 'product_id,store_id' })
      .select('*, products(name,sku), customer_stores(store_name)')
      .single();
    if (error) throw error;
    res.status(201).json({ special_price: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/special-prices/:id', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { error } = await supabase.from('special_prices').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Harga khusus dihapus' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Endpoint untuk customer: cek apakah ada special price untuk produk tertentu
app.get('/api/special-prices/my', auth, role('customer'), async (req, res) => {
  try {
    const { data: store } = await supabase.from('customer_stores').select('id').eq('user_id', req.user.id).single();
    if (!store) return res.json({ special_prices: [] });
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('special_prices')
      .select('product_id, price_per_karton, valid_until')
      .eq('store_id', store.id)
      .or(`valid_until.is.null,valid_until.gte.${today}`);
    res.json({ special_prices: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════
// LAPORAN PIUTANG (AR) — diperluas
// ════════════════════════════════════════════════════════════════

app.get('/api/reports/ar', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { overdue_only, tier } = req.query;
    let q = supabase.from('customer_stores')
      .select('id, store_name, owner_name, whatsapp, tier, credit_limit, credit_used, credit_due_days')
      .eq('status', 'approved')
      .gt('credit_used', 0)
      .order('credit_used', { ascending: false });
    if (tier) q = q.eq('tier', tier);
    const { data: stores, error } = await q;
    if (error) throw error;

    // Untuk setiap toko, ambil order credit yang belum lunas
    const result = [];
    for (const store of stores || []) {
      const { data: overdueOrders } = await supabase.from('orders')
        .select('id, order_number, total, total_paid, credit_due_date, created_at')
        .eq('store_id', store.id)
        .eq('is_credit_order', true)
        .neq('payment_status', 'paid')
        .order('credit_due_date', { ascending: true });

      const today = new Date();
      const overdue = (overdueOrders || []).filter(o => o.credit_due_date && new Date(o.credit_due_date) < today);
      if (overdue_only === 'true' && overdue.length === 0) continue;

      result.push({
        ...store,
        ar_percentage: store.credit_limit > 0 ? Math.round((store.credit_used / store.credit_limit) * 100) : 0,
        overdue_orders: overdue,
        overdue_amount: overdue.reduce((s, o) => s + (o.total - (o.total_paid || 0)), 0),
        pending_orders: overdueOrders || [],
      });
    }

    const summary = {
      total_stores: result.length,
      total_ar: result.reduce((s, r) => s + (r.credit_used || 0), 0),
      total_overdue: result.reduce((s, r) => s + (r.overdue_amount || 0), 0),
      overdue_stores: result.filter(r => r.overdue_amount > 0).length,
    };
    res.json({ stores: result, summary });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════
// LAPORAN KOMISI SALESMAN
// ════════════════════════════════════════════════════════════════

app.get('/api/reports/salesman-commission', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { month = new Date().getMonth() + 1, year = new Date().getFullYear() } = req.query;
    const { data, error } = await supabase.from('v_salesman_monthly_achievement')
      .select('*')
      .eq('period_month', Number(month))
      .eq('period_year', Number(year))
      .order('actual_revenue', { ascending: false });
    if (error) throw error;

    const summary = {
      total_salesman: (data || []).length,
      total_revenue: (data || []).reduce((s, r) => s + (r.actual_revenue || 0), 0),
      total_commission: (data || []).reduce((s, r) => s + (r.estimated_commission || 0), 0),
      avg_achievement: (data || []).length ? Math.round((data || []).reduce((s, r) => s + (r.achievement_pct || 0), 0) / (data || []).length) : 0,
    };
    res.json({ commissions: data || [], summary, month: Number(month), year: Number(year) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════
// ALERT STOK MENIPIS — trigger WA notif ke admin
// ════════════════════════════════════════════════════════════════

app.get('/api/inventory/low-stock-alert', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { data, error } = await supabase.from('products')
      .select('id, name, sku, stock_karton, reorder_level, categories(name)')
      .eq('is_active', true)
      .lte('stock_karton', supabase.rpc) // fallback ke filter manual
      .order('stock_karton', { ascending: true });

    // Filter manual karena Supabase tidak support column comparison langsung
    const { data: allProducts, error: err2 } = await supabase.from('products')
      .select('id, name, sku, stock_karton, reorder_level, categories(name)')
      .eq('is_active', true)
      .order('stock_karton', { ascending: true });
    if (err2) throw err2;

    const lowStock = (allProducts || []).filter(p => p.stock_karton <= p.reorder_level);
    const outOfStock = lowStock.filter(p => p.stock_karton === 0);
    res.json({ low_stock: lowStock, out_of_stock: outOfStock, count: lowStock.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST: kirim WA alert stok menipis ke semua admin
app.post('/api/inventory/send-low-stock-alert', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { data: allProducts } = await supabase.from('products')
      .select('id, name, sku, stock_karton, reorder_level')
      .eq('is_active', true)
      .order('stock_karton', { ascending: true });

    const lowStock = (allProducts || []).filter(p => p.stock_karton <= p.reorder_level);
    if (lowStock.length === 0) return res.json({ message: 'Tidak ada produk stok menipis', sent: 0 });

    const lines = lowStock.slice(0, 10).map(p =>
      `• ${p.name} (${p.sku}): *${p.stock_karton}* karton${p.stock_karton === 0 ? ' ⚠️ HABIS' : ''}`
    ).join('\n');

    const msg = `⚠️ *Alert Stok Menipis*\n\n${lines}\n${lowStock.length > 10 ? `\n...dan ${lowStock.length - 10} produk lainnya` : ''}\n\nSegera lakukan pengisian stok.`;

    const { data: admins } = await supabase.from('users').select('id,phone').eq('role', 'admin');
    let sent = 0;
    for (const admin of admins || []) {
      if (admin.phone) {
        await sendWhatsApp(admin.phone, msg);
        sent++;
      }
      await createNotification(admin.id, 'low_stock_alert', '⚠️ Stok Menipis',
        `${lowStock.length} produk perlu restok`, { count: lowStock.length });
    }
    res.json({ message: `Alert dikirim ke ${sent} admin`, sent, products: lowStock.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════
// PROMO MANAGEMENT (Admin UI)
// ════════════════════════════════════════════════════════════════

app.get('/api/admin/promos', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { data, error } = await supabase.from('promos')
      .select('*, users!created_by(name)')
      .order('created_at', { ascending: false });
    if (error) throw error;

    // Tambah usage count per promo
    const promoIds = (data || []).map(p => p.id);
    const usageCounts = {};
    if (promoIds.length > 0) {
      const { data: usageData } = await supabase.from('promo_usage')
        .select('promo_id').in('promo_id', promoIds);
      (usageData || []).forEach(u => {
        usageCounts[u.promo_id] = (usageCounts[u.promo_id] || 0) + 1;
      });
    }
    const promos = (data || []).map(p => ({ ...p, usage_count: usageCounts[p.id] || 0 }));
    res.json({ promos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/admin/promos/:id', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { data, error } = await supabase.from('promos')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select().single();
    if (error) throw error;
    res.json({ promo: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/promos/:id', auth, requireRole(['admin']), async (req, res) => {
  try {
    await supabase.from('promos').update({ is_active: false }).eq('id', req.params.id);
    res.json({ message: 'Promo dinonaktifkan' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════
// TRACKING RESI PENGIRIMAN
// ════════════════════════════════════════════════════════════════

// PATCH update tracking resi + courier (tanpa ganti status order)
app.patch('/api/orders/:id/tracking', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { tracking_number, courier, courier_service, estimated_delivery } = req.body;
    if (!tracking_number) return res.status(400).json({ error: 'tracking_number wajib diisi' });

    const updates = { tracking_number };
    if (courier) updates.courier = courier;
    if (courier_service) updates.courier_service = courier_service;
    if (estimated_delivery) updates.estimated_delivery = estimated_delivery;

    const { data: order, error } = await supabase.from('orders')
      .update(updates)
      .eq('id', req.params.id)
      .select('*, customer_stores(store_name, user_id, whatsapp, owner_name)')
      .single();
    if (error) throw error;

    // Notif ke customer
    if (order.customer_stores?.user_id) {
      await createNotification(order.customer_stores.user_id, 'tracking_updated',
        '📦 No. Resi Tersedia',
        `Resi ${courier || ''} ${tracking_number} untuk order #${order.order_number}`,
        { order_id: order.id, tracking_number });
    }
    if (order.customer_stores?.whatsapp) {
      await sendWhatsApp(order.customer_stores.whatsapp,
        `📦 *No. Resi Pengiriman*\n\nHalo ${order.customer_stores.owner_name}!\n\nPesanan *${order.order_number}* sudah dikirim.\n\nKurir: *${courier || order.courier || '-'}*\nNo. Resi: *${tracking_number}*\n\nLacak di website kurir ya!`,
        order.store_id);
    }
    res.json({ order, message: 'Resi berhasil diperbarui' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════
// STOK OPNAME GUDANG UTAMA
// ════════════════════════════════════════════════════════════════

app.post('/api/inventory/opname', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { items, notes } = req.body;
    // items: [{product_id, actual_stock}]
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: 'items wajib berupa array' });

    const results = [];
    for (const item of items) {
      const { product_id, actual_stock } = item;
      const { data: product } = await supabase.from('products')
        .select('stock_karton, name').eq('id', product_id).single();
      if (!product) continue;

      const diff = actual_stock - product.stock_karton;
      await supabase.from('products').update({ stock_karton: actual_stock }).eq('id', product_id);
      await supabase.from('stock_movements').insert({
        product_id,
        type: diff >= 0 ? 'adjustment_in' : 'adjustment_out',
        qty_karton: Math.abs(diff),
        stock_before: product.stock_karton,
        stock_after: actual_stock,
        notes: notes || 'Stok opname gudang',
        created_by: req.user.id,
      });
      results.push({ product_id, name: product.name, before: product.stock_karton, after: actual_stock, diff });
    }

    await supabase.from('activity_log').insert({
      user_id: req.user.id, action: 'stock_opname',
      entity_type: 'inventory', new_value: { items_count: results.length, notes },
    });
    res.json({ message: `Opname selesai: ${results.length} produk diperbarui`, results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Global error handler — HARUS set CORS headers juga di sini
// karena Vercel bisa capture error SEBELUM response headers dikirim
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  setCorsHeaders(res, req.headers.origin);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`✅ SnackHub B2B API running on port ${PORT}`);
  });
}

// For Vercel serverless — ES Module default export
export default app;
