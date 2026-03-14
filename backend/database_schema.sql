-- ============================================================
--  SNACKHUB B2B DISTRIBUTOR — DATABASE SCHEMA
--  PostgreSQL / Supabase
--  Version 2.0 — Full B2B rebuild
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- HELPER: auto update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 1. WILAYAH (Region master data)
--    Diperlukan untuk zonasi harga ongkir & tier wilayah
-- ============================================================
CREATE TABLE provinces (
  id        SERIAL PRIMARY KEY,
  name      VARCHAR(100) NOT NULL,
  code      VARCHAR(10)  UNIQUE NOT NULL   -- e.g. 'JKT', 'JBR', 'JTG'
);

CREATE TABLE cities (
  id          SERIAL PRIMARY KEY,
  province_id INTEGER NOT NULL REFERENCES provinces(id),
  name        VARCHAR(100) NOT NULL,
  rajaongkir_id INTEGER,                   -- ID untuk integrasi RajaOngkir API
  is_active   BOOLEAN DEFAULT true
);

CREATE INDEX idx_cities_province ON cities(province_id);


-- ============================================================
-- 2. USERS — Admin, Staff, dan Customer (Toko/Reseller)
-- ============================================================
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  password        VARCHAR(255) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  role            VARCHAR(50)  NOT NULL
                    CHECK (role IN ('admin', 'staff', 'customer')),
  phone           VARCHAR(20),
  is_phone_verified BOOLEAN DEFAULT false,
  avatar_url      TEXT,
  last_login      TIMESTAMP WITH TIME ZONE,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role  ON users(role);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 3. CUSTOMER STORES — Profil toko/reseller yang daftar
--    Satu user bisa punya satu store profile
-- ============================================================

-- Tipe usaha
CREATE TYPE store_type AS ENUM (
  'warung',           -- warung kelontong
  'minimarket',       -- minimarket kecil/sedang
  'supermarket',      -- supermarket
  'reseller_online',  -- jualan via Tokopedia/Shopee/WA
  'distributor',      -- sub-distributor wilayah
  'cafe_resto',       -- kafe / restoran
  'other'
);

-- Status onboarding
CREATE TYPE store_status AS ENUM (
  'draft',            -- baru daftar, belum submit dokumen
  'pending_review',   -- dokumen sudah diupload, menunggu review admin
  'approved',         -- aktif, bisa order
  'rejected',         -- ditolak, dengan alasan
  'suspended'         -- dibekukan sementara (misal nunggak pembayaran)
);

-- Tier pelanggan (menentukan harga yang didapat)
CREATE TYPE customer_tier AS ENUM (
  'agent',    -- pembelian bulanan >= threshold, harga agent
  'reseller'  -- default, harga reseller
);

CREATE TABLE customer_stores (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Identitas toko
  store_name        VARCHAR(255) NOT NULL,
  store_type        store_type   NOT NULL DEFAULT 'warung',
  owner_name        VARCHAR(255) NOT NULL,

  -- Kontak
  phone_store       VARCHAR(20),
  whatsapp          VARCHAR(20),

  -- Alamat lengkap
  address_line      TEXT NOT NULL,
  city_id           INTEGER REFERENCES cities(id),
  province_id       INTEGER REFERENCES provinces(id),
  postal_code       VARCHAR(10),
  latitude          DECIMAL(10, 7),
  longitude         DECIMAL(10, 7),

  -- Dokumen verifikasi
  ktp_number        VARCHAR(20),
  ktp_photo_url     TEXT,
  npwp_number       VARCHAR(20),
  npwp_photo_url    TEXT,
  nib_number        VARCHAR(20),       -- Nomor Induk Berusaha
  store_photo_url   TEXT,              -- Foto toko/lokasi
  selfie_ktp_url    TEXT,              -- Selfie pegang KTP

  -- Status & tier
  status            store_status   NOT NULL DEFAULT 'draft',
  tier              customer_tier  NOT NULL DEFAULT 'reseller',
  rejection_reason  TEXT,             -- diisi admin jika rejected
  reviewed_by       UUID REFERENCES users(id),
  reviewed_at       TIMESTAMP WITH TIME ZONE,

  -- Kredit/Tempo
  credit_limit      DECIMAL(14, 2) DEFAULT 0,       -- maksimal hutang
  credit_used       DECIMAL(14, 2) DEFAULT 0,        -- hutang berjalan
  credit_due_days   INTEGER DEFAULT 14,              -- jatuh tempo (hari)

  -- Estimasi bisnis (dari form registrasi)
  monthly_gmv_estimate  VARCHAR(50),  -- e.g. '< 5jt', '5-20jt', '> 20jt'

  -- Metode pembayaran yang diizinkan untuk toko ini
  -- Reseller: hanya ['bank_transfer','cod']
  -- Agent: bisa semua ['bank_transfer','cod','consignment','top_14','top_30']
  allowed_payment_methods TEXT[] DEFAULT ARRAY['bank_transfer','cod'],

  -- Metadata
  notes             TEXT,             -- catatan internal admin
  referral_code     VARCHAR(20),      -- siapa yang refer
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_stores_user       ON customer_stores(user_id);
CREATE INDEX idx_stores_status     ON customer_stores(status);
CREATE INDEX idx_stores_tier       ON customer_stores(tier);
CREATE INDEX idx_stores_city       ON customer_stores(city_id);

CREATE TRIGGER trg_stores_updated_at
  BEFORE UPDATE ON customer_stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 4. CATEGORIES
-- ============================================================
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  image_url   TEXT,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 5. PRODUCTS
-- ============================================================
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku             VARCHAR(100) UNIQUE NOT NULL,
  barcode         VARCHAR(50),
  name            VARCHAR(255) NOT NULL,
  slug            VARCHAR(255) UNIQUE NOT NULL,
  description     TEXT,
  category_id     UUID REFERENCES categories(id),

  -- Satuan
  unit_type       VARCHAR(20)  DEFAULT 'pcs'
                    CHECK (unit_type IN ('pcs', 'pack', 'karton', 'dus', 'kg', 'liter')),
  pcs_per_pack    INTEGER DEFAULT 1,    -- isi per pack
  pack_per_karton INTEGER DEFAULT 1,   -- pack per karton
  -- Catatan: harga didefinisikan di tabel price_tiers, bukan di sini

  -- Stok
  stock_karton    INTEGER DEFAULT 0,   -- stok dalam satuan karton
  stock_pack      INTEGER DEFAULT 0,   -- stok sisa pack (< 1 karton)
  reorder_level   INTEGER DEFAULT 5,   -- karton minimum sebelum restock alert

  -- Fisik (untuk kalkulasi ongkir)
  weight_gram     INTEGER,             -- berat per pcs dalam gram
  weight_karton_gram INTEGER,          -- berat per karton dalam gram

  -- Media
  image_url       TEXT,
  images          JSONB DEFAULT '[]',  -- array of image URLs

  -- Flags
  is_active       BOOLEAN DEFAULT true,
  is_featured     BOOLEAN DEFAULT false,
  minimum_order_karton INTEGER DEFAULT 1,   -- MOQ dalam karton
  maximum_order_karton INTEGER,             -- batas maksimal per order (null = unlimited)

  -- Info produk
  brand           VARCHAR(100),
  bpom_number     VARCHAR(50),
  halal_number    VARCHAR(50),
  expired_months  INTEGER,             -- estimasi shelf life dalam bulan

  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_products_sku       ON products(sku);
CREATE INDEX idx_products_category  ON products(category_id);
CREATE INDEX idx_products_active    ON products(is_active);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 6. PRICE TIERS — Jantung dari B2B pricing
--    Setiap produk punya harga berbeda per tier customer
-- ============================================================
CREATE TABLE price_tiers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tier            customer_tier NOT NULL,

  -- Harga per satuan karton
  price_per_karton  DECIMAL(12, 2) NOT NULL,
  price_per_pack    DECIMAL(12, 2),     -- otomatis = price_per_karton / pack_per_karton
  price_per_pcs     DECIMAL(12, 2),     -- otomatis = price_per_pack / pcs_per_pack

  -- Minimum pembelian untuk dapat harga tier ini
  min_karton      INTEGER DEFAULT 1,

  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE (product_id, tier)
);

CREATE INDEX idx_price_tiers_product ON price_tiers(product_id);

CREATE TRIGGER trg_price_tiers_updated_at
  BEFORE UPDATE ON price_tiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 7. SPECIAL PRICES — Harga khusus per toko (hasil negosiasi)
--    Override price_tiers untuk toko tertentu
-- ============================================================
CREATE TABLE special_prices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id        UUID NOT NULL REFERENCES customer_stores(id) ON DELETE CASCADE,
  price_per_karton DECIMAL(12, 2) NOT NULL,
  notes           TEXT,
  valid_from      DATE,
  valid_until     DATE,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE (product_id, store_id)
);

CREATE INDEX idx_special_prices_store   ON special_prices(store_id);
CREATE INDEX idx_special_prices_product ON special_prices(product_id);


-- ============================================================
-- 8. PRODUCT AVAILABILITY BY TIER
--    Produk tertentu bisa dikunci hanya untuk tier tertentu
-- ============================================================
CREATE TABLE product_tier_access (
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tier        customer_tier NOT NULL,
  PRIMARY KEY (product_id, tier)
);
-- Jika produk tidak ada di tabel ini → accessible untuk semua tier


-- ============================================================
-- 9. WAREHOUSES
-- ============================================================
CREATE TABLE warehouses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(255) NOT NULL,
  code         VARCHAR(50)  UNIQUE NOT NULL,
  address      TEXT,
  city_id      INTEGER REFERENCES cities(id),
  province_id  INTEGER REFERENCES provinces(id),
  manager_name VARCHAR(255),
  phone        VARCHAR(20),
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER trg_warehouses_updated_at
  BEFORE UPDATE ON warehouses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 10. STOCK MOVEMENTS — Semua mutasi stok
-- ============================================================
CREATE TYPE stock_movement_type AS ENUM (
  'purchase_in',    -- barang masuk dari supplier/produsen
  'order_out',      -- keluar karena order customer
  'order_cancel',   -- stok kembali karena order dibatalkan
  'adjustment_in',  -- koreksi tambah (stock opname)
  'adjustment_out', -- koreksi kurang (stock opname)
  'transfer_in',    -- masuk dari gudang lain
  'transfer_out',   -- keluar ke gudang lain
  'return_in',      -- retur dari customer
  'damage_out'      -- barang rusak/expired dibuang
);

CREATE TABLE stock_movements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      UUID NOT NULL REFERENCES products(id),
  warehouse_id    UUID REFERENCES warehouses(id),
  type            stock_movement_type NOT NULL,
  qty_karton      INTEGER DEFAULT 0,
  qty_pack        INTEGER DEFAULT 0,
  qty_pcs         INTEGER DEFAULT 0,
  stock_before    INTEGER,           -- stok karton sebelum mutasi
  stock_after     INTEGER,           -- stok karton setelah mutasi
  reference_type  VARCHAR(50),       -- 'order', 'transfer', 'adjustment', etc
  reference_id    UUID,              -- ID order / transfer / dll
  notes           TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_product   ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_warehouse ON stock_movements(warehouse_id);
CREATE INDEX idx_stock_movements_ref       ON stock_movements(reference_id);


-- ============================================================
-- 11. SHIPPING ZONES — Zona pengiriman untuk kalkulasi ongkir
-- ============================================================
CREATE TYPE shipping_zone AS ENUM (
  'jawa',
  'bali_ntt_ntb',
  'sumatera',
  'kalimantan',
  'sulawesi',
  'maluku_papua'
);

CREATE TABLE shipping_rates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone            shipping_zone NOT NULL,
  courier         VARCHAR(50) NOT NULL,     -- 'jne', 'jnt', 'sicepat', 'anteraja', 'pos'
  service         VARCHAR(50) NOT NULL,     -- 'reg', 'yes', 'oke', 'express'
  rate_per_kg     DECIMAL(10, 2) NOT NULL,
  min_weight_kg   DECIMAL(8, 2) DEFAULT 1,
  etd_days_min    INTEGER,
  etd_days_max    INTEGER,
  is_cod_available BOOLEAN DEFAULT false,
  cod_fee_percent  DECIMAL(5, 2) DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_shipping_rates_zone_courier ON shipping_rates(zone, courier, service);


-- ============================================================
-- 12. ORDERS
-- ============================================================
CREATE TYPE order_status AS ENUM (
  'draft',          -- belum di-submit (tersimpan di keranjang)
  'pending',        -- submitted, menunggu konfirmasi admin
  'confirmed',      -- dikonfirmasi admin, sedang disiapkan
  'packing',        -- sedang packing di gudang
  'ready_to_ship',  -- sudah packed, menunggu kurir pickup
  'shipped',        -- sudah dikirim, ada nomor resi
  'delivered',      -- sudah diterima customer (konfirmasi)
  'completed',      -- selesai & terbayar lunas
  'cancelled'       -- dibatalkan
);

CREATE TYPE payment_status AS ENUM (
  'unpaid',
  'partial',        -- bayar sebagian (untuk kredit/cicil)
  'paid',
  'overdue',        -- lewat jatuh tempo
  'refunded'
);

CREATE TYPE payment_method AS ENUM (
  'bank_transfer',    -- transfer bank (semua bank)
  'cod',              -- bayar di tempat (Cash on Delivery)
  'consignment',      -- konsinyasi / titip jual
  'top_14',           -- Term of Payment 14 hari
  'top_30',           -- Term of Payment 30 hari
  'credit_tempo'      -- kredit/tempo (legacy, dipertahankan untuk backward compat)
);

CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number    VARCHAR(50) UNIQUE,       -- auto-generated trigger
  store_id        UUID NOT NULL REFERENCES customer_stores(id),
  created_by      UUID NOT NULL REFERENCES users(id),  -- user yang buat order

  -- Status
  status          order_status   NOT NULL DEFAULT 'pending',
  payment_status  payment_status NOT NULL DEFAULT 'unpaid',
  payment_method  payment_method,

  -- Pricing snapshot (harga saat order, tidak berubah meski harga berubah)
  subtotal        DECIMAL(14, 2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(14, 2) DEFAULT 0,
  shipping_cost   DECIMAL(14, 2) DEFAULT 0,
  tax_amount      DECIMAL(14, 2) DEFAULT 0,
  total           DECIMAL(14, 2) NOT NULL DEFAULT 0,
  total_paid      DECIMAL(14, 2) DEFAULT 0,

  -- Alamat pengiriman (snapshot dari store address saat order)
  ship_to_name    VARCHAR(255),
  ship_to_phone   VARCHAR(20),
  ship_to_address TEXT,
  ship_to_city    VARCHAR(100),
  ship_to_province VARCHAR(100),
  ship_to_postal  VARCHAR(10),

  -- Pengiriman
  courier         VARCHAR(50),       -- 'jne', 'jnt', 'sicepat', dll
  courier_service VARCHAR(50),       -- 'reg', 'yes', 'oke', dll
  tracking_number VARCHAR(100),
  shipped_at      TIMESTAMP WITH TIME ZONE,
  estimated_delivery DATE,
  delivered_at    TIMESTAMP WITH TIME ZONE,

  -- Kredit/Tempo
  is_credit_order BOOLEAN DEFAULT false,
  credit_due_date DATE,              -- jatuh tempo jika kredit

  -- Workflow timestamps
  confirmed_at    TIMESTAMP WITH TIME ZONE,
  confirmed_by    UUID REFERENCES users(id),
  packed_at       TIMESTAMP WITH TIME ZONE,
  packed_by       UUID REFERENCES users(id),
  cancelled_at    TIMESTAMP WITH TIME ZONE,
  cancelled_by    UUID REFERENCES users(id),
  cancel_reason   TEXT,

  -- Misc
  notes           TEXT,              -- catatan dari customer
  internal_notes  TEXT,              -- catatan internal admin
  warehouse_id    UUID REFERENCES warehouses(id),

  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_orders_store       ON orders(store_id);
CREATE INDEX idx_orders_status      ON orders(status);
CREATE INDEX idx_orders_pay_status  ON orders(payment_status);
CREATE INDEX idx_orders_created_at  ON orders(created_at);
CREATE INDEX idx_orders_credit_due  ON orders(credit_due_date) WHERE is_credit_order = true;

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'SH-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(NEW.id::text, 1, 6));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION generate_order_number();


-- ============================================================
-- 13. ORDER ITEMS
-- ============================================================
CREATE TABLE order_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),

  -- Snapshot nama & SKU saat order (tidak berubah meski produk diedit)
  product_name    VARCHAR(255) NOT NULL,
  product_sku     VARCHAR(100) NOT NULL,

  -- Kuantitas dalam satuan karton
  qty_karton      INTEGER NOT NULL CHECK (qty_karton > 0),
  qty_pack        INTEGER DEFAULT 0,   -- jika ada sisa pack

  -- Harga snapshot saat order
  tier_applied    customer_tier,       -- tier yang dipakai saat order
  price_per_karton DECIMAL(12, 2) NOT NULL,
  subtotal        DECIMAL(14, 2) NOT NULL,

  -- Total berat untuk kalkulasi ongkir
  weight_kg       DECIMAL(8, 2),

  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_order_items_order   ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);


-- ============================================================
-- 14. ORDER STATUS HISTORY — Audit trail semua perubahan status
-- ============================================================
CREATE TABLE order_status_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status      order_status NOT NULL,
  notes       TEXT,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_order_status_history ON order_status_history(order_id);


-- ============================================================
-- 15. PAYMENTS — Bukti pembayaran dari customer
-- ============================================================
CREATE TYPE payment_proof_status AS ENUM (
  'pending',    -- baru diupload, menunggu verifikasi admin
  'verified',   -- sudah dikonfirmasi admin
  'rejected'    -- ditolak (bukti tidak valid / nominal salah)
);

CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES orders(id),
  store_id        UUID NOT NULL REFERENCES customer_stores(id),
  payment_method  payment_method NOT NULL,

  amount          DECIMAL(14, 2) NOT NULL,
  bank_from       VARCHAR(50),           -- nama bank pengirim
  account_from    VARCHAR(50),           -- no rekening / nama pengirim
  transfer_date   DATE,
  proof_url       TEXT,                  -- foto bukti transfer

  status          payment_proof_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  verified_by     UUID REFERENCES users(id),
  verified_at     TIMESTAMP WITH TIME ZONE,

  notes           TEXT,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_store ON payments(store_id);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 16. CREDIT LEDGER — Buku besar kredit per toko
--    Setiap transaksi kredit/pembayaran dicatat di sini
-- ============================================================
CREATE TYPE credit_ledger_type AS ENUM (
  'order_credit',    -- order pakai kredit, saldo bertambah (hutang naik)
  'payment',         -- bayar hutang, saldo berkurang
  'credit_increase', -- admin naikkan limit kredit
  'credit_decrease', -- admin turunkan limit kredit
  'write_off'        -- hapus buku (bad debt)
);

CREATE TABLE credit_ledger (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id        UUID NOT NULL REFERENCES customer_stores(id),
  type            credit_ledger_type NOT NULL,
  reference_id    UUID,              -- order_id atau payment_id
  reference_type  VARCHAR(20),       -- 'order' atau 'payment'
  debit           DECIMAL(14, 2) DEFAULT 0,   -- hutang bertambah
  credit          DECIMAL(14, 2) DEFAULT 0,   -- hutang berkurang
  balance_after   DECIMAL(14, 2) NOT NULL,    -- saldo kredit setelah transaksi
  notes           TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_credit_ledger_store ON credit_ledger(store_id);
CREATE INDEX idx_credit_ledger_ref   ON credit_ledger(reference_id);


-- ============================================================
-- 17. NOTIFICATIONS
-- ============================================================
CREATE TYPE notification_channel AS ENUM ('in_app', 'whatsapp', 'email');
CREATE TYPE notification_type AS ENUM (
  -- Customer events
  'store_approved', 'store_rejected',
  'order_confirmed', 'order_packed', 'order_shipped', 'order_delivered',
  'payment_verified', 'payment_rejected',
  'credit_due_reminder', 'credit_overdue',
  -- Admin events
  'new_store_registration', 'new_order', 'new_payment_proof',
  'low_stock_alert'
);

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  channel     notification_channel NOT NULL DEFAULT 'in_app',
  type        notification_type NOT NULL,
  title       VARCHAR(255) NOT NULL,
  message     TEXT NOT NULL,
  data        JSONB DEFAULT '{}',   -- payload tambahan (misal order_id, amount, dll)
  is_read     BOOLEAN DEFAULT false,
  sent_at     TIMESTAMP WITH TIME ZONE,   -- null = belum dikirim
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user    ON notifications(user_id);
CREATE INDEX idx_notifications_unread  ON notifications(user_id, is_read) WHERE is_read = false;


-- ============================================================
-- 18. WHATSAPP MESSAGE LOG
--    Tracking semua pesan WA yang dikirim
-- ============================================================
CREATE TABLE wa_message_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id        UUID REFERENCES customer_stores(id),
  user_id         UUID REFERENCES users(id),
  phone_number    VARCHAR(20) NOT NULL,
  template_name   VARCHAR(100),
  message_body    TEXT NOT NULL,
  status          VARCHAR(20) DEFAULT 'pending'
                    CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  provider        VARCHAR(50),        -- 'fonnte', 'wablas', 'twilio'
  provider_msg_id VARCHAR(100),
  error_message   TEXT,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_wa_log_store ON wa_message_log(store_id);


-- ============================================================
-- 19. PROMOS & DISCOUNTS
-- ============================================================
CREATE TYPE promo_type AS ENUM (
  'percentage',        -- diskon persen
  'fixed_amount',      -- potongan nominal
  'free_shipping',     -- gratis ongkir
  'buy_x_get_y'        -- beli sekian dapat bonus
);

CREATE TYPE promo_target AS ENUM (
  'all',               -- semua toko
  'tier_agent',
  'tier_reseller',
  'specific_stores'    -- hanya toko tertentu (lihat promo_store_targets)
);

CREATE TABLE promos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            VARCHAR(50) UNIQUE,       -- kode voucher (null = otomatis)
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  type            promo_type NOT NULL,
  target          promo_target NOT NULL DEFAULT 'all',

  -- Nilai diskon
  discount_percent  DECIMAL(5, 2),          -- untuk tipe percentage
  discount_amount   DECIMAL(12, 2),         -- untuk tipe fixed_amount

  -- Kondisi
  min_order_value   DECIMAL(12, 2),         -- minimum total order
  min_order_karton  INTEGER,                -- minimum kuantitas karton
  max_discount_cap  DECIMAL(12, 2),         -- maksimal diskon (untuk %)

  -- Berlaku untuk produk/kategori tertentu (null = semua)
  applicable_category_id UUID REFERENCES categories(id),
  applicable_product_id  UUID REFERENCES products(id),

  -- Periode
  valid_from      TIMESTAMP WITH TIME ZONE NOT NULL,
  valid_until     TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Quota
  usage_limit     INTEGER,                  -- total penggunaan max (null = unlimited)
  usage_count     INTEGER DEFAULT 0,        -- sudah dipakai berapa kali
  per_store_limit INTEGER DEFAULT 1,        -- max pakai per toko

  is_active       BOOLEAN DEFAULT true,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE promo_store_targets (
  promo_id  UUID NOT NULL REFERENCES promos(id) ON DELETE CASCADE,
  store_id  UUID NOT NULL REFERENCES customer_stores(id),
  PRIMARY KEY (promo_id, store_id)
);

CREATE TABLE promo_usage (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promo_id    UUID NOT NULL REFERENCES promos(id),
  store_id    UUID NOT NULL REFERENCES customer_stores(id),
  order_id    UUID NOT NULL REFERENCES orders(id),
  discount_applied DECIMAL(12, 2) NOT NULL,
  used_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_promo_usage_store ON promo_usage(store_id);
CREATE INDEX idx_promo_usage_promo ON promo_usage(promo_id);

CREATE TRIGGER trg_promos_updated_at
  BEFORE UPDATE ON promos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 20. SAVED ORDERS (Draft / Repeat Order)
-- ============================================================
CREATE TABLE saved_carts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id    UUID NOT NULL REFERENCES customer_stores(id),
  name        VARCHAR(100),           -- e.g. "Pesanan Rutin Minggu"
  items       JSONB NOT NULL,         -- [{product_id, qty_karton, qty_pack}]
  notes       TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_saved_carts_store ON saved_carts(store_id);


-- ============================================================
-- 21. RETURNS — Retur produk dari toko
-- ============================================================
CREATE TYPE return_status AS ENUM (
  'requested', 'approved', 'received', 'completed', 'rejected'
);

CREATE TABLE returns (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES orders(id),
  store_id        UUID NOT NULL REFERENCES customer_stores(id),
  status          return_status NOT NULL DEFAULT 'requested',
  reason          TEXT NOT NULL,
  items           JSONB NOT NULL,       -- [{order_item_id, qty, reason}]
  refund_amount   DECIMAL(14, 2),
  refund_method   VARCHAR(50),          -- 'credit_note', 'transfer_back'
  admin_notes     TEXT,
  processed_by    UUID REFERENCES users(id),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER trg_returns_updated_at
  BEFORE UPDATE ON returns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 22. ACTIVITY LOG — Audit trail semua aksi admin/staff
-- ============================================================
CREATE TABLE activity_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id),
  action        VARCHAR(100) NOT NULL,  -- e.g. 'approve_store', 'update_price'
  entity_type   VARCHAR(50),            -- 'store', 'order', 'product', dll
  entity_id     UUID,
  old_value     JSONB,
  new_value     JSONB,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_activity_log_user   ON activity_log(user_id);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);


-- ============================================================
-- 23. SETTINGS — Konfigurasi sistem (key-value store)
-- ============================================================
CREATE TABLE settings (
  key         VARCHAR(100) PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT,
  updated_by  UUID REFERENCES users(id),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default settings
INSERT INTO settings (key, value, description) VALUES
  ('min_order_value',    '{"amount": 500000}',   'Minimum nilai order dalam Rupiah'),
  ('free_shipping_min',  '{"amount": 2000000}',  'Minimum order untuk gratis ongkir (jika ada)'),
  ('credit_default_days','{"days": 14}',          'Default jatuh tempo kredit (hari)'),
  ('wa_provider',        '{"provider": "fonnte", "enabled": false}', 'WhatsApp provider config'),
  ('rajaongkir_key',     '{"key": "", "enabled": false}',            'RajaOngkir API key'),
  ('midtrans_key',       '{"key": "", "sandbox": true, "enabled": false}', 'Midtrans payment gateway');


-- ============================================================
-- SEED DATA — Provinces & Shipping Zones
-- ============================================================
INSERT INTO provinces (name, code) VALUES
  ('DKI Jakarta',          'JKT'),
  ('Jawa Barat',           'JBR'),
  ('Jawa Tengah',          'JTG'),
  ('Jawa Timur',           'JTM'),
  ('Banten',               'BTN'),
  ('DI Yogyakarta',        'DIY'),
  ('Bali',                 'BLI'),
  ('Nusa Tenggara Barat',  'NTB'),
  ('Nusa Tenggara Timur',  'NTT'),
  ('Sumatera Utara',       'SUT'),
  ('Sumatera Barat',       'SUB'),
  ('Sumatera Selatan',     'SUS'),
  ('Riau',                 'RIU'),
  ('Kepulauan Riau',       'KRI'),
  ('Jambi',                'JMB'),
  ('Bengkulu',             'BKL'),
  ('Lampung',              'LPG'),
  ('Bangka Belitung',      'BKB'),
  ('Aceh',                 'ACH'),
  ('Kalimantan Barat',     'KLB'),
  ('Kalimantan Tengah',    'KLT'),
  ('Kalimantan Selatan',   'KLS'),
  ('Kalimantan Timur',     'KLM'),
  ('Kalimantan Utara',     'KLU'),
  ('Sulawesi Utara',       'SLU'),
  ('Sulawesi Tengah',      'SLT'),
  ('Sulawesi Selatan',     'SLS'),
  ('Sulawesi Tenggara',    'SLG'),
  ('Gorontalo',            'GRT'),
  ('Sulawesi Barat',       'SLB'),
  ('Maluku',               'MLK'),
  ('Maluku Utara',         'MLU'),
  ('Papua',                'PPA'),
  ('Papua Barat',          'PPB');

-- Sample shipping rates (estimasi, harus disesuaikan)
INSERT INTO shipping_rates (zone, courier, service, rate_per_kg, etd_days_min, etd_days_max, is_cod_available) VALUES
  ('jawa',             'jne',      'reg',     9000,  2, 3,  true),
  ('jawa',             'jne',      'yes',     19000, 1, 1,  false),
  ('jawa',             'jnt',      'reg',     8000,  2, 3,  true),
  ('jawa',             'sicepat',  'reg',     8000,  2, 3,  true),
  ('jawa',             'sicepat',  'best',    15000, 1, 2,  false),
  ('bali_ntt_ntb',     'jne',      'reg',     12000, 3, 5,  true),
  ('bali_ntt_ntb',     'jnt',      'reg',     11000, 3, 5,  true),
  ('sumatera',         'jne',      'reg',     11000, 3, 5,  true),
  ('sumatera',         'jnt',      'reg',     10000, 3, 5,  true),
  ('sumatera',         'sicepat',  'gokil',   10000, 3, 5,  false),
  ('kalimantan',       'jne',      'reg',     14000, 4, 6,  true),
  ('kalimantan',       'jnt',      'reg',     13000, 4, 6,  false),
  ('sulawesi',         'jne',      'reg',     15000, 5, 7,  true),
  ('sulawesi',         'jnt',      'reg',     14000, 5, 7,  false),
  ('maluku_papua',     'jne',      'reg',     20000, 7, 14, false),
  ('maluku_papua',     'pos',      'biasa',   18000, 10,21, false);

-- Default categories
INSERT INTO categories (name, slug, description, sort_order) VALUES
  ('Keripik & Chips',    'keripik-chips',   'Keripik singkong, kentang, tempe, dan sejenisnya', 1),
  ('Coklat & Permen',    'coklat-permen',   'Aneka coklat, permen, dan produk konfeksioneri',   2),
  ('Biskuit & Wafer',    'biskuit-wafer',   'Biskuit, wafer, cookies, dan crackers',             3),
  ('Kacang & Biji',      'kacang-biji',     'Kacang tanah, mete, almond, kuaci, dan sejenisnya',4),
  ('Minuman Ringan',     'minuman-ringan',  'Minuman kemasan, jus, teh, kopi sachet',            5),
  ('Snack Sehat',        'snack-sehat',     'Granola, oat bar, buah kering, dan snack diet',     6),
  ('Mie & Bubur Instan', 'mie-instan',      'Mie instan, bubur instan, dan bihun',               7),
  ('Bumbu & Saus',       'bumbu-saus',      'Bumbu sachet, saus sambal, kecap, dan sejenisnya',  8);

-- Default admin user (password: Admin123! — GANTI DI PRODUCTION)
INSERT INTO users (email, password, name, role) VALUES
  ('admin@snackhub.id',
   crypt('Admin123!', gen_salt('bf', 12)),
   'Super Admin',
   'admin');


-- ============================================================
-- VIEWS — Untuk query yang sering dipakai
-- ============================================================

-- View: Info toko + user lengkap
CREATE VIEW v_stores_full AS
SELECT
  cs.*,
  u.email,
  u.name       AS user_name,
  u.last_login,
  c.name       AS city_name,
  p.name       AS province_name
FROM customer_stores cs
JOIN users u ON u.id = cs.user_id
LEFT JOIN cities c ON c.id = cs.city_id
LEFT JOIN provinces p ON p.id = cs.province_id;

-- View: Order summary lengkap
CREATE VIEW v_orders_summary AS
SELECT
  o.*,
  cs.store_name,
  cs.tier       AS store_tier,
  u.name        AS customer_name,
  u.email       AS customer_email,
  COUNT(oi.id)  AS total_items,
  SUM(oi.qty_karton) AS total_karton
FROM orders o
JOIN customer_stores cs ON cs.id = o.store_id
JOIN users u ON u.id = cs.user_id
LEFT JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id, cs.store_name, cs.tier, u.name, u.email;

-- View: Stok produk dengan info harga per tier
CREATE VIEW v_products_with_prices AS
SELECT
  p.*,
  c.name AS category_name,
  (SELECT json_object_agg(pt.tier, pt.price_per_karton)
   FROM price_tiers pt
   WHERE pt.product_id = p.id AND pt.is_active = true
  ) AS prices_by_tier
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
WHERE p.is_active = true;

-- View: Outstanding credit per toko
CREATE VIEW v_credit_outstanding AS
SELECT
  cs.id AS store_id,
  cs.store_name,
  cs.tier,
  cs.credit_limit,
  cs.credit_used,
  cs.credit_limit - cs.credit_used AS credit_available,
  COUNT(o.id) FILTER (WHERE o.payment_status = 'overdue') AS overdue_orders,
  SUM(o.total - o.total_paid) FILTER (WHERE o.payment_status IN ('unpaid','partial','overdue')) AS total_outstanding
FROM customer_stores cs
LEFT JOIN orders o ON o.store_id = cs.id AND o.is_credit_order = true
WHERE cs.status = 'approved'
GROUP BY cs.id, cs.store_name, cs.tier, cs.credit_limit, cs.credit_used;


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_stores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_tiers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger     ENABLE ROW LEVEL SECURITY;

-- Admin & staff: akses penuh
CREATE POLICY "admin_full_access_users"          ON users           FOR ALL USING (auth.jwt() ->> 'role' IN ('admin','staff'));
CREATE POLICY "admin_full_access_stores"         ON customer_stores FOR ALL USING (auth.jwt() ->> 'role' IN ('admin','staff'));
CREATE POLICY "admin_full_access_orders"         ON orders          FOR ALL USING (auth.jwt() ->> 'role' IN ('admin','staff'));
CREATE POLICY "admin_full_access_payments"       ON payments        FOR ALL USING (auth.jwt() ->> 'role' IN ('admin','staff'));
CREATE POLICY "admin_full_access_credit_ledger"  ON credit_ledger   FOR ALL USING (auth.jwt() ->> 'role' IN ('admin','staff'));

-- Customer: hanya bisa lihat data sendiri
CREATE POLICY "customer_own_store"    ON customer_stores FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "customer_update_store" ON customer_stores FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "customer_own_orders"   ON orders          FOR SELECT USING (store_id IN (SELECT id FROM customer_stores WHERE user_id = auth.uid()));
CREATE POLICY "customer_own_payments" ON payments        FOR SELECT USING (store_id IN (SELECT id FROM customer_stores WHERE user_id = auth.uid()));
CREATE POLICY "customer_own_notifs"   ON notifications   FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "customer_own_credit"   ON credit_ledger   FOR SELECT USING (store_id IN (SELECT id FROM customer_stores WHERE user_id = auth.uid()));

-- Products: bisa dilihat semua user yang login, tapi hanya approved stores yang bisa lihat harga
CREATE POLICY "products_viewable"     ON products    FOR SELECT USING (is_active = true);
CREATE POLICY "price_tiers_approved"  ON price_tiers FOR SELECT USING (
  auth.jwt() ->> 'role' IN ('admin','staff') OR
  EXISTS (SELECT 1 FROM customer_stores WHERE user_id = auth.uid() AND status = 'approved')
);
