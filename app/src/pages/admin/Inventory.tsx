import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { inventoryService } from '@/services/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Search,
  Package,
  AlertTriangle,
  Plus,
  Minus,
  RotateCcw,
  History,
  Warehouse
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Product } from '@/types';

export default function Inventory() {
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['inventory'],
    queryFn: inventoryService.getInventory,
  });

  const adjustMutation = useMutation({
    mutationFn: inventoryService.adjustStock,
    onSuccess: () => {
      toast.success('Stok berhasil disesuaikan');
      setAdjustDialogOpen(false);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Gagal menyesuaikan stok');
    },
  });

  const filteredProducts = data?.inventory.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const isLowStock = (product: Product) => product.stock_quantity <= product.reorder_level;
  const isOutOfStock = (product: Product) => product.stock_quantity === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventori</h1>
          <p className="text-muted-foreground">
            Kelola level stok dan pantau pergerakan inventori
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Produk</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.summary.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stok Menipis</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{data?.summary.lowStock || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stok Habis</CardTitle>
            <Package className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{data?.summary.outOfStock || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gudang</CardTitle>
            <Warehouse className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari produk..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Produk</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">SKU</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Stok</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Level Reorder</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">Memuat...</td>
                  </tr>
                ) : filteredProducts?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">Produk tidak ditemukan</h3>
                    </td>
                  </tr>
                ) : (
                  filteredProducts?.map((product) => (
                    <tr key={product.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                              <Package className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <span className="font-medium">{product.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{product.sku}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={cn(
                          "font-medium",
                          isOutOfStock(product) ? "text-destructive" :
                          isLowStock(product) ? "text-amber-500" : "text-emerald-500"
                        )}>
                          {product.stock_quantity}
                        </span>
                        <span className="text-sm text-muted-foreground ml-1">{(product as any).unit_type || "karton"}</span>
                      </td>
                      <td className="py-3 px-4 text-center text-sm text-muted-foreground">
                        {product.reorder_level} {(product as any).unit_type || "karton"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isOutOfStock(product) ? (
                          <Badge variant="destructive">Stok Habis</Badge>
                        ) : isLowStock(product) ? (
                          <Badge variant="secondary" className="bg-amber-500/10 text-amber-500">Stok Menipis</Badge>
                        ) : (
                          <Badge variant="default" className="bg-emerald-500/10 text-emerald-500">Tersedia</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedProduct(product);
                              setAdjustDialogOpen(true);
                            }}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedProduct(product);
                              setHistoryDialogOpen(true);
                            }}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Adjust Stock Dialog */}
      <AdjustStockDialog
        product={selectedProduct}
        open={adjustDialogOpen}
        onOpenChange={setAdjustDialogOpen}
        onSubmit={(data) => adjustMutation.mutate(data)}
        isLoading={adjustMutation.isPending}
      />

      {/* History Dialog */}
      <StockHistoryDialog
        product={selectedProduct}
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
      />
    </div>
  );
}

function AdjustStockDialog({
  product,
  open,
  onOpenChange,
  onSubmit,
  isLoading
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { product_id: string; type: 'incoming' | 'outgoing' | 'adjustment'; quantity: number; reason: string }) => void;
  isLoading: boolean;
}) {
  const [type, setType] = useState<'incoming' | 'outgoing' | 'adjustment'>('incoming');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    
    onSubmit({
      product_id: product.id,
      type,
      quantity: parseInt(quantity),
      reason,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sesuaikan Stok</DialogTitle>
          <DialogDescription>
            {product && `Sesuaikan stok untuk ${product.name}`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipe Penyesuaian</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="incoming">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Stok Masuk
                  </div>
                </SelectItem>
                <SelectItem value="outgoing">
                  <div className="flex items-center gap-2">
                    <Minus className="h-4 w-4" />
                    Stok Keluar
                  </div>
                </SelectItem>
                <SelectItem value="adjustment">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Koreksi Manual
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Jumlah</Label>
            <Input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Keterangan</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Alasan penyesuaian stok..."
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Memproses...' : 'Sesuaikan Stok'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StockHistoryDialog({
  product,
  open,
  onOpenChange
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: historyData, isLoading } = useQuery({
    queryKey: ['stock-history', product?.id],
    queryFn: () => inventoryService.getStockHistory({ product_id: product?.id, limit: 10 }),
    enabled: !!product && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Riwayat Stok</DialogTitle>
          <DialogDescription>
            {product && `Riwayat pergerakan stok: ${product.name}`}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 text-sm font-medium">Tanggal</th>
                <th className="text-left py-2 px-3 text-sm font-medium">Tipe</th>
                <th className="text-right py-2 px-3 text-sm font-medium">Jumlah</th>
                <th className="text-left py-2 px-3 text-sm font-medium">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center">Memuat...</td>
                </tr>
              ) : historyData?.history.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-muted-foreground">Belum ada riwayat</td>
                </tr>
              ) : (
                historyData?.history.map((h) => (
                  <tr key={h.id} className="border-b">
                    <td className="py-2 px-3 text-sm">
                      {h.created_at ? new Date(h.created_at).toLocaleString() : '-'}
                    </td>
                    <td className="py-2 px-3">
                      <Badge variant={h.type === 'incoming' ? 'default' : h.type === 'outgoing' ? 'destructive' : 'secondary'}>
                        {h.type}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-right font-medium">
                      {h.type === 'outgoing' ? '-' : '+'}{h.quantity}
                    </td>
                    <td className="py-2 px-3 text-sm text-muted-foreground">{h.reason}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
