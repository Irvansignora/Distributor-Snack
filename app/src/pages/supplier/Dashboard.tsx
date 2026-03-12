import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { orderService } from '@/services/orders';
import { paymentService } from '@/services/payments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingBag,
  Package,
  CreditCard,
  Clock,
  CheckCircle,
  ArrowRight,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';

export default function SupplierDashboard() {
  const { data: ordersData } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => orderService.getOrders({ limit: 5 }),
  });

  // BUG-12 FIX: gunakan data payments untuk tampilkan status pembayaran pending
  const { data: paymentsData } = useQuery({
    queryKey: ['my-payments'],
    queryFn: () => paymentService.getPayments({ limit: 5 }),
  });

  const pendingOrders = ordersData?.orders.filter(o => o.status === 'pending').length || 0;
  const completedOrders = ordersData?.orders.filter(o => o.status === 'completed').length || 0;
  const totalSpent = ordersData?.orders
    .filter(o => o.status === 'completed')
    .reduce((sum, o) => sum + o.total, 0) || 0;

  // BUG-12 FIX: hitung payment pending
  const pendingPayments = paymentsData?.payments.filter(p => p.status === 'pending').length || 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6 p-4 lg:p-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Selamat Datang 👋</h1>
        <p className="text-muted-foreground">
          Ini ringkasan belanja dan aktivitas akun kamu.
        </p>
      </div>

      {/* BUG-12 FIX: tampilkan notifikasi pembayaran pending */}
      {pendingPayments > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Anda memiliki <strong>{pendingPayments} pembayaran</strong> yang menunggu verifikasi admin.
          </p>
          <Button size="sm" variant="outline" asChild className="ml-auto flex-shrink-0">
            <NavLink to="/supplier/invoices">Lihat</NavLink>
          </Button>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pesanan</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ordersData?.orders.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{pendingOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{completedOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Belanja</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalSpent)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Button asChild className="h-auto py-4 flex flex-col items-center gap-2">
          <NavLink to="/supplier/catalog">
            <ShoppingBag className="h-6 w-6" />
            <span>Belanja Sekarang</span>
          </NavLink>
        </Button>
        <Button variant="outline" asChild className="h-auto py-4 flex flex-col items-center gap-2">
          <NavLink to="/supplier/orders">
            <Package className="h-6 w-6" />
            <span>Pesanan Saya</span>
          </NavLink>
        </Button>
        <Button variant="outline" asChild className="h-auto py-4 flex flex-col items-center gap-2">
          <NavLink to="/supplier/invoices">
            <CreditCard className="h-6 w-6" />
            <span>Invoice</span>
          </NavLink>
        </Button>
        <Button variant="outline" asChild className="h-auto py-4 flex flex-col items-center gap-2">
          <NavLink to="/supplier/profile">
            <TrendingUp className="h-6 w-6" />
            <span>Profil Saya</span>
          </NavLink>
        </Button>
      </div>

      {/* Pesanan Terbaru */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Pesanan Terbaru</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <NavLink to="/supplier/orders">
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </NavLink>
          </Button>
        </CardHeader>
        <CardContent>
          {ordersData?.orders.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Belum ada pesanan</p>
              <Button asChild className="mt-4">
                <NavLink to="/supplier/catalog">Mulai Belanja</NavLink>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {ordersData?.orders.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium">#{order.order_number || order.id.slice(0, 8)}</p>
                    <p className="text-sm text-muted-foreground">
                      {order.created_at ? format(new Date(order.created_at), 'MMM dd, yyyy') : '-'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={
                      order.status === 'completed' ? 'default' :
                      order.status === 'pending' ? 'secondary' :
                      order.status === 'cancelled' ? 'destructive' :
                      'outline'
                    }>
                      {order.status}
                    </Badge>
                    <span className="font-medium">{formatCurrency(order.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
