import api from './api';
import type { Payment } from '@/types';

interface PaymentsResponse {
  payments: Payment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface CreatePaymentData {
  order_id: string;
  amount: number;
  payment_method: string;
  notes?: string;
}

export const paymentService = {
  async getPayments(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<PaymentsResponse> {
    const response = await api.get<PaymentsResponse>('/payments', { params });
    return response.data;
  },

  async createPayment(data: CreatePaymentData, proofFile: File): Promise<{ payment: Payment }> {
    const formData = new FormData();
    formData.append('order_id', data.order_id);
    formData.append('amount', data.amount.toString());
    formData.append('payment_method', data.payment_method);
    if (data.notes) {
      formData.append('notes', data.notes);
    }
    formData.append('proof', proofFile);

    const response = await api.post<{ payment: Payment }>('/payments', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async updateStatus(id: string, status: 'approved' | 'rejected', notes?: string): Promise<{ message: string }> {
    // Pakai endpoint /verify yang menangani kredit, partial payment, dan notifikasi WA
    const response = await api.patch<{ message: string }>(`/payments/${id}/verify`, {
      action: status === 'approved' ? 'verify' : 'reject',
      rejection_reason: notes,
    });
    return response.data;
  },
};
