import api from './api';
import type { Product, Category } from '@/types';

interface ProductsResponse {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ProductResponse {
  product: Product;
}

interface CategoriesResponse {
  categories: Category[];
}

export const productService = {
  async getProducts(params?: {
    category?: string;
    search?: string;
    low_stock?: boolean;
    page?: number;
    limit?: number;
  }): Promise<ProductsResponse> {
    const response = await api.get<ProductsResponse>('/products', { params });
    return response.data;
  },

  async getProduct(id: string): Promise<ProductResponse> {
    const response = await api.get<ProductResponse>(`/products/${id}`);
    return response.data;
  },

  async createProduct(formData: FormData): Promise<ProductResponse> {
    const response = await api.post<ProductResponse>('/products', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async updateProduct(id: string, formData: FormData): Promise<ProductResponse> {
    const response = await api.put<ProductResponse>(`/products/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async deleteProduct(id: string): Promise<void> {
    await api.delete(`/products/${id}`);
  },

  async getCategories(): Promise<CategoriesResponse> {
    const response = await api.get<CategoriesResponse>('/categories');
    return response.data;
  },

  async createCategory(data: { name: string; description?: string }): Promise<{ category: Category }> {
    const response = await api.post<{ category: Category }>('/categories', data);
    return response.data;
  },
};
