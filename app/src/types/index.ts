export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'staff' | 'supplier';
  company_name?: string;
  phone?: string;
  address?: string;
  credit_limit?: number;
  current_credit?: number;
  status: 'active' | 'inactive' | 'suspended';
  created_at?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role: 'supplier';
  company_name?: string;
  phone?: string;
  address?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  is_active: boolean;
  created_at?: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  description?: string;
  category_id?: string;
  category?: Category;
  price: number;
  wholesale_price: number;
  wholesale_price_tier2?: number;
  stock_quantity: number;
  reorder_level: number;
  unit: string;
  weight?: number;
  image_url?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  unit?: string;
  product?: Product;
}

export type OrderStatus = 'pending' | 'approved' | 'packed' | 'shipped' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded';

export interface Order {
  id: string;
  order_number?: string;
  supplier_id: string;
  supplier?: User;
  users?: User; // For joined queries from API
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  notes?: string;
  shipping_address?: string;
  tracking_number?: string;
  approved_by?: string;
  approved_at?: string;
  shipped_at?: string;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
  order_items?: OrderItem[];
}

export interface Payment {
  id: string;
  order_id: string;
  order?: Order;
  supplier_id: string;
  supplier?: User;
  users?: User; // For joined queries from API
  amount: number;
  payment_method: 'bank_transfer' | 'cash' | 'check' | 'credit' | 'other';
  proof_url?: string;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  approved_by?: string;
  approved_at?: string;
  created_at?: string;
}

export interface StockHistory {
  id: string;
  product_id: string;
  product?: Product;
  warehouse_id?: string;
  type: 'incoming' | 'outgoing' | 'adjustment' | 'transfer';
  quantity: number;
  previous_quantity?: number;
  new_quantity?: number;
  reason?: string;
  created_by?: string;
  created_at?: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address?: string;
  manager_name?: string;
  phone?: string;
  is_active: boolean;
}

export interface Notification {
  id: string;
  user_id?: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  is_read: boolean;
  created_at?: string;
}

export interface DashboardStats {
  todaySales: number;
  monthSales: number;
  todayOrders: number;
  pendingOrders: number;
  lowStockCount: number;
  totalSuppliers: number;
  totalProducts: number;
}

export interface ChartData {
  date: string;
  sales: number;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  receipt_url?: string;
  created_by?: string;
  created_at?: string;
}
