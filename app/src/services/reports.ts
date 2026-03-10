import api from './api';
import type { Order, Product } from '@/types';

interface SalesReportResponse {
  orders: Order[];
  summary: {
    totalSales: number;
    totalOrders: number;
    averageOrder: number;
  };
}

interface InventoryReportResponse {
  products: Product[];
  summary: {
    totalProducts: number;
    lowStock: number;
    outOfStock: number;
    totalValue: number;
  };
}

export const reportService = {
  async getSalesReport(params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<SalesReportResponse> {
    const response = await api.get<SalesReportResponse>('/reports/sales', { params });
    return response.data;
  },

  async getInventoryReport(): Promise<InventoryReportResponse> {
    const response = await api.get<InventoryReportResponse>('/reports/inventory');
    return response.data;
  },
};
