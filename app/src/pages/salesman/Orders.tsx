import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { salesmanService } from '@/services/salesman';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, ShoppingCart, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

const statusConfig: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Menunggu',   color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  confirmed: { label: 'Dikonfirmasi', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  packing:   { label: 'Packing',    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  shipped:   { label: 'Dikirim',    color: 'bg-indigo-100 text-indigo-700' },
  delivered: { label: 'Terkirim',   color: 'bg-teal-100 text-teal-700' },
  completed: { label: 'Selesai',    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  cancelled: { label: 'Batal',      color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

export default function SalesmanOrders() {
  const { data: visitsData, isLoading } = useQuery({
    queryKey: ['salesman-visits'],
    queryFn: () => salesmanService.getVisits(),
  });

  // Extract orders from visits
  const visits = visitsData?.visits || [];
  const ordersFromVisits = visits.filter(v => v.order_id && v.orders);

  return (
    <div className="px-4 pt-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Riwayat Order</h1>
          <p className="text-xs text-muted-foreground">{ordersFromVisits.length} order dari kunjungan</p>
        </div>
        <NavLink to="/salesman/orders/new">
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 h-8">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Buat Order
          </Button>
        </NavLink>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-7 w-7 animate-spin text-orange-500" />
        </div>
      ) : ordersFromVisits.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Belum ada order</p>
          <p className="text-sm text-muted-foreground mb-4">Order yang kamu buat saat kunjungan akan muncul di sini</p>
          <NavLink to="/salesman/orders/new">
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Buat Order Pertama
            </Button>
          </NavLink>
        </div>
      ) : (
        <div className="space-y-3 pb-4">
          {ordersFromVisits.map((visit) => {
            const status = statusConfig[visit.orders?.status || 'pending'];
            return (
              <Card key={visit.id} className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm">{visit.orders?.order_number || '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {visit.customer_stores?.store_name}
                      </p>
                    </div>
                    <span className={cn('text-xs px-2 py-0.5 rounded font-medium', status.color)}>
                      {status.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {new Date(visit.checkin_at).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </p>
                    <p className="font-bold text-sm">{formatCurrency(visit.orders?.total || 0)}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
