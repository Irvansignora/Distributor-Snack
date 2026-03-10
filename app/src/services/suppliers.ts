import api from './api';
import type { User, Order } from '@/types';

interface SuppliersResponse {
  suppliers: User[];
}

interface SupplierDetailResponse {
  supplier: User;
  orders: Order[];
  stats: {
    totalOrders: number;
    totalSpent: number;
    completedOrders: number;
  };
}

export const supplierService = {
  async getSuppliers(): Promise<SuppliersResponse> {
    const response = await api.get<SuppliersResponse>('/suppliers');
    return response.data;
  },

  async getSupplier(id: string): Promise<SupplierDetailResponse> {
    const response = await api.get<SupplierDetailResponse>(`/suppliers/${id}`);
    return response.data;
  },

  async updateCredit(id: string, credit_limit: number): Promise<{ supplier: User }> {
    const response = await api.patch<{ supplier: User }>(`/suppliers/${id}/credit`, { credit_limit });
    return response.data;
  },
};
