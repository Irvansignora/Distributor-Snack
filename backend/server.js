import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, subDays, subMonths } from 'date-fns';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('FATAL: SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET must be set in environment variables');
  process.exit(1);
}

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Authentication Middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Role-based access control
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// ==================== AUTH ROUTES ====================

// Register
app.post('/api/auth/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('name').trim().isLength({ min: 2 }),
    body('role').isIn(['admin', 'supplier', 'staff']),
    body('company_name').optional().trim()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name, role, company_name, phone, address } = req.body;

    try {
      // Check if user exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const { data: user, error } = await supabase
        .from('users')
        .insert([{
          id: uuidv4(),
          email,
          password: hashedPassword,
          name,
          role,
          company_name,
          phone,
          address,
          status: 'active',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      // Generate JWT
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          company_name: user.company_name
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// Login
app.post('/api/auth/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').exists()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      // Get user
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check status
      if (user.status !== 'active') {
        return res.status(403).json({ error: 'Account is not active' });
      }

      // Update last login
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      // Generate JWT
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          company_name: user.company_name,
          phone: user.phone,
          address: user.address,
          credit_limit: user.credit_limit,
          current_credit: user.current_credit
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, role, company_name, phone, address, credit_limit, current_credit, status, created_at')
      .eq('id', req.user.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ==================== PRODUCT ROUTES ====================

// Get all products (with filters)
app.get('/api/products', authenticateToken, async (req, res) => {
  const { category, search, low_stock, page = 1, limit = 20 } = req.query;

  try {
    let query = supabase
      .from('products')
      .select('*, categories(name)', { count: 'exact' })
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category_id', category);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (low_stock === 'true') {
      query = query.lte('stock_quantity', 'reorder_level');
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: products, error, count } = await query;

    if (error) throw error;

    res.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to get products' });
  }
});

// Get single product
app.get('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const { data: product, error } = await supabase
      .from('products')
      .select('*, categories(*), stock_history(*)')
      .eq('id', req.params.id)
      .single();

    if (error || !product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ product });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get product' });
  }
});

// Create product (Admin only)
app.post('/api/products',
  authenticateToken,
  requireRole(['admin', 'staff']),
  upload.single('image'),
  async (req, res) => {
    try {
      const {
        name, sku, description, category_id,
        price, wholesale_price, wholesale_price_tier2,
        stock_quantity, reorder_level, unit, weight
      } = req.body;

      let image_url = null;

      // Upload image if provided
      if (req.file) {
        const fileExt = path.extname(req.file.originalname);
        const fileName = `${uuidv4()}${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('products')
          .upload(fileName, req.file.buffer, {
            contentType: req.file.mimetype
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('products')
          .getPublicUrl(fileName);

        image_url = publicUrl;
      }

      const { data: product, error } = await supabase
        .from('products')
        .insert([{
          id: uuidv4(),
          name,
          sku,
          description,
          category_id,
          price: parseFloat(price),
          wholesale_price: parseFloat(wholesale_price),
          wholesale_price_tier2: wholesale_price_tier2 ? parseFloat(wholesale_price_tier2) : null,
          stock_quantity: parseInt(stock_quantity) || 0,
          reorder_level: parseInt(reorder_level) || 10,
          unit,
          weight: weight ? parseFloat(weight) : null,
          image_url,
          is_active: true,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      // Add stock history entry
      if (parseInt(stock_quantity) > 0) {
        await supabase.from('stock_history').insert([{
          id: uuidv4(),
          product_id: product.id,
          type: 'incoming',
          quantity: parseInt(stock_quantity),
          reason: 'Initial stock',
          created_by: req.user.userId,
          created_at: new Date().toISOString()
        }]);
      }

      res.status(201).json({ product });
    } catch (error) {
      console.error('Create product error:', error);
      res.status(500).json({ error: 'Failed to create product' });
    }
  }
);

// Update product
app.put('/api/products/:id',
  authenticateToken,
  requireRole(['admin', 'staff']),
  upload.single('image'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      // Handle numeric fields
      if (updateData.price) updateData.price = parseFloat(updateData.price);
      if (updateData.wholesale_price) updateData.wholesale_price = parseFloat(updateData.wholesale_price);
      if (updateData.stock_quantity) updateData.stock_quantity = parseInt(updateData.stock_quantity);
      if (updateData.reorder_level) updateData.reorder_level = parseInt(updateData.reorder_level);

      // Upload new image if provided
      if (req.file) {
        const fileExt = path.extname(req.file.originalname);
        const fileName = `${uuidv4()}${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('products')
          .upload(fileName, req.file.buffer, {
            contentType: req.file.mimetype
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('products')
          .getPublicUrl(fileName);

        updateData.image_url = publicUrl;
      }

      updateData.updated_at = new Date().toISOString();

      const { data: product, error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      res.json({ product });
    } catch (error) {
      console.error('Update product error:', error);
      res.status(500).json({ error: 'Failed to update product' });
    }
  }
);

// Delete product (soft delete)
app.delete('/api/products/:id',
  authenticateToken,
  requireRole(['admin']),
  async (req, res) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', req.params.id);

      if (error) throw error;

      res.json({ message: 'Product deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete product' });
    }
  }
);

// ==================== CATEGORY ROUTES ====================

app.get('/api/categories', authenticateToken, async (req, res) => {
  try {
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    res.json({ categories });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

app.post('/api/categories',
  authenticateToken,
  requireRole(['admin', 'staff']),
  async (req, res) => {
    try {
      const { name, description } = req.body;

      const { data: category, error } = await supabase
        .from('categories')
        .insert([{
          id: uuidv4(),
          name,
          description,
          is_active: true,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({ category });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create category' });
    }
  }
);

// ==================== INVENTORY ROUTES ====================

// Get inventory status
app.get('/api/inventory', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, sku, stock_quantity, reorder_level, unit, image_url')
      .eq('is_active', true)
      .order('stock_quantity', { ascending: true });

    if (error) throw error;

    const lowStock = products.filter(p => p.stock_quantity <= p.reorder_level);
    const outOfStock = products.filter(p => p.stock_quantity === 0);

    res.json({
      inventory: products,
      summary: {
        total: products.length,
        lowStock: lowStock.length,
        outOfStock: outOfStock.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get inventory' });
  }
});

// Stock adjustment
app.post('/api/inventory/adjust',
  authenticateToken,
  requireRole(['admin', 'staff']),
  async (req, res) => {
    try {
      const { product_id, type, quantity, reason, warehouse_id } = req.body;

      // Get current stock
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', product_id)
        .single();

      if (productError || !product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // Calculate new quantity
      let newQuantity = product.stock_quantity;
      if (type === 'incoming') {
        newQuantity += parseInt(quantity);
      } else if (type === 'outgoing') {
        newQuantity -= parseInt(quantity);
      } else if (type === 'adjustment') {
        newQuantity = parseInt(quantity);
      }

      if (newQuantity < 0) {
        return res.status(400).json({ error: 'Insufficient stock' });
      }

      // Update product stock
      const { error: updateError } = await supabase
        .from('products')
        .update({ 
          stock_quantity: newQuantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', product_id);

      if (updateError) throw updateError;

      // Add stock history
      const { data: history, error: historyError } = await supabase
        .from('stock_history')
        .insert([{
          id: uuidv4(),
          product_id,
          warehouse_id: warehouse_id || null,
          type,
          quantity: parseInt(quantity),
          previous_quantity: product.stock_quantity,
          new_quantity: newQuantity,
          reason,
          created_by: req.user.userId,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (historyError) throw historyError;

      res.json({ 
        message: 'Stock adjusted successfully',
        history,
        new_quantity: newQuantity
      });
    } catch (error) {
      console.error('Stock adjustment error:', error);
      res.status(500).json({ error: 'Failed to adjust stock' });
    }
  }
);

// Get stock history
app.get('/api/inventory/history', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  const { product_id, page = 1, limit = 20 } = req.query;

  try {
    let query = supabase
      .from('stock_history')
      .select('*, products(name, sku), users(name)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (product_id) {
      query = query.eq('product_id', product_id);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: history, error, count } = await query;

    if (error) throw error;

    res.json({
      history,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stock history' });
  }
});

// ==================== ORDER ROUTES ====================

// Get all orders
app.get('/api/orders', authenticateToken, async (req, res) => {
  const { status, supplier_id, page = 1, limit = 20 } = req.query;

  try {
    let query = supabase
      .from('orders')
      .select('*, users(name, company_name)', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Suppliers can only see their own orders
    if (req.user.role === 'supplier') {
      query = query.eq('supplier_id', req.user.userId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (supplier_id && req.user.role !== 'supplier') {
      query = query.eq('supplier_id', supplier_id);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: orders, error, count } = await query;

    if (error) throw error;

    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// Get single order
app.get('/api/orders/:id', authenticateToken, async (req, res) => {
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, users(name, company_name, email, phone, address), order_items(*, products(name, sku, image_url))')
      .eq('id', req.params.id)
      .single();

    if (error || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check permission
    if (req.user.role === 'supplier' && order.supplier_id !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ order });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get order' });
  }
});

// Create order (Supplier)
app.post('/api/orders',
  authenticateToken,
  requireRole(['supplier']),
  async (req, res) => {
    try {
      const { items, notes, shipping_address } = req.body;

      if (!items || items.length === 0) {
        return res.status(400).json({ error: 'Order items are required' });
      }

      // Calculate totals and validate stock
      let subtotal = 0;
      const orderItems = [];

      for (const item of items) {
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('id, name, price, wholesale_price, stock_quantity, unit')
          .eq('id', item.product_id)
          .single();

        if (productError || !product) {
          return res.status(404).json({ error: `Product not found: ${item.product_id}` });
        }

        if (product.stock_quantity < item.quantity) {
          return res.status(400).json({ 
            error: `Insufficient stock for ${product.name}. Available: ${product.stock_quantity}` 
          });
        }

        const unitPrice = product.wholesale_price || product.price;
        const itemTotal = unitPrice * item.quantity;
        subtotal += itemTotal;

        orderItems.push({
          product_id: product.id,
          product_name: product.name,
          quantity: item.quantity,
          unit_price: unitPrice,
          total_price: itemTotal,
          unit: product.unit
        });
      }

      const tax = subtotal * 0.1; // 10% tax
      const total = subtotal + tax;

      // Get user info for shipping
      const { data: user } = await supabase
        .from('users')
        .select('address')
        .eq('id', req.user.userId)
        .single();

      // Create order
      const orderId = uuidv4();
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          id: orderId,
          supplier_id: req.user.userId,
          status: 'pending',
          subtotal,
          tax,
          total,
          notes,
          shipping_address: shipping_address || user?.address,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItemsWithId = orderItems.map(item => ({
        id: uuidv4(),
        order_id: orderId,
        ...item,
        created_at: new Date().toISOString()
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsWithId);

      if (itemsError) throw itemsError;

      // Reserve stock (reduce available quantity)
      for (const item of items) {
        const { data: product } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', item.product_id)
          .single();

        await supabase
          .from('products')
          .update({ 
            stock_quantity: product.stock_quantity - item.quantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.product_id);

        // Add stock history
        await supabase.from('stock_history').insert([{
          id: uuidv4(),
          product_id: item.product_id,
          type: 'outgoing',
          quantity: item.quantity,
          reason: `Order #${orderId.slice(0, 8)}`,
          created_by: req.user.userId,
          created_at: new Date().toISOString()
        }]);
      }

      res.status(201).json({ 
        message: 'Order created successfully',
        order
      });
    } catch (error) {
      console.error('Create order error:', error);
      res.status(500).json({ error: 'Failed to create order' });
    }
  }
);

// Update order status (Admin/Staff)
app.patch('/api/orders/:id/status',
  authenticateToken,
  requireRole(['admin', 'staff']),
  async (req, res) => {
    try {
      const { status, notes } = req.body;
      const validStatuses = ['pending', 'approved', 'packed', 'shipped', 'completed', 'cancelled'];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const updateData = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'approved') {
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by = req.user.userId;
      } else if (status === 'shipped') {
        updateData.shipped_at = new Date().toISOString();
      } else if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { data: order, error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) throw error;

      // Add status history
      await supabase.from('order_status_history').insert([{
        id: uuidv4(),
        order_id: req.params.id,
        status,
        notes,
        created_by: req.user.userId,
        created_at: new Date().toISOString()
      }]);

      res.json({ order });
    } catch (error) {
      console.error('Update order status error:', error);
      res.status(500).json({ error: 'Failed to update order status' });
    }
  }
);

// ==================== SUPPLIER ROUTES ====================

// Get all suppliers (Admin/Staff only)
app.get('/api/suppliers',
  authenticateToken,
  requireRole(['admin', 'staff']),
  async (req, res) => {
    try {
      const { data: suppliers, error } = await supabase
        .from('users')
        .select('id, name, company_name, email, phone, address, credit_limit, current_credit, status, created_at')
        .eq('role', 'supplier')
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.json({ suppliers });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get suppliers' });
    }
  }
);

// Get supplier details with order history
app.get('/api/suppliers/:id',
  authenticateToken,
  requireRole(['admin', 'staff']),
  async (req, res) => {
    try {
      const { data: supplier, error } = await supabase
        .from('users')
        .select('id, name, company_name, email, phone, address, credit_limit, current_credit, status, created_at')
        .eq('id', req.params.id)
        .eq('role', 'supplier')
        .single();

      if (error || !supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      // Get order history
      const { data: orders } = await supabase
        .from('orders')
        .select('id, status, total, created_at')
        .eq('supplier_id', req.params.id)
        .order('created_at', { ascending: false });

      // Get total stats
      const { data: stats } = await supabase
        .from('orders')
        .select('total')
        .eq('supplier_id', req.params.id)
        .eq('status', 'completed');

      const totalSpent = stats?.reduce((sum, o) => sum + o.total, 0) || 0;

      res.json({
        supplier,
        orders: orders || [],
        stats: {
          totalOrders: orders?.length || 0,
          totalSpent,
          completedOrders: stats?.length || 0
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get supplier details' });
    }
  }
);

// Update supplier credit
app.patch('/api/suppliers/:id/credit',
  authenticateToken,
  requireRole(['admin']),
  async (req, res) => {
    try {
      const { credit_limit } = req.body;

      const { data: supplier, error } = await supabase
        .from('users')
        .update({ 
          credit_limit: parseFloat(credit_limit),
          updated_at: new Date().toISOString()
        })
        .eq('id', req.params.id)
        .eq('role', 'supplier')
        .select()
        .single();

      if (error) throw error;

      res.json({ supplier });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update credit limit' });
    }
  }
);

// ==================== PAYMENT ROUTES ====================

// Get payments
app.get('/api/payments', authenticateToken, async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  try {
    let query = supabase
      .from('payments')
      .select('*, orders(total), users(name, company_name)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (req.user.role === 'supplier') {
      query = query.eq('supplier_id', req.user.userId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: payments, error, count } = await query;

    if (error) throw error;

    res.json({
      payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get payments' });
  }
});

// Create payment (upload proof)
app.post('/api/payments',
  authenticateToken,
  requireRole(['supplier']),
  upload.single('proof'),
  async (req, res) => {
    try {
      const { order_id, amount, payment_method, notes } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'Payment proof is required' });
      }

      // Verify order belongs to supplier
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, supplier_id, total, status')
        .eq('id', order_id)
        .single();

      if (orderError || !order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      if (order.supplier_id !== req.user.userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Upload proof image
      const fileExt = path.extname(req.file.originalname);
      const fileName = `payment-${uuidv4()}${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('payments')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('payments')
        .getPublicUrl(fileName);

      // Create payment record
      const { data: payment, error } = await supabase
        .from('payments')
        .insert([{
          id: uuidv4(),
          order_id,
          supplier_id: req.user.userId,
          amount: parseFloat(amount),
          payment_method,
          proof_url: publicUrl,
          status: 'pending',
          notes,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({ payment });
    } catch (error) {
      console.error('Create payment error:', error);
      res.status(500).json({ error: 'Failed to create payment' });
    }
  }
);

// Approve/Reject payment (Admin)
app.patch('/api/payments/:id/status',
  authenticateToken,
  requireRole(['admin', 'staff']),
  async (req, res) => {
    try {
      const { status, notes } = req.body;

      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const { data: payment, error } = await supabase
        .from('payments')
        .update({
          status,
          notes: notes || null,
          approved_by: req.user.userId,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) throw error;

      // If approved, update order payment status
      if (status === 'approved') {
        await supabase
          .from('orders')
          .update({ 
            payment_status: 'paid',
            updated_at: new Date().toISOString()
          })
          .eq('id', payment.order_id);
      }

      res.json({ payment });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update payment status' });
    }
  }
);

// ==================== DASHBOARD & ANALYTICS ====================

// Get dashboard stats
app.get('/api/dashboard/stats', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const today = new Date();
    const todayStart = startOfDay(today).toISOString();
    const todayEnd = endOfDay(today).toISOString();
    const monthStart = startOfMonth(today).toISOString();
    const monthEnd = endOfMonth(today).toISOString();

    // Today's sales
    const { data: todayOrders } = await supabase
      .from('orders')
      .select('total')
      .eq('status', 'completed')
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd);

    const todaySales = todayOrders?.reduce((sum, o) => sum + o.total, 0) || 0;

    // Monthly sales
    const { data: monthOrders } = await supabase
      .from('orders')
      .select('total')
      .eq('status', 'completed')
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd);

    const monthSales = monthOrders?.reduce((sum, o) => sum + o.total, 0) || 0;

    // Total orders today
    const { count: todayOrderCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd);

    // Pending orders
    const { count: pendingOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Low stock products
    const { data: lowStockProducts } = await supabase
      .from('products')
      .select('id')
      .eq('is_active', true)
      .lte('stock_quantity', 'reorder_level');

    // Total suppliers
    const { count: totalSuppliers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'supplier')
      .eq('status', 'active');

    // Total products
    const { count: totalProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    res.json({
      todaySales,
      monthSales,
      todayOrders: todayOrderCount,
      pendingOrders,
      lowStockCount: lowStockProducts?.length || 0,
      totalSuppliers,
      totalProducts
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
});

// Get sales chart data
app.get('/api/dashboard/chart', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  const { period = '7d' } = req.query;

  try {
    const days = period === '30d' ? 30 : 7;
    const data = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const start = startOfDay(date).toISOString();
      const end = endOfDay(date).toISOString();

      const { data: orders } = await supabase
        .from('orders')
        .select('total')
        .eq('status', 'completed')
        .gte('created_at', start)
        .lte('created_at', end);

      const sales = orders?.reduce((sum, o) => sum + o.total, 0) || 0;

      data.push({
        date: format(date, 'MMM dd'),
        sales
      });
    }

    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get chart data' });
  }
});

// Get top products
app.get('/api/dashboard/top-products', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const { data: topProducts, error } = await supabase
      .from('order_items')
      .select('product_name, quantity, products(image_url)')
      .order('quantity', { ascending: false })
      .limit(5);

    if (error) throw error;

    res.json({ products: topProducts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get top products' });
  }
});

// ==================== REPORTS ====================

// Sales report
app.get('/api/reports/sales', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  const { start_date, end_date } = req.query;

  try {
    let query = supabase
      .from('orders')
      .select('*, users(name, company_name), order_items(*)')
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (start_date) {
      query = query.gte('created_at', start_date);
    }
    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    const { data: orders, error } = await query;

    if (error) throw error;

    const summary = {
      totalSales: orders?.reduce((sum, o) => sum + o.total, 0) || 0,
      totalOrders: orders?.length || 0,
      averageOrder: orders?.length ? orders.reduce((sum, o) => sum + o.total, 0) / orders.length : 0
    };

    res.json({ orders: orders || [], summary });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate sales report' });
  }
});

// Inventory report
app.get('/api/reports/inventory', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('*, categories(name)')
      .eq('is_active', true)
      .order('stock_quantity', { ascending: true });

    if (error) throw error;

    const summary = {
      totalProducts: products?.length || 0,
      lowStock: products?.filter(p => p.stock_quantity <= p.reorder_level).length || 0,
      outOfStock: products?.filter(p => p.stock_quantity === 0).length || 0,
      totalValue: products?.reduce((sum, p) => sum + (p.stock_quantity * p.price), 0) || 0
    };

    res.json({ products: products || [], summary });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate inventory report' });
  }
});

// ==================== NOTIFICATIONS ====================

// Get notifications
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(20);

    if (req.user.role === 'supplier') {
      query = query.eq('user_id', req.user.userId);
    }

    const { data: notifications, error } = await query;

    if (error) throw error;

    res.json({ notifications: notifications || [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Mark notification as read
app.patch('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
