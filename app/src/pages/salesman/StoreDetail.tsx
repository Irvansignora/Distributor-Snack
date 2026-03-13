import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesmanService } from '@/services/salesman';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  MapPin,
  Phone,
  CreditCard,
  ShoppingCart,
  Clock,
  CheckCircle2,
  LogOut,
  Banknote,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function SalesmanStoreDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const visitId = searchParams.get('visit');
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [checkoutOpen, setCheckoutOpen] = useState(!!visitId);
  const [checkoutData, setCheckoutData] = useState({
    visit_result: 'visited',
    notes: '',
    payment_collected: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['salesman-store-detail', id],
    queryFn: () => salesmanService.getStoreDetail(id!),
    enabled: !!id,
  });

  const checkoutMutation = useMutation({
    mutationFn: () => {
      if (!visitId) throw new Error('No visit');
      return salesmanService.checkout(visitId, {
        ...checkoutData,
        payment_collected: parseFloat(checkoutData.payment_collected) || 0,
      });
    },
    onSuccess: () => {
      toast.success('Check-out berhasil');
      setCheckoutOpen(false);
      qc.invalidateQueries({ queryKey: ['salesman-stores'] });
      qc.invalidateQueries({ queryKey: ['salesman-dashboard'] });
      navigate('/salesman/stores');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal check-out'),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const store = data?.store;
  const orders = data?.orders || [];
  const visits = data?.visits || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="px-4 pt-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-base truncate">{store?.store_name}</h1>
          <p className="text-xs text-muted-foreground">{store?.owner_name}</p>
        </div>
        {visitId && (
          <Button
            size="sm"
            variant="outline"
            className="border-orange-300 text-orange-600 h-8 text-xs"
            onClick={() => setCheckoutOpen(true)}
          >
            <LogOut className="h-3 w-3 mr-1" />
            Check-out
          </Button>
        )}
      </div>

      {/* Store Info */}
      <div className="px-4 space-y-3">
        <Card>
          <CardContent className="p-4 space-y-3">
            {store?.address_line && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-sm">{store.address_line}</p>
              </div>
            )}
            {(store?.phone_store || store?.whatsapp) && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm">{store?.whatsapp || store?.phone_store}</p>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{store?.tier}</Badge>
              <Badge variant={store?.status === 'approved' ? 'default' : 'secondary'} className="text-xs">
                {store?.status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* AR Card */}
        {store?.credit_limit > 0 && (
          <Card className={cn(
            'border',
            store.ar_percentage >= 90 ? 'border-destructive/50 bg-destructive/5' :
            store.ar_percentage >= 70 ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/20' :
            'border-green-200 bg-green-50 dark:bg-green-950/20'
          )}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CreditCard className={cn('h-4 w-4',
                    store.ar_percentage >= 70 ? 'text-amber-500' : 'text-green-500'
                  )} />
                  <span className="text-sm font-medium">Status Piutang</span>
                </div>
                <span className={cn('text-sm font-bold',
                  store.ar_percentage >= 90 ? 'text-destructive' :
                  store.ar_percentage >= 70 ? 'text-amber-600' : 'text-green-600'
                )}>
                  {store.ar_percentage}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                <div
                  className={cn('h-full rounded-full transition-all',
                    store.ar_percentage >= 90 ? 'bg-destructive' :
                    store.ar_percentage >= 70 ? 'bg-amber-500' : 'bg-green-500'
                  )}
                  style={{ width: `${Math.min(store.ar_percentage, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Hutang: {formatCurrency(store.credit_used)}</span>
                <span>Limit: {formatCurrency(store.credit_limit)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Order Button */}
        <Button
          className="w-full bg-orange-500 hover:bg-orange-600"
          onClick={() => navigate(`/salesman/orders/new?store=${id}`)}
        >
          <ShoppingCart className="mr-2 h-4 w-4" />
          Buat Order untuk Toko Ini
        </Button>

        {/* Order History */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Riwayat Order Terakhir</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {orders.length === 0 ? (
              <div className="px-4 pb-4 text-center">
                <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Belum ada order</p>
              </div>
            ) : (
              <div className="divide-y">
                {orders.map((order: any) => (
                  <div key={order.id} className="px-4 py-3">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="text-sm font-medium">{order.order_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{formatCurrency(order.total)}</p>
                        <span className={cn('text-[10px] rounded px-1.5 py-0.5', statusColors[order.status] || 'bg-gray-100 text-gray-600')}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                    {/* Items preview */}
                    {order.order_items?.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {order.order_items.slice(0, 2).map((item: any) => (
                          <span key={item.product_name} className="inline-block mr-1">
                            {item.product_name} ({item.qty_karton} krt)
                          </span>
                        ))}
                        {order.order_items.length > 2 && <span>+{order.order_items.length - 2} lagi</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Visit History */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Riwayat Kunjungan</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {visits.length === 0 ? (
              <div className="px-4 pb-4 text-center">
                <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Belum ada kunjungan</p>
              </div>
            ) : (
              <div className="divide-y">
                {visits.map((visit: any) => (
                  <div key={visit.id} className="px-4 py-3 flex items-start gap-3">
                    <CheckCircle2 className={cn('h-4 w-4 mt-0.5 flex-shrink-0',
                      visit.visit_result === 'order_taken' ? 'text-green-500' : 'text-muted-foreground'
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium">
                          {visit.visit_result === 'order_taken' ? '✅ Order diambil' :
                           visit.visit_result === 'no_order' ? '🔄 Tidak ada order' :
                           visit.visit_result === 'collect_payment' ? '💰 Tagih pembayaran' :
                           visit.visit_result === 'closed_store' ? '🔒 Toko tutup' :
                           '📍 Kunjungan'}
                        </p>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(visit.checkin_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      {visit.payment_collected > 0 && (
                        <p className="text-xs text-green-600 mt-0.5">+{formatCurrency(visit.payment_collected)}</p>
                      )}
                      {visit.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{visit.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={(o) => !o && setCheckoutOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check-out dari {store?.store_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Hasil Kunjungan</Label>
              <Select
                value={checkoutData.visit_result}
                onValueChange={(v) => setCheckoutData(d => ({ ...d, visit_result: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visited">Kunjungan biasa</SelectItem>
                  <SelectItem value="order_taken">✅ Order berhasil diambil</SelectItem>
                  <SelectItem value="no_order">🔄 Tidak ada order</SelectItem>
                  <SelectItem value="collect_payment">💰 Tagih pembayaran</SelectItem>
                  <SelectItem value="closed_store">🔒 Toko sedang tutup</SelectItem>
                  <SelectItem value="refused">❌ Toko menolak kunjungan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pembayaran Dikumpulkan (Rp)</Label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={checkoutData.payment_collected}
                onChange={(e) => setCheckoutData(d => ({ ...d, payment_collected: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                placeholder="Catatan kunjungan..."
                rows={3}
                value={checkoutData.notes}
                onChange={(e) => setCheckoutData(d => ({ ...d, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>Batal</Button>
            <Button
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {checkoutMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Proses...</> : 'Selesai Check-out'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
