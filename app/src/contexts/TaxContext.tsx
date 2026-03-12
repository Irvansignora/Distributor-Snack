import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '@/services/api';

interface TaxContextType {
  taxRate: number; // desimal, misal 0.11 untuk 11%
  taxPercent: number; // persen, misal 11 untuk 11%
  isLoading: boolean;
  refetchTax: () => void;
}

const TaxContext = createContext<TaxContextType>({
  taxRate: 0.11,
  taxPercent: 11,
  isLoading: false,
  refetchTax: () => {},
});

const DEFAULT_TAX = 11; // 11% PPN default Indonesia

export function TaxProvider({ children }: { children: ReactNode }) {
  const [taxPercent, setTaxPercent] = useState<number>(DEFAULT_TAX);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTax = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await api.get('/settings/public');
      const ppn = res.data?.settings?.ppn_rate;
      if (ppn !== undefined && ppn !== null) {
        setTaxPercent(Number(ppn));
      }
    } catch {
      // fallback ke default
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTax();
  }, []);

  return (
    <TaxContext.Provider
      value={{
        taxRate: taxPercent / 100,
        taxPercent,
        isLoading,
        refetchTax: fetchTax,
      }}
    >
      {children}
    </TaxContext.Provider>
  );
}

export function useTax() {
  return useContext(TaxContext);
}
