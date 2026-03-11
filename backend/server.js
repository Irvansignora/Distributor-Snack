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
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dyhvx9wit',
  api_key:    process.env.CLOUDINARY_API_KEY    || '481755884898814',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'isTbcJBFnyCVr-3mdqSCWMUtDRQ',
});
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
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
const JWT_SECRET = process.env.JWT_SECRET || 'snackhub-secret-key-change-in-production';
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET env variable tidak di-set! Menggunakan fallback. Set di Vercel environment variables.');
}

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

      const { data: existing } = await supabase.from('users').select('id').eq('email', email).single();
      if (existing) return res.status(409).json({ error: 'Email sudah terdaftar' });

      const hashedPassword = await bcrypt.hash(password, 12);
      const { data: user, error } = await supabase
        .from('users')
        .insert({ email, password: hashedPassword, name, phone, role: 'customer' })
        .select()
        .single();
      if (error) throw error;

      // Auto-create empty store profile
      await supabase.from('customer_stores').insert({
        user_id: user.id,
        store_name: company_name || name,
        owner_name: name,
        status: 'draft',
        tier: 'bronze',
      });

      // Notify admins
      const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
      for (const admin of admins || []) {
        await createNotification(admin.id, 'new_store_registration',
          'Pendaftaran Toko Baru', `${name} baru saja mendaftar`, { user_id: user.id });
      }

      const token = jwt.sign({ id: user.id, userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (e) {
      console.error('Register error:', e);
      res.status(500).json({ error: e.message || 'Registration failed' });
    }
  }
);

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data: user, error: userError } = await supabase
      .from('users').select('*').eq('email', email).single();

    // Log error detail untuk debugging di Vercel logs
    if (userError) {
      console.error('Login DB error:', JSON.stringify(userError));
      return res.status(500).json({ error: 'DB error: ' + userError.message });
    }

    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Email atau password salah' });

    // is_active null/undefined dianggap aktif (row baru)
    if (user.is_active === false) return res.status(403).json({ error: 'Akun dinonaktifkan' });

    await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', user.id);

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
      user: { id: user.id, email: user.email, name: user.name, role: user.role, company_name: user.name },
      store,
    });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Login failed' });
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
    const { tier = 'bronze', credit_limit = 0, notes } = req.body;
    const { data: store } = await supabase.from('customer_stores')
      .update({ status: 'approved', tier, credit_limit, reviewed_by: req.user.id, reviewed_at: new Date().toISOString(), notes })
      .eq('id', req.params.id)
      .select('*, users!inner(id, name, phone)')
      .single();

    await createNotification(store.users.id, 'store_approved',
      '✅ Toko Disetujui!', `Toko ${store.store_name} telah diverifikasi. Tier: ${tier.toUpperCase()}`, { tier });

    const waNum = store.whatsapp || store.users.phone;
    if (waNum) {
      await sendWhatsApp(waNum,
        `Halo ${store.owner_name}! 🎉\n\nToko *${store.store_name}* telah berhasil diverifikasi di SnackHub.\n\nTier Anda: *${tier.toUpperCase()}*\nLimit Kredit: *Rp ${Number(credit_limit).toLocaleString('id-ID')}*\n\nSilakan login dan mulai berbelanja!\nhttps://snackhub.id`,
        store.id
      );
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

    const { data: store } = await supabase.from('customer_stores')
      .update({ status: 'rejected', rejection_reason: reason, reviewed_by: req.user.id, reviewed_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*, users!inner(id, name, phone)')
      .single();

    await createNotification(store.users.id, 'store_rejected',
      '❌ Verifikasi Ditolak', `Alasan: ${reason}. Silakan perbaiki dan kirim ulang.`, { reason });

    const waNum = store.whatsapp || store.users.phone;
    if (waNum) {
      await sendWhatsApp(waNum,
        `Halo ${store.owner_name},\n\nMaaf, verifikasi toko *${store.store_name}* belum dapat kami setujui.\n\nAlasan: ${reason}\n\nSilakan perbaiki dokumen dan submit ulang di aplikasi SnackHub.`,
        store.id
      );
    }

    res.json({ message: 'Toko ditolak', store });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/admin/stores/:id/tier', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { tier, credit_limit, credit_due_days } = req.body;
    const updates = {};
    if (tier) updates.tier = tier;
    if (credit_limit !== undefined) updates.credit_limit = credit_limit;
    if (credit_due_days !== undefined) updates.credit_due_days = credit_due_days;

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
    const { search, status, page = 1, limit = 20 } = req.query;
    let q = supabase.from('v_stores_full').select('*', { count: 'exact' });
    if (status) q = q.eq('status', status);
    if (search) q = q.or(`store_name.ilike.%${search}%,owner_name.ilike.%${search}%,email.ilike.%${search}%`);
    const offset = (page - 1) * limit;
    const { data, count, error } = await q.range(offset, offset + limit - 1).order('created_at', { ascending: false });
    if (error) throw error;
    // Map to old shape for frontend compatibility
    const suppliers = (data || []).map(s => ({
      ...s,
      company_name: s.store_name,
      current_credit: s.credit_used,
      address: s.address_line,
    }));
    res.json({ suppliers, total: count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/suppliers/:id', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { data: store } = await supabase.from('v_stores_full').select('*').eq('id', req.params.id).single();
    if (!store) return res.status(404).json({ error: 'Supplier not found' });

    const { data: orders } = await supabase.from('orders')
      .select('id, order_number, status, total, created_at')
      .eq('store_id', req.params.id)
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
      customerTier = store?.tier || 'bronze';
    } else {
      storeApproved = true;
      customerTier = 'gold'; // admin sees gold price as reference
    }

    const products = (data || []).map(p => {
      const tierPrice = p.price_tiers?.find(t => t.tier === customerTier);
      return {
        ...p,
        // Legacy field names for frontend compatibility
        price: storeApproved ? (tierPrice?.price_per_karton || null) : null,
        wholesale_price: storeApproved ? (tierPrice?.price_per_karton || null) : null,
        stock_quantity: p.stock_karton,
        price_hidden: !storeApproved,
        price_tiers: ['admin','staff'].includes(req.user.role) ? p.price_tiers : undefined,
      };
    });

    res.json({ products, total: count, page: Number(page), limit: Number(limit) });
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

      // Parse numeric fields
      if (productData.pcs_per_pack) productData.pcs_per_pack = parseInt(productData.pcs_per_pack);
      if (productData.pack_per_karton) productData.pack_per_karton = parseInt(productData.pack_per_karton);
      if (productData.stock_karton) productData.stock_karton = parseInt(productData.stock_karton);
      if (productData.reorder_level) productData.reorder_level = parseInt(productData.reorder_level);
      if (productData.weight_gram) productData.weight_gram = parseInt(productData.weight_gram);

      // Handle legacy field names from frontend
      if (productData.stock_quantity && !productData.stock_karton) {
        productData.stock_karton = parseInt(productData.stock_quantity);
        delete productData.stock_quantity;
      }
      if (productData.wholesale_price && !productData.price_per_karton) {
        delete productData.wholesale_price; // handled via price_tiers
      }

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

app.put('/api/products/:id', auth, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { price_tiers, ...productData } = req.body;

    // Handle legacy field names
    if (productData.stock_quantity !== undefined) {
      productData.stock_karton = parseInt(productData.stock_quantity);
      delete productData.stock_quantity;
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
    res.json({ products: inventory, inventory });
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
    const { status, payment_status, page = 1, limit = 20 } = req.query;
    let q = supabase.from('v_orders_summary').select('*', { count: 'exact' });

    if (req.user.role === 'customer') {
      const { data: store } = await supabase.from('customer_stores').select('id').eq('user_id', req.user.id).single();
      if (!store) return res.json({ orders: [], total: 0 });
      q = q.eq('store_id', store.id);
    }

    if (status) q = q.eq('status', status);
    if (payment_status) q = q.eq('payment_status', payment_status);

    const offset = (page - 1) * limit;
    const { data, count, error } = await q.range(offset, offset + limit - 1).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ orders: data, total: count, pagination: { page: Number(page), limit: Number(limit), total: count } });
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
      await supabase.from('products').update({ stock_karton: supabase.rpc ? undefined : 0 }).eq('id', item.product_id);
      // Direct update
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
    if (status === 'completed')    updates.payment_status = 'paid';
    if (status === 'cancelled')  { updates.cancelled_at = now; updates.cancelled_by = req.user.id; updates.cancel_reason = notes; }

    const { data: order, error } = await supabase.from('orders').update(updates).eq('id', req.params.id)
      .select('*, customer_stores(store_name, owner_name, whatsapp, users!inner(id))')
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
      await createNotification(order.customer_stores.users.id, type, title, msg, { order_id: order.id });
      if (order.customer_stores.whatsapp) {
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
      .select('*, orders(id,total,total_paid,store_id,order_number,is_credit_order), customer_stores(owner_name,whatsapp,credit_used,users!inner(id))')
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

      await createNotification(payment.customer_stores.users.id, 'payment_verified',
        '✅ Pembayaran Dikonfirmasi',
        `Rp ${payment.amount.toLocaleString('id-ID')} untuk order ${payment.orders.order_number}`,
        { order_id: payment.orders.id });

      if (payment.customer_stores.whatsapp) {
        await sendWhatsApp(payment.customer_stores.whatsapp,
          `✅ *Pembayaran Dikonfirmasi*\n\nHalo ${payment.customer_stores.owner_name}!\nPembayaran *Rp ${payment.amount.toLocaleString('id-ID')}* untuk order *${payment.orders.order_number}* telah dikonfirmasi.`,
          payment.orders.store_id
        );
      }
    } else {
      await supabase.from('payments').update({ status: 'rejected', rejection_reason }).eq('id', req.params.id);
      await createNotification(payment.customer_stores.users.id, 'payment_rejected',
        '❌ Bukti Bayar Ditolak', `Alasan: ${rejection_reason}`, { order_id: payment.orders.id });
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
        bronze: storesData.data?.filter(s => s.tier === 'bronze').length || 0,
        silver: storesData.data?.filter(s => s.tier === 'silver').length || 0,
        gold: storesData.data?.filter(s => s.tier === 'gold').length || 0,
        platinum: storesData.data?.filter(s => s.tier === 'platinum').length || 0,
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
      totalValueKarton: products?.reduce((s, p) => s + p.stock_karton, 0) || 0,
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

app.get('/api/settings', auth, requireRole(['admin']), async (req, res) => {
  const { data } = await supabase.from('settings').select('*');
  res.json({ settings: Object.fromEntries((data || []).map(s => [s.key, s.value])) });
});

app.patch('/api/settings/:key', auth, requireRole(['admin']), async (req, res) => {
  const { data } = await supabase.from('settings')
    .upsert({ key: req.params.key, value: req.body.value, updated_by: req.user.id }, { onConflict: 'key' })
    .select().single();
  res.json({ setting: data });
});

// ════════════════════════════════════════════════════════════════
// ERROR HANDLER
// ════════════════════════════════════════════════════════════════

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Startup env check
const requiredEnvs = ['SUPABASE_URL'];
const missingEnvs = requiredEnvs.filter(e => !process.env[e]);
if (missingEnvs.length > 0) {
  console.error('❌ Missing required env variables:', missingEnvs.join(', '));
}

const usedKey = process.env.SUPABASE_SERVICE_KEY ? 'SUPABASE_SERVICE_KEY' 
  : process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SUPABASE_SERVICE_ROLE_KEY'
  : 'SUPABASE_ANON_KEY (⚠️ BUKAN service role!)';

console.log('🔑 Supabase key used:', usedKey);
console.log('🔐 JWT_SECRET set:', !!process.env.JWT_SECRET);

app.listen(PORT, () => {
  console.log(`✅ SnackHub B2B API running on port ${PORT}`);
});
