import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { orderService } from '@/services/orders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Filter,
  Download,
  Eye,
  ClipboardList,
  CheckCircle,
  Package,
  Truck,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { OrderStatus } from '@/types';

const statusOptions: { value: OrderStatus | 'all'; label: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'Semua Status', icon: Filter },
  { value: 'pending', label: 'Pending', icon: ClipboardList },
  { value: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { value: 'packing', label: 'Packing', icon: Package },
  { value: 'shipped', label: 'Shipped', icon: Truck },
  { value: 'completed', label: 'Completed', icon: CheckCircle },
  { value: 'cancelled', label: 'Cancelled', icon: XCircle },
];

export default function Orders() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', status, page, search],
    queryFn: () => orderService.getOrders({
      status: status === 'all' ? undefined : status,
      page,
      limit: 10,
      // BUG-05 FIX: kirim search ke API
      supplier_id: search || undefined,
    }),
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20';
      case 'pending':
        return 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20';
      case 'confirmed':
        return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20';
      case 'packing':
        return 'bg-purple-500/10 text-purple-500 hover:bg-purple-500/20';
      case 'shipped':
        return 'bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20';
      case 'cancelled':
        return 'bg-red-500/10 text-red-500 hover:bg-red-500/20';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pesanan</h1>
          <p className="text-muted-foreground">
            Kelola dan pantau semua pesanan
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Ekspor
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari pesanan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus | 'all')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <option.icon className="h-4 w-4" />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">No. Pesanan</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Pelanggan</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Tanggal</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Pembayaran</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">Memuat...</td>
                  </tr>
                ) : data?.orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">Belum ada pesanan</h3>
                      <p className="text-muted-foreground">Pesanan akan muncul di sini saat pelanggan melakukan pembelian</p>
                    </td>
                  </tr>
                ) : (
                  data?.orders.map((order) => (
                    <tr key={order.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <span className="font-medium">#{order.order_number || order.id.slice(0, 8)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">{order.users?.company_name || order.users?.name}</p>
                          <p className="text-xs text-muted-foreground">{order.users?.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {order.created_at ? format(new Date(order.created_at), 'dd MMM yyyy HH:mm') : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={cn(getStatusColor(order.status))}>
                          {order.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'}>
                          {order.payment_status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button variant="ghost" size="sm" asChild>
                          <NavLink to={`/admin/orders/${order.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            Lihat
                          </NavLink>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data?.pagination && data.pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 p-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Sebelumnya
              </Button>
              <span className="flex items-center px-4 text-sm text-muted-foreground">
                Halaman {page} dari {data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                disabled={page === data.pagination.totalPages}
              >
                Berikutnya
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
