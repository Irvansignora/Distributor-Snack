import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/auth';
import { CartProvider } from '@/hooks/useCart';
import type { User, LoginCredentials, RegisterData } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  hasRole: (roles: string[]) => boolean;
  updateUser: (updated: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// BUG-14 FIX: expose logout callback agar api.ts bisa trigger tanpa import circular
let globalLogout: (() => void) | null = null;
export function triggerLogout() {
  globalLogout?.();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const userData = await authService.getCurrentUser();
          setUser(userData.user);
        } catch {
          localStorage.removeItem('token');
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  // BUG-14 FIX: register global logout untuk dipakai api.ts interceptor
  useEffect(() => {
    globalLogout = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('cart'); // BUG-10 FIX
      setUser(null);
      navigate('/login');
    };
    return () => { globalLogout = null; };
  }, [navigate]);

  // BUG-04 FIX: error di-throw ke caller (Login.tsx sudah punya catch)
  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const response = await authService.login(credentials);
      localStorage.setItem('token', response.token);
      setUser(response.user);

      if (response.user.role === 'admin' || response.user.role === 'staff') {
        navigate('/admin/dashboard');
      } else if (response.user.role === 'salesman') {
        navigate('/salesman/dashboard');
      } else if (response.user.role === 'supplier' || response.user.role === 'customer') {
        navigate('/supplier/dashboard');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    setIsLoading(true);
    try {
      const response = await authService.register(data);
      localStorage.setItem('token', response.token);
      setUser(response.user);

      if (response.user.role === 'supplier' || response.user.role === 'customer') {
        navigate('/supplier/dashboard');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // BUG-10 FIX: cart di-clear saat logout
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('cart');
    setUser(null);
    navigate('/login');
  };

  const hasRole = (roles: string[]) => {
    return user ? roles.includes(user.role) : false;
  };

  // BUG-09 FIX: helper untuk update user state setelah profile save
  const updateUser = (updated: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...updated } : prev);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        hasRole,
        updateUser,
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
