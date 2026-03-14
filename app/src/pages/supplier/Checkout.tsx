import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { orderService } from '@/services/orders';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Package, MapPin, CreditCard, CheckCircle, Loader2,
  Banknote, Truck, HandCoins, Clock, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface PaymentMethodDef {
  id: string;
  label: string;
  desc: string;
  icon: React.ElementType;
  agentOnly: boolean;
  badgeLabel?: string;
  badgeColor?: string;
}

const ALL_PAYMENT_METHODS: PaymentMethodDef[] = [
  {
    id: 'bank_transfer',
    label: 'Transfer Bank',
    desc: 'Transfer ke rekening distributor. Bukti transfer dikonfirmasi oleh admin.',
    icon: Banknote,
    agentOnly: false,
  },
  {
    id: 'cod',
    label: 'COD — Bayar di Tempat',
    desc: 'Bayar tunai saat barang diterima. Tersedia untuk wilayah tertentu.',
    icon: Truck,
    agentOnly: false,
  },
  {
    id: 'consignment',
    label: 'Konsinyasi',
    desc: 'Barang dititipkan, pembayaran dilakukan setelah barang terjual.',
    icon: HandCoins,
    agentOnly: true,
    badgeLabel: 'Agent Only',
    badgeColor: 'bg-emerald-100 text-emerald-700',
  },
  {
    id: 'top_14',
    label: 'TOP 14 Hari',
    desc: 'Term of Payment — bayar paling lambat 14 hari setelah barang diterima.',
    icon: Clock,
    agentOnly: true,
    badgeLabel: 'Agent Only',
    badgeColor: 'bg-emerald-100 text-emerald-700',
  },
  {
    id: 'top_30',
    label: 'TOP 30 Hari',
    desc: 'Term of Payment — bayar paling lambat 30 hari setelah barang diterima.',
    icon: Clock,
    agentOnly: true,
    badgeLabel: 'Agent Only',
    badgeColor: 'bg-emerald-100 text-emerald-700',
  },
];

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, clearCart } = useCart();
  const { user, store } = useAuth();

  const userTier = store?.tier || 'reseller';
  const allowedMethods: string[] = store?.allowed_payment_methods?.length
    ? store.allowed_payment_methods
    : ['bank_transfer', 'cod'];

  const availableMethods = ALL_PAYMENT_METHODS.filter(m => allowedMethods.includes(m.id));

  const [shippingAddress, setShippingAddress] = useState(store?.address_line || user?.address || '');
  const [paymentMethod, setPaymentMethod] = useState(availableMethods[0]?.id || 'bank_transfer');

  const notes = location.state?.notes || '';
  const subtotal: number = location.state?.subtotal ?? items.reduce(
    (sum, item) => sum + item.quantity * (item.product.wholesale_price || item.product.price), 0
  );
  const tax: number = location.state?.tax ?? 0;
  const grandTotal: number = location.state?.grandTotal ?? subtotal;
  const taxPercent: number = location.state?.taxPercent ?? 0;

  const createOrderMutation = useMutation({
    mutationFn: orderService.createOrder,
    onSuccess: () => {
      toast.success('Pesanan berhasil dibuat!');
      clearCart();
      navigate('/supplier/orders');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Gagal membuat pesanan');
    },
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) { toast.error('Keranjang belanja kosong'); return; }
    if (!shippingAddress.trim()) { toast.error('Alamat pengiriman wajib diisi'); return; }
    if (!paymentMethod) { toast.error('Pilih metode pembayaran'); return; }

    createOrderMutation.mutate({
      items: items.map(item => ({ product_id: item.product.id, qty_karton: item.quantity })),
      payment_method: paymentMethod,
      notes,
      shipping_address: { address: shippingAddress },
    });
  };

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
        <Package className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Keranjang kosong</h1>
        <Button onClick={() => navigate('/supplier/catalog')}>Browse Catalog</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/supplier/cart')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Checkout</h1>
          <p className="text-muted-foreground">Review dan konfirmasi pesanan Anda</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">

          {/* ── Alamat ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Alamat Pengiriman
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="address">Alamat Lengkap *</Label>
                <Textarea
                  id="address"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Masukkan alamat pengiriman lengkap"
                  required
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Metode Pembayaran ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Metode Pembayaran
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Info tier badge */}
              <div className={cn(
                'flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm border',
                userTier === 'agent'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              )}>
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  Akun <strong className="capitalize">{userTier}</strong> —{' '}
                  {userTier === 'agent'
                    ? 'Anda dapat menggunakan semua metode pembayaran.'
                    : 'Tersedia Transfer Bank & COD. Upgrade ke Agent untuk akses Konsinyasi & TOP.'}
                </span>
              </div>

              {/* Pilihan metode */}
              <div className="space-y-2">
                {availableMethods.map((method) => {
                  const Icon = method.icon;
                  const isSelected = paymentMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setPaymentMethod(method.id)}
                      className={cn(
                        'w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all duration-150',
                        isSelected
                          ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-sm'
                          : 'border-border hover:border-primary/50 hover:bg-muted/40'
                      )}
                    >
                      {/* Radio */}
                      <div className={cn(
                        'mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all',
                        isSelected ? 'border-primary' : 'border-muted-foreground/40'
                      )}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>

                      <Icon className={cn(
                        'h-5 w-5 flex-shrink-0 mt-0.5',
                        isSelected ? 'text-primary' : 'text-muted-foreground'
                      )} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className={cn(
                            'font-medium text-sm',
                            isSelected ? 'text-primary' : 'text-foreground'
                          )}>
                            {method.label}
                          </span>
                          {method.badgeLabel && (
                            <span className={cn(
                              'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                              method.badgeColor
                            )}>
                              {method.badgeLabel}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {method.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}

                {availableMethods.length === 0 && (
                  <div className="p-4 border rounded-xl text-center text-muted-foreground text-sm">
                    Tidak ada metode pembayaran tersedia. Hubungi admin.
                  </div>
                )}
              </div>

              {/* Info rekening toko (untuk transfer) */}
              {paymentMethod === 'bank_transfer' && store?.bank_name && (
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-sm space-y-0.5">
                  <p className="font-semibold text-blue-800 dark:text-blue-300 text-xs uppercase tracking-wide mb-1">Rekening Toko Anda</p>
                  <p className="text-blue-800 dark:text-blue-300 font-medium">{store.bank_name}</p>
                  <p className="text-blue-700 dark:text-blue-400 font-mono">{store.bank_account_number}</p>
                  <p className="text-blue-600 dark:text-blue-500 text-xs">a.n. {store.bank_account_name}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Item Pesanan ── */}
          <Card>
            <CardHeader>
              <CardTitle>Item Pesanan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.map(({ product, quantity }) => (
                  <div key={product.id} className="flex items-center gap-4">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-16 h-16 rounded-lg object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {quantity} x {formatCurrency(product.wholesale_price || product.price)}
                      </p>
                    </div>
                    <p className="font-bold">
                      {formatCurrency((product.wholesale_price || product.price) * quantity)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Ringkasan ── */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Ringkasan Pesanan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    PPN {taxPercent > 0 ? `(${taxPercent}%)` : ''}
                  </span>
                  <span>{formatCurrency(tax)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              {paymentMethod && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-muted-foreground text-xs mb-0.5">Metode Pembayaran</p>
                  <p className="font-medium text-sm">
                    {ALL_PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label || paymentMethod}
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={createOrderMutation.isPending || availableMethods.length === 0}
              >
                {createOrderMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memproses...</>
                ) : (
                  <><CheckCircle className="mr-2 h-4 w-4" />Buat Pesanan</>
                )}
              </Button>

              <Button type="button" variant="outline" className="w-full" onClick={() => navigate('/supplier/cart')}>
                Kembali ke Keranjang
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
