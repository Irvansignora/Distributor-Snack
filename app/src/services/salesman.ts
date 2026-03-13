import api from './api';

export interface SalesmanDashboard {
  today: { visits: number };
  month: {
    visits: number;
    orders: number;
    revenue: number;
    payment_collected: number;
    achievement_pct: number;
    estimated_commission: number;
  };
  target: {
    target_revenue: number;
    target_visits: number;
    commission_rate: number;
    bonus_threshold: number;
    bonus_amount: number;
  } | null;
  stores_assigned: number;
  total_ar: number;
}

export interface SalesmanStore {
  id: string;
  store_name: string;
  owner_name: string;
  name: string;
  email: string;
  phone_store?: string;
  whatsapp?: string;
  address_line: string;
  status: string;
  tier: string;
  credit_limit: number;
  credit_used: number;
  ar_percentage: number;
  last_visit_at?: string;
  days_since_visit?: number | null;
  route_order?: number;
  latitude?: number;
  longitude?: number;
}

export interface StoreVisit {
  id: string;
  salesman_id: string;
  store_id: string;
  checkin_at: string;
  checkin_lat?: number;
  checkin_lng?: number;
  checkout_at?: string;
  visit_result: string;
  notes?: string;
  order_id?: string;
  payment_collected: number;
  customer_stores?: { store_name: string; owner_name: string; address_line: string };
  orders?: { order_number: string; total: number; status: string } | null;
}

export interface VehicleStock {
  id: string;
  salesman_id: string;
  product_id: string;
  date: string;
  qty_loaded: number;
  qty_sold: number;
  qty_returned: number;
  qty_remaining: number;
  products?: { id: string; name: string; sku: string; image_url?: string; unit_type?: string };
}

export interface Performance {
  achievement: {
    salesman_id: string;
    salesman_name: string;
    period_month: number;
    period_year: number;
    target_revenue: number;
    target_visits: number;
    actual_revenue: number;
    actual_orders: number;
    actual_visits: number;
    active_days: number;
    achievement_pct: number;
    estimated_commission: number;
    commission_rate: number;
    bonus_threshold: number;
    bonus_amount: number;
  } | null;
  daily: { date: string; visits: number; revenue: number; payment: number }[];
}

export const salesmanService = {
  async getDashboard(): Promise<SalesmanDashboard> {
    const { data } = await api.get('/salesman/dashboard');
    return data;
  },

  async getStores(params?: { search?: string; status?: string }): Promise<{ stores: SalesmanStore[] }> {
    const { data } = await api.get('/salesman/stores', { params });
    return data;
  },

  async getStoreDetail(id: string) {
    const { data } = await api.get(`/salesman/stores/${id}`);
    return data;
  },

  async createOrder(payload: {
    store_id: string;
    items: { product_id: string; qty_karton: number }[];
    notes?: string;
    payment_method?: string;
    is_credit?: boolean;
  }) {
    const { data } = await api.post('/salesman/orders', payload);
    return data;
  },

  async checkin(payload: { store_id: string; lat?: number; lng?: number; photo_url?: string }) {
    const { data } = await api.post('/salesman/checkin', payload);
    return data;
  },

  async checkout(visitId: string, payload: {
    lat?: number;
    lng?: number;
    visit_result: string;
    notes?: string;
    order_id?: string;
    payment_collected?: number;
  }) {
    const { data } = await api.patch(`/salesman/visits/${visitId}/checkout`, payload);
    return data;
  },

  async getVisits(params?: { date?: string; store_id?: string }): Promise<{ visits: StoreVisit[] }> {
    const { data } = await api.get('/salesman/visits', { params });
    return data;
  },

  async getVehicleStock(date?: string): Promise<{ stocks: VehicleStock[]; date: string }> {
    const { data } = await api.get('/salesman/vehicle-stock', { params: { date } });
    return data;
  },

  async loadVehicleStock(items: { product_id: string; qty_loaded: number }[], date?: string) {
    const { data } = await api.post('/salesman/vehicle-stock/load', { items, date });
    return data;
  },

  async opnameStock(id: string, payload: { qty_sold: number; qty_returned: number; notes?: string }) {
    const { data } = await api.patch(`/salesman/vehicle-stock/${id}/opname`, payload);
    return data;
  },

  async getPerformance(month?: number, year?: number): Promise<Performance> {
    const { data } = await api.get('/salesman/performance', { params: { month, year } });
    return data;
  },
};

// Admin salesman management
export const adminSalesmanService = {
  async getSalesmen() {
    const { data } = await api.get('/admin/salesmen');
    return data;
  },

  async setTarget(payload: {
    salesman_id: string;
    period_month: number;
    period_year: number;
    target_revenue: number;
    target_visits?: number;
    commission_rate?: number;
    bonus_threshold?: number;
    bonus_amount?: number;
    notes?: string;
  }) {
    const { data } = await api.post('/admin/salesman-targets', payload);
    return data;
  },

  async assignStore(store_id: string, salesman_id: string | null) {
    const { data } = await api.post('/admin/assign-store', { store_id, salesman_id });
    return data;
  },

  async getVisits(params?: { salesman_id?: string; date?: string; page?: number }) {
    const { data } = await api.get('/admin/visits', { params });
    return data;
  },
};
