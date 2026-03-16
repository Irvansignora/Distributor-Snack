import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2, Tag, Loader2, Search } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supplierService } from '@/services/suppliers';
import { productService } from '@/services/products';

const fmtCur = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

export default function SpecialPrices() {
  const qc = useQueryClient();
  const [filterStore, setFilterStore] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ product_id: '', store_id: '', price_per_karton: '', notes: '', valid_from: '', valid_until: '' });
  const [productSearch, setProductSearch] = useState('');

  const { data: spData, isLoading } = useQuery({
    queryKey: ['special-prices', filterStore],
    queryFn: async () => {
      const params: any = {};
      if (filterStore !== 'all') params.store_id = filterStore;
      const r = await api.get('/special-prices', { params });
      return r.data;
    },
  });

  const { data: storesData } = useQuery({
    queryKey: ['suppliers'],
    queryFn: supplierService.getSuppliers,
  });

  const { data: productsData } = useQuery({
    queryKey: ['products', productSearch],
    queryFn: () => productService.getProducts({ search: productSearch || undefined, limit: 30 }),
  });

  const addMutation = useMutation({
    mutationFn: () => api.post('/special-prices', {
      ...form,
      price_per_karton: parseFloat(form.price_per_karton),
      valid_from: form.valid_from || undefined,
      valid_until: form.valid_until || undefined,
    }),
    onSuccess: () => {
      toast.success('Harga khusus berhasil disimpan');
      setAddOpen(false);
      setForm({ product_id: '', store_id: '', price_per_karton: '', notes: '', valid_from: '', valid_until: '' });
      qc.invalidateQueries({ queryKey: ['special-prices'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal menyimpan'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/special-prices/${id}`),
    onSuccess: () => {
      toast.success('Harga khusus dihapus');
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ['special-prices'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal menghapus'),
  });

  const prices = spData?.special_prices || [];
  const stores = storesData?.suppliers || [];
  const products = productsData?.products || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Harga Khusus</h1>
          <p className="text-muted-foreground">Atur harga negosiasi per toko & produk</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />Tambah Harga Khusus
        </Button>
      </div>

      {/* Filter toko */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Label className="text-sm shrink-0">Filter Toko:</Label>
            <Select value={filterStore} onValueChange={setFilterStore}>
              <SelectTrigger className="w-[240px]"><SelectValue placeholder="Semua toko" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Toko</SelectItem>
                {stores.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.store_name || s.company_name || s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4" />
            {prices.length} Harga Khusus Aktif
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Produk</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Toko</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Harga/Karton</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Berlaku s.d.</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Catatan</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                ) : prices.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center">
                    <Tag className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">Belum ada harga khusus</p>
                  </td></tr>
                ) : prices.map((p: any) => (
                  <tr key={p.id} className="border-b hover:bg-muted/30">
                    <td className="py-3 px-4">
                      <p className="font-medium">{p.products?.name || '—'}</p>
                      <p className="text-xs text-muted-foreground font-mono">{p.products?.sku}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium">{p.customer_stores?.store_name || '—'}</p>
                      <p className="text-xs text-muted-foreground">{p.customer_stores?.owner_name}</p>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-primary">{fmtCur(p.price_per_karton)}</td>
                    <td className="py-3 px-4 text-xs">
                      {p.valid_until ? format(new Date(p.valid_until), 'dd MMM yyyy') : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground max-w-[160px] truncate">{p.notes || '—'}</td>
                    <td className="py-3 px-4 text-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(p.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => !o && setAddOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Harga Khusus</DialogTitle>
            <DialogDescription>Set harga negosiasi untuk toko & produk tertentu</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Cari Produk *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Ketik nama produk..." value={productSearch}
                  onChange={e => setProductSearch(e.target.value)} />
              </div>
              {products.length > 0 && (
                <Select value={form.product_id} onValueChange={v => setForm(f => ({ ...f, product_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih produk" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} — {p.sku}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Toko *</Label>
              <Select value={form.store_id} onValueChange={v => setForm(f => ({ ...f, store_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Pilih toko" /></SelectTrigger>
                <SelectContent>
                  {stores.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.store_name || s.company_name || s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Harga per Karton (Rp) *</Label>
              <Input type="number" min="0" placeholder="0" value={form.price_per_karton}
                onChange={e => setForm(f => ({ ...f, price_per_karton: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Berlaku Dari</Label>
                <Input type="date" value={form.valid_from}
                  onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Berlaku s.d.</Label>
                <Input type="date" value={form.valid_until}
                  onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Input placeholder="Mis: Harga negosiasi Q1 2025" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Batal</Button>
            <Button onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending || !form.product_id || !form.store_id || !form.price_per_karton}>
              {addMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Harga Khusus?</AlertDialogTitle>
            <AlertDialogDescription>Toko akan kembali ke harga tier standar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
