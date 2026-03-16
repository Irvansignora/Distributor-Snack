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

interface ARReportResponse {
  stores: any[];
  summary: {
    total_stores: number;
    total_ar: number;
    total_overdue: number;
    overdue_stores: number;
  };
}

interface CommissionReportResponse {
  commissions: any[];
  summary: {
    total_salesman: number;
    total_revenue: number;
    total_commission: number;
    avg_achievement: number;
  };
  month: number;
  year: number;
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

  async getARReport(params?: { overdue_only?: boolean; tier?: string }): Promise<ARReportResponse> {
    const response = await api.get<ARReportResponse>('/reports/ar', { params });
    return response.data;
  },

  async getCommissionReport(month: number, year: number): Promise<CommissionReportResponse> {
    const response = await api.get<CommissionReportResponse>('/reports/salesman-commission', { params: { month, year } });
    return response.data;
  },
};

