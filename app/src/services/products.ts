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

  async importProducts(rows: Array<{
    name: string; sku: string; description?: string;
    pack_per_karton: number; pcs_per_pack?: number;
    stock_karton: number; reorder_level: number; weight_gram?: number;
    price_reseller: number; price_agent?: number;
    image_url?: string;
  }>): Promise<{ success: number; failed: number; errors: string[] }> {
    let success = 0; let failed = 0; const errors: string[] = [];
    for (const row of rows) {
      try {
        const fd = new FormData();
        fd.append('name', row.name);
        fd.append('sku', row.sku);
        if (row.description)    fd.append('description', row.description);
        fd.append('pack_per_karton', String(row.pack_per_karton));
        if (row.pcs_per_pack)   fd.append('pcs_per_pack', String(row.pcs_per_pack));
        fd.append('stock_karton', String(row.stock_karton));
        fd.append('reorder_level', String(row.reorder_level));
        if (row.weight_gram)    fd.append('weight_gram', String(row.weight_gram));
        if (row.image_url)      fd.append('image_url', row.image_url);
        fd.append('is_active', 'true');
        const tiers = [
          { tier: 'reseller', price_per_karton: row.price_reseller, min_karton: 1 },
          ...(row.price_agent ? [{ tier: 'agent', price_per_karton: row.price_agent, min_karton: 1 }] : []),
        ];
        fd.append('price_tiers', JSON.stringify(tiers));
        await api.post('/products', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        success++;
      } catch (e: any) {
        failed++;
        errors.push(`${row.sku}: ${e.response?.data?.error || e.message}`);
      }
    }
    return { success, failed, errors };
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
