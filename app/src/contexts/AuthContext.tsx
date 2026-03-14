import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/auth';
import { CartProvider } from '@/hooks/useCart';
import type { User, LoginCredentials, RegisterData } from '@/types';

// ── Store type (minimal, sesuai response API) ─────────────────────────────────
interface CustomerStore {
  id: string;
  user_id: string;
  store_name: string;
  owner_name?: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'suspended';
  tier?: 'agent' | 'reseller';
  credit_limit?: number;
  credit_used?: number;
  ktp_photo_url?: string;
  store_photo_url?: string;
  whatsapp?: string;
  phone_store?: string;
  address_line?: string;
  store_type?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_name?: string;
  allowed_payment_methods?: string[];
  [key: string]: unknown;
}

interface AuthContextType {
  user: User | null;
  store: CustomerStore | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  hasRole: (roles: string[]) => boolean;
  updateUser: (updated: Partial<User>) => void;
  // FIX-01: expose refreshStore agar Onboarding.tsx bisa reload setelah update
  refreshStore: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// FIX-02: expose logout callback agar api.ts bisa trigger tanpa import circular
let globalLogout: (() => void) | null = null;
export function triggerLogout() {
  globalLogout?.();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [store, setStore] = useState<CustomerStore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const userData = await authService.getCurrentUser();
          setUser(userData.user);
          // FIX-03: simpan store ke state saat init
          if ((userData as any).store) {
            setStore((userData as any).store);
          }
        } catch {
          localStorage.removeItem('token');
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  useEffect(() => {
    globalLogout = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('cart');
      setUser(null);
      setStore(null);
      navigate('/login');
    };
    return () => { globalLogout = null; };
  }, [navigate]);

  // FIX-04: tambah catch + throw agar error dari API bisa ditangkap Login.tsx
  // Sebelumnya hanya try/finally tanpa catch — error ditelan diam-diam di beberapa edge case
  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const response = await authService.login(credentials);

      if (!response.token) {
        throw new Error('Token tidak diterima dari server. Coba lagi.');
      }

      localStorage.setItem('token', response.token);
      setUser(response.user);

      // FIX-05: simpan store ke state setelah login (customer)
      if ((response as any).store) {
        setStore((response as any).store);
      }

      if (response.user.role === 'admin' || response.user.role === 'staff') {
        navigate('/admin/dashboard');
      } else if (response.user.role === 'salesman') {
        navigate('/salesman/dashboard');
      } else if (response.user.role === 'supplier' || response.user.role === 'customer') {
        navigate('/supplier/dashboard');
      }
    } catch (err) {
      // FIX-04: re-throw agar Login.tsx bisa menampilkan pesan error
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    setIsLoading(true);
    try {
      const response = await authService.register(data);

      if (!response.token) {
        throw new Error('Registrasi berhasil tapi token tidak diterima. Silakan login manual.');
      }

      localStorage.setItem('token', response.token);
      setUser(response.user);

      if ((response as any).store) {
        setStore((response as any).store);
      }

      if (response.user.role === 'supplier' || response.user.role === 'customer') {
        navigate('/supplier/dashboard');
      }
    } catch (err) {
      // FIX-04: re-throw agar Register.tsx bisa menampilkan pesan error
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('cart');
    setUser(null);
    setStore(null);
    navigate('/login');
  };

  const hasRole = (roles: string[]) => {
    return user ? roles.includes(user.role) : false;
  };

  const updateUser = (updated: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...updated } : prev);
  };

  // FIX-01: refreshStore dipanggil Onboarding setelah upload dokumen / submit review
  const refreshStore = async () => {
    try {
      const userData = await authService.getCurrentUser();
      if ((userData as any).store) {
        setStore((userData as any).store);
      }
    } catch {
      // silent — jika gagal, state store tetap yang lama
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        store,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        hasRole,
        updateUser,
        refreshStore,
      }}
    >
      <CartProvider>
        {children}
      </CartProvider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
