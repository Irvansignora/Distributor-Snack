import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { orderService } from '@/services/orders';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Package, Truck, CheckCircle, XCircle, Clock, Send, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { OrderStatus } from '@/types';

const statusOptions: { value: OrderStatus; label: string; icon: React.ElementType }[] = [
  { value: 'pending',   label: 'Pending',   icon: Clock },
  { value: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { value: 'packing',   label: 'Packing',   icon: Package },
  { value: 'shipped',   label: 'Shipped',   icon: Truck },
  { value: 'delivered', label: 'Delivered', icon: Package },
  { value: 'completed', label: 'Completed', icon: CheckCircle },
  { value: 'cancelled', label: 'Cancelled', icon: XCircle },
];

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [trackingNumber, setTrackingNumber] = useState('');
  const [courierInput, setCourierInput] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: () => orderService.getOrder(id!),
    enabled: !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ status, notes }: { status: OrderStatus; notes?: string }) =>
      orderService.updateStatus(id!, status, notes),
    onSuccess: () => { toast.success('Status pesanan diperbarui'); refetch(); },
    onError: () => { toast.error('Gagal memperbarui status'); },
  });

  const updateTrackingMutation = useMutation({
    mutationFn: () => api.patch(`/orders/${id}/tracking`, {
      tracking_number: trackingNumber.trim(),
      courier: courierInput.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success('Nomor resi berhasil disimpan & notif dikirim ke pelanggan');
      setTrackingNumber('');
      setCourierInput('');
      refetch();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal menyimpan resi'),
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Memuat detail pesanan...</p>
        </div>
      </div>
    );
  }

  const order = data?.order;
  if (!order) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Package className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Pesanan tidak ditemukan</h2>
        <Button onClick={() => navigate('/admin/orders')}>
          <ArrowLeft className="mr-2 h-4 w-4" />Kembali ke Daftar Pesanan
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/admin/orders')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Order #{order.order_number || order.id.slice(0, 8)}
          </h1>
          <p className="text-muted-foreground">
            {order.created_at ? format(new Date(order.created_at), 'MMMM dd, yyyy HH:mm') : '-'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader><CardTitle>Order Items</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.order_items?.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      {item.product?.image_url ? (
                        <img src={item.product.image_url} alt={item.product_name} className="w-16 h-16 rounded-lg object-cover" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                          <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(item.qty_karton ?? item.quantity ?? 0)} karton × {formatCurrency(item.price_per_karton ?? item.unit_price ?? 0)}
                        </p>
                      </div>
                    </div>
                    <p className="font-bold">{formatCurrency(item.subtotal ?? item.total_price ?? 0)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader><CardTitle>Order Timeline</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Order Placed</p>
                    <p className="text-sm text-muted-foreground">
                      {order.created_at ? format(new Date(order.created_at), 'MMM dd, yyyy HH:mm') : '-'}
                    </p>
                  </div>
                </div>
                {order.approved_at && (
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="font-medium">Order Approved</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(order.approved_at), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                )}
                {(order as any).tracking_number && (
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <Truck className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-medium">Dikirim</p>
                      <p className="text-sm text-muted-foreground">
                        {(order as any).courier && <span className="font-medium">{(order as any).courier} — </span>}
                        Resi: <span className="font-mono font-bold">{(order as any).tracking_number}</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Summary */}
          <Card>
            <CardHeader><CardTitle>Order Summary</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatCurrency(order.tax)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-4 border-t">
                <span>Total</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Customer Info */}
          <Card>
            <CardHeader><CardTitle>Customer Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Company</p>
                <p className="font-medium">{order.users?.company_name || order.users?.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{order.users?.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Shipping Address</p>
                <p className="font-medium">{order.shipping_address || 'Not provided'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Update Status */}
          <Card>
            <CardHeader><CardTitle>Update Status</CardTitle></CardHeader>
            <CardContent>
              <Select
                value={order.status}
                onValueChange={(value) => updateStatusMutation.mutate({ status: value as OrderStatus })}
                disabled={updateStatusMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
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
            </CardContent>
          </Card>

          {/* Tracking Resi */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Nomor Resi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(order as any).tracking_number && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-0.5">Resi saat ini</p>
                  <p className="font-mono font-bold text-blue-800 dark:text-blue-300">
                    {(order as any).tracking_number}
                  </p>
                  {(order as any).courier && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                      Kurir: {(order as any).courier}
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-xs">Kurir (opsional)</Label>
                <Input placeholder="JNE / TIKI / SiCepat..." value={courierInput}
                  onChange={e => setCourierInput(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Nomor Resi *</Label>
                <Input placeholder="Masukkan nomor resi..." value={trackingNumber}
                  onChange={e => setTrackingNumber(e.target.value)} />
              </div>
              <Button className="w-full" size="sm"
                disabled={!trackingNumber.trim() || updateTrackingMutation.isPending}
                onClick={() => updateTrackingMutation.mutate()}>
                {updateTrackingMutation.isPending
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <Send className="mr-2 h-4 w-4" />}
                Simpan & Notif Pelanggan
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
