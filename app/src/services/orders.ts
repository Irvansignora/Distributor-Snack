import api from './api';
import type { Order, OrderStatus } from '@/types';

interface OrdersResponse {
  orders: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface OrderResponse {
  order: Order;
}

interface CreateOrderData {
  items: { product_id: string; qty_karton?: number; quantity?: number }[];
  notes?: string;
  shipping_address?: Record<string, any> | string;
  payment_method?: string;
  courier?: string;
  courier_service?: string;
  promo_code?: string;
  use_credit?: boolean;
}

export const orderService = {
  async getOrders(params?: {
    status?: string;
    supplier_id?: string;
    page?: number;
    limit?: number;
  }): Promise<OrdersResponse> {
    const response = await api.get<OrdersResponse>('/orders', { params });
    return response.data;
  },

  async getOrder(id: string): Promise<OrderResponse> {
    const response = await api.get<OrderResponse>(`/orders/${id}`);
    return response.data;
  },

  async createOrder(data: CreateOrderData): Promise<{ message: string; order: Order }> {
    const response = await api.post<{ message: string; order: Order }>('/orders', data);
    return response.data;
  },

  async updateStatus(id: string, status: OrderStatus, notes?: string): Promise<OrderResponse> {
    const response = await api.patch<OrderResponse>(`/orders/${id}/status`, { status, notes });
    return response.data;
  },
};
