import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { salesmanService } from '@/services/salesman';
import { productService } from '@/services/products';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  ArrowLeft,
  Search,
  Plus,
  Minus,
  ShoppingCart,
  Store,
  Package,
  AlertTriangle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

interface CartEntry {
  product_id: string;
  name: string;
  sku: string;
  qty_karton: number;
  price_per_karton: number;
  stock_karton: number;
  image_url?: string;
}

export default function SalesmanNewOrder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedStoreId = searchParams.get('store');

  const [selectedStoreId, setSelectedStoreId] = useState(preselectedStoreId || '');
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('transfer');
  const [isCredit] = useState(false);
  const [productSheetOpen, setProductSheetOpen] = useState(false);
  const [successOrder, setSuccessOrder] = useState<string | null>(null);

  // Fetch stores
  const { data: storesData } = useQuery({
    queryKey: ['salesman-stores'],
    queryFn: () => salesmanService.getStores(),
  });

  // Fetch store detail (for tier pricing)
  const { data: storeDetail } = useQuery({
    queryKey: ['salesman-store-detail', selectedStoreId],
    queryFn: () => salesmanService.getStoreDetail(selectedStoreId),
    enabled: !!selectedStoreId,
  });

  // Fetch products
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products-salesman', search],
    queryFn: () => productService.getProducts({ search, limit: 50 }),
    staleTime: 60_000,
  });

  const orderMutation = useMutation({
    mutationFn: () => salesmanService.createOrder({
      store_id: selectedStoreId,
      items: cart.map(c => ({ product_id: c.product_id, qty_karton: c.qty_karton })),
      notes,
      payment_method: paymentMethod,
      is_credit: isCredit,
    }),
    onSuccess: (res) => {
      setSuccessOrder(res.order.order_number);
      setCart([]);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal membuat order'),
  });

  const store = storesData?.stores.find(s => s.id === selectedStoreId);
  const storeTier = storeDetail?.store?.tier || 'reseller';

  const getProductPrice = (product: any) => {
    const tier = product.price_tiers?.find((t: any) => t.tier === storeTier);
    return tier?.price_per_karton || product.price_tiers?.[0]?.price_per_karton || 0;
  };

  const addToCart = (product: any) => {
    const price = getProductPrice(product);
    setCart(prev => {
      const existing = prev.find(c => c.product_id === product.id);
      if (existing) {
        return prev.map(c => c.product_id === product.id
          ? { ...c, qty_karton: c.qty_karton + 1 }
          : c
        );
      }
      return [...prev, {
        product_id: product.id,
        name: product.name,
        sku: product.sku,
        qty_karton: 1,
        price_per_karton: price,
        stock_karton: product.stock_karton || 0,
        image_url: product.image_url,
      }];
    });
  };

  const updateQty = (product_id: string, delta: number) => {
    setCart(prev => prev
      .map(c => c.product_id === product_id ? { ...c, qty_karton: c.qty_karton + delta } : c)
      .filter(c => c.qty_karton > 0)
    );
  };

  const subtotal = cart.reduce((s, c) => s + c.qty_karton * c.price_per_karton, 0);
  const products = productsData?.products || [];

  if (successOrder) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <h2 className="text-xl font-bold mb-1">Order Berhasil!</h2>
        <p className="text-muted-foreground mb-1">Nomor Order:</p>
        <p className="text-lg font-bold text-orange-500 mb-6">{successOrder}</p>
        <div className="flex gap-3 w-full max-w-xs">
          <Button variant="outline" className="flex-1" onClick={() => navigate('/salesman/stores')}>
            Ke Daftar Toko
          </Button>
          <Button
            className="flex-1 bg-orange-500 hover:bg-orange-600"
            onClick={() => { setSuccessOrder(null); }}
          >
            Order Lagi
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="font-bold text-base">Buat Order Baru</h1>
          <p className="text-xs text-muted-foreground">Input pesanan dari toko</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4 space-y-4">
          {/* Select Store */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Pilih Toko *</Label>
            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih toko..." />
              </SelectTrigger>
              <SelectContent>
                {(storesData?.stores || []).map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      <Store className="h-3.5 w-3.5" />
                      <span>{s.store_name}</span>
                      <Badge variant="outline" className="text-[10px] ml-1">{s.tier}</Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {store && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Package className="h-3 w-3" />
                Tier: <strong>{storeTier}</strong> — harga akan menyesuaikan tier
              </div>
            )}
            {store && store.ar_percentage >= 70 && (
              <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded text-xs">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-amber-700 dark:text-amber-300">
                  Piutang {store.ar_percentage}% — {formatCurrency(store.credit_used)} dari {formatCurrency(store.credit_limit)}
                </span>
              </div>
            )}
          </div>

          {/* Cart */}
          {cart.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Keranjang ({cart.length} produk)</Label>
                <button onClick={() => setCart([])} className="text-xs text-destructive">Hapus semua</button>
              </div>
              <div className="space-y-2">
                {cart.map(item => (
                  <Card key={item.product_id} className="shadow-none border">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(item.price_per_karton)}/krt</p>
                          {item.stock_karton <= 10 && item.stock_karton > 0 && (
                            <p className="text-[10px] text-amber-500">⚠ Stok tinggal {item.stock_karton} krt</p>
                          )}
                          {item.stock_karton === 0 && (
                            <p className="text-[10px] text-destructive">⚠ Stok habis</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQty(item.product_id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-sm font-bold">{item.qty_karton}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQty(item.product_id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-2 pt-2 border-t">
                        <span className="text-xs text-muted-foreground">{item.qty_karton} × {formatCurrency(item.price_per_karton)}</span>
                        <span className="text-sm font-bold">{formatCurrency(item.qty_karton * item.price_per_karton)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Add products button */}
          <Button
            variant="outline"
            className="w-full border-dashed border-orange-300 text-orange-500 hover:bg-orange-50"
            onClick={() => setProductSheetOpen(true)}
            disabled={!selectedStoreId}
          >
            <Plus className="mr-2 h-4 w-4" />
            {cart.length === 0 ? 'Tambah Produk' : 'Tambah Produk Lagi'}
          </Button>

          {/* Payment & Notes */}
          {cart.length > 0 && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm">Metode Pembayaran</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">Transfer Bank</SelectItem>
                    <SelectItem value="tunai">Tunai</SelectItem>
                    <SelectItem value="tempo">Tempo (Kredit)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Catatan Order</Label>
                <Textarea
                  placeholder="Catatan khusus untuk order ini..."
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Order Summary Footer */}
      {cart.length > 0 && (
        <div className="sticky bottom-16 left-0 right-0 bg-background border-t px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{cart.reduce((s, c) => s + c.qty_karton, 0)} karton • {cart.length} produk</p>
              <p className="text-lg font-bold">{formatCurrency(subtotal)}</p>
            </div>
            <Button
              className="bg-orange-500 hover:bg-orange-600 h-11 px-6"
              disabled={!selectedStoreId || orderMutation.isPending}
              onClick={() => orderMutation.mutate()}
            >
              {orderMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Proses...</>
              ) : (
                <><ShoppingCart className="mr-2 h-4 w-4" />Submit Order</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Product Sheet */}
      <Sheet open={productSheetOpen} onOpenChange={setProductSheetOpen}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
          <SheetHeader className="pb-3">
            <SheetTitle>Pilih Produk</SheetTitle>
            <SheetDescription>Tier toko: <strong>{storeTier}</strong></SheetDescription>
          </SheetHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari produk..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {productsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>
            ) : (
              <div className="grid grid-cols-1 gap-2 pb-4">
                {products.filter(p => p.is_active).map(product => {
                  const price = getProductPrice(product);
                  const inCart = cart.find(c => c.product_id === product.id);
                  const stockLow = (product.stock_karton || 0) <= 10;
                  const stockOut = (product.stock_karton || 0) === 0;

                  return (
                    <Card
                      key={product.id}
                      className={cn('shadow-none', stockOut && 'opacity-60')}
                    >
                      <CardContent className="p-3 flex items-center gap-3">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-12 h-12 rounded object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.sku}</p>
                          {price > 0 && <p className="text-xs font-semibold text-orange-600">{formatCurrency(price)}/krt</p>}
                          <div className="flex items-center gap-1 mt-0.5">
                            {stockOut && <Badge variant="destructive" className="text-[10px] px-1 py-0">Habis</Badge>}
                            {!stockOut && stockLow && <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-amber-100 text-amber-700">Tipis: {product.stock_karton} krt</Badge>}
                            {!stockOut && !stockLow && <span className="text-[10px] text-green-600">Stok: {product.stock_karton} krt</span>}
                          </div>
                        </div>
                        {inCart ? (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <Button variant="outline" size="icon" className="h-7 w-7"
                              onClick={() => updateQty(product.id, -1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center text-sm font-bold">{inCart.qty_karton}</span>
                            <Button variant="outline" size="icon" className="h-7 w-7"
                              onClick={() => updateQty(product.id, 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            className="h-7 px-2.5 bg-orange-500 hover:bg-orange-600 flex-shrink-0"
                            disabled={stockOut}
                            onClick={() => addToCart(product)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Tambah
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
