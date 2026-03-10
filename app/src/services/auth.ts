import api from './api';
import type { User, LoginCredentials, RegisterData } from '@/types';

interface AuthResponse {
  token: string;
  user: User;
}

interface UserResponse {
  user: User;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    return response.data;
  },

  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  async getCurrentUser(): Promise<UserResponse> {
    const response = await api.get<UserResponse>('/auth/me');
    return response.data;
  },

  logout(): void {
    localStorage.removeItem('token');
  },
};
