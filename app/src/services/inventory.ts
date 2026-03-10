import api from './api';
import type { StockHistory, Product } from '@/types';

interface InventoryResponse {
  inventory: Product[];
  summary: {
    total: number;
    lowStock: number;
    outOfStock: number;
  };
}

interface StockHistoryResponse {
  history: StockHistory[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface AdjustStockData {
  product_id: string;
  type: 'incoming' | 'outgoing' | 'adjustment';
  quantity: number;
  reason: string;
  warehouse_id?: string;
}

export const inventoryService = {
  async getInventory(): Promise<InventoryResponse> {
    const response = await api.get<InventoryResponse>('/inventory');
    return response.data;
  },

  async adjustStock(data: AdjustStockData): Promise<{ message: string; history: StockHistory; new_quantity: number }> {
    const response = await api.post<{ message: string; history: StockHistory; new_quantity: number }>('/inventory/adjust', data);
    return response.data;
  },

  async getStockHistory(params?: {
    product_id?: string;
    page?: number;
    limit?: number;
  }): Promise<StockHistoryResponse> {
    const response = await api.get<StockHistoryResponse>('/inventory/history', { params });
    return response.data;
  },
};
