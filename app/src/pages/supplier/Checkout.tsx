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
import { ArrowLeft, Package, MapPin, CreditCard, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, clearCart } = useCart();
  const { user } = useAuth();
  const [shippingAddress, setShippingAddress] = useState(user?.address || '');

  // BUG-01 FIX: ambil tax info yang dikirim dari Cart.tsx via location.state
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      toast.error('Keranjang belanja kosong');
      return;
    }

    if (!shippingAddress.trim()) {
      toast.error('Alamat pengiriman wajib diisi');
      return;
    }

    // BUG-01 FIX: kirim tax ke backend agar tersimpan dengan benar
    createOrderMutation.mutate({
      items: items.map(item => ({
        product_id: item.product.id,
        qty_karton: item.quantity,
      })),
      payment_method: 'bank_transfer',
      notes,
      shipping_address: { address: shippingAddress },
    });
  };

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
        <Package className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Keranjang kosong</h1>
        <Button onClick={() => navigate('/supplier/catalog')}>
          Browse Catalog
        </Button>
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Metode Pembayaran
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="font-medium">Transfer Bank</p>
                <p className="text-sm text-muted-foreground">
                  Instruksi pembayaran akan dikirim setelah pesanan dikonfirmasi
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Item Pesanan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.map(({ product, quantity }) => (
                  <div key={product.id} className="flex items-center gap-4">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
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

        {/* BUG-01 FIX: tampilkan ringkasan dengan tax yang konsisten dari Cart */}
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

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={createOrderMutation.isPending}
              >
                {createOrderMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Buat Pesanan
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => navigate('/supplier/cart')}
              >
                Kembali ke Keranjang
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
