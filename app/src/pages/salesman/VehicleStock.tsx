import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesmanService } from '@/services/salesman';
import { productService } from '@/services/products';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Truck,
  Package,
  Plus,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { VehicleStock } from '@/services/salesman';

export default function VehicleStockPage() {
  const today = new Date().toISOString().split('T')[0];
  const [loadSheetOpen, setLoadSheetOpen] = useState(false);
  const [opnameTarget, setOpnameTarget] = useState<VehicleStock | null>(null);
  const [opnameData, setOpnameData] = useState({ qty_sold: '', qty_returned: '', notes: '' });
  const [loadItems, setLoadItems] = useState<Record<string, number>>({});
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['vehicle-stock', today],
    queryFn: () => salesmanService.getVehicleStock(today),
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-salesman', ''],
    queryFn: () => productService.getProducts({ limit: 100 }),
  });

  const loadMutation = useMutation({
    mutationFn: () => {
      const items = Object.entries(loadItems)
        .filter(([, qty]) => qty > 0)
        .map(([product_id, qty_loaded]) => ({ product_id, qty_loaded: qty_loaded }));
      if (!items.length) throw new Error('Pilih minimal 1 produk');
      return salesmanService.loadVehicleStock(items, today);
    },
    onSuccess: () => {
      toast.success('Stok kendaraan berhasil dimuat');
      setLoadSheetOpen(false);
      setLoadItems({});
      qc.invalidateQueries({ queryKey: ['vehicle-stock'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal memuat stok'),
  });

  const opnameMutation = useMutation({
    mutationFn: () => {
      if (!opnameTarget) throw new Error('no target');
      return salesmanService.opnameStock(opnameTarget.id, {
        qty_sold: parseInt(opnameData.qty_sold) || 0,
        qty_returned: parseInt(opnameData.qty_returned) || 0,
        notes: opnameData.notes,
      });
    },
    onSuccess: () => {
      toast.success('Opname berhasil dicatat');
      setOpnameTarget(null);
      qc.invalidateQueries({ queryKey: ['vehicle-stock'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal opname'),
  });

  const stocks = data?.stocks || [];
  const products = productsData?.products || [];
  const totalLoaded = stocks.reduce((s, v) => s + v.qty_loaded, 0);
  const totalSold = stocks.reduce((s, v) => s + v.qty_sold, 0);
  const totalRemaining = stocks.reduce((s, v) => s + (v.qty_remaining ?? 0), 0);

  return (
    <div className="px-4 pt-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Stok Kendaraan</h1>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Button
          size="sm"
          className="bg-orange-500 hover:bg-orange-600 h-8"
          onClick={() => setLoadSheetOpen(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Muat Stok
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Dimuat', value: totalLoaded, color: 'text-blue-600' },
          { label: 'Terjual', value: totalSold, color: 'text-green-600' },
          { label: 'Sisa', value: totalRemaining, color: 'text-orange-600' },
        ].map(s => (
          <Card key={s.label} className="shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground">karton</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-7 w-7 animate-spin text-orange-500" />
        </div>
      ) : stocks.length === 0 ? (
        <div className="text-center py-16">
          <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Belum ada stok dimuat hari ini</p>
          <p className="text-sm text-muted-foreground mb-4">Muat stok dari gudang di pagi hari</p>
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600"
            onClick={() => setLoadSheetOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Muat Stok Sekarang
          </Button>
        </div>
      ) : (
        <div className="space-y-3 pb-4">
          <h2 className="text-sm font-semibold text-muted-foreground">Produk di Kendaraan</h2>
          {stocks.map((stock) => {
            const remaining = stock.qty_remaining ?? (stock.qty_loaded - stock.qty_sold - stock.qty_returned);
            const doneOpname = !!stock.qty_sold || !!stock.qty_returned;
            return (
              <Card key={stock.id} className={cn('shadow-sm', doneOpname && 'border-green-200')}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {stock.products?.image_url ? (
                      <img src={stock.products.image_url} alt={stock.products.name} className="w-10 h-10 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium">{stock.products?.name}</p>
                          <p className="text-xs text-muted-foreground">{stock.products?.sku}</p>
                        </div>
                        {doneOpname && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
                      </div>

                      <div className="flex items-center gap-3 mt-2 text-xs">
                        <span className="text-muted-foreground">Muat: <strong className="text-foreground">{stock.qty_loaded}</strong></span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-green-600">Jual: <strong>{stock.qty_sold}</strong></span>
                        <span className="text-muted-foreground">Sisa: <strong className={remaining > 0 ? 'text-orange-600' : 'text-muted-foreground'}>{remaining}</strong></span>
                      </div>
                    </div>
                  </div>

                  {!doneOpname && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-3 h-7 text-xs border-dashed"
                      onClick={() => {
                        setOpnameTarget(stock);
                        setOpnameData({
                          qty_sold: String(stock.qty_sold || ''),
                          qty_returned: String(stock.qty_returned || ''),
                          notes: '',
                        });
                      }}
                    >
                      <ClipboardCheck className="h-3 w-3 mr-1.5" />
                      Input Opname
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Load Stock Sheet */}
      <Sheet open={loadSheetOpen} onOpenChange={setLoadSheetOpen}>
        <SheetContent side="bottom" className="h-[80vh] overflow-y-auto">
          <SheetHeader className="pb-3">
            <SheetTitle>Muat Stok Kendaraan</SheetTitle>
          </SheetHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Masukkan jumlah karton yang kamu bawa dari gudang hari ini:</p>
            {products.filter(p => p.is_active).map(product => (
              <div key={product.id} className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">Stok gudang: {product.stock_karton || 0} krt</p>
                </div>
                <Input
                  type="number"
                  min="0"
                  className="w-20 h-8 text-center"
                  value={loadItems[product.id] || ''}
                  placeholder="0"
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setLoadItems(prev => val > 0 ? { ...prev, [product.id]: val } : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== product.id)));
                  }}
                />
                <span className="text-xs text-muted-foreground w-5">krt</span>
              </div>
            ))}
            <Button
              className="w-full bg-orange-500 hover:bg-orange-600"
              onClick={() => loadMutation.mutate()}
              disabled={loadMutation.isPending || Object.keys(loadItems).length === 0}
            >
              {loadMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</> : 'Simpan Stok Kendaraan'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Opname Dialog */}
      <Dialog open={!!opnameTarget} onOpenChange={(o) => !o && setOpnameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Opname Stok</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Produk: <strong>{opnameTarget?.products?.name}</strong> ({opnameTarget?.qty_loaded} krt dimuat)
            </p>
            <div className="space-y-2">
              <Label>Jumlah Terjual (karton)</Label>
              <Input
                type="number"
                min="0"
                max={opnameTarget?.qty_loaded}
                value={opnameData.qty_sold}
                onChange={(e) => setOpnameData(d => ({ ...d, qty_sold: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Jumlah Dikembalikan ke Gudang</Label>
              <Input
                type="number"
                min="0"
                value={opnameData.qty_returned}
                onChange={(e) => setOpnameData(d => ({ ...d, qty_returned: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                placeholder="Catatan opname..."
                rows={2}
                value={opnameData.notes}
                onChange={(e) => setOpnameData(d => ({ ...d, notes: e.target.value }))}
              />
            </div>
            {opnameData.qty_sold && opnameData.qty_returned && (
              <div className="p-3 bg-muted rounded text-sm">
                Sisa stok di kendaraan: <strong>
                  {(opnameTarget?.qty_loaded || 0) - (parseInt(opnameData.qty_sold) || 0) - (parseInt(opnameData.qty_returned) || 0)}
                </strong> krt
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpnameTarget(null)}>Batal</Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              onClick={() => opnameMutation.mutate()}
              disabled={opnameMutation.isPending}
            >
              {opnameMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Simpan Opname
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
