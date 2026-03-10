import api from './api';
import type { ChartData, Product } from '@/types';

interface StatsResponse {
  todaySales: number;
  monthSales: number;
  todayOrders: number;
  pendingOrders: number;
  lowStockCount: number;
  totalSuppliers: number;
  totalProducts: number;
}

interface ChartResponse {
  data: ChartData[];
}

interface TopProductsResponse {
  products: Product[];
}

export const dashboardService = {
  async getStats(): Promise<StatsResponse> {
    const response = await api.get<StatsResponse>('/dashboard/stats');
    return response.data;
  },

  async getChartData(period: '7d' | '30d' = '7d'): Promise<ChartResponse> {
    const response = await api.get<ChartResponse>('/dashboard/chart', { params: { period } });
    return response.data;
  },

  async getTopProducts(): Promise<TopProductsResponse> {
    const response = await api.get<TopProductsResponse>('/dashboard/top-products');
    return response.data;
  },
};
