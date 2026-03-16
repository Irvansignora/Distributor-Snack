import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { orderService } from '@/services/orders';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { RotateCcw, Plus, Clock, CheckCircle2, XCircle, PackageX, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const fmtCur = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

const STATUS_MAP: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  requested: { label: 'Menunggu Review', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',  icon: Clock },
  approved:  { label: 'Disetujui',       cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', icon: CheckCircle2 },
  rejected:  { label: 'Ditolak',         cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',     icon: XCircle },
  processed: { label: 'Diproses',        cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',    icon: RotateCcw },
};

export default function SupplierReturns() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ order_id: '', reason: '', items: [{ product_name: '', qty: 1, reason: '' }] });

  const { data: returnsData, isLoading } = useQuery({
    queryKey: ['my-returns'],
    queryFn: async () => { const r = await api.get('/returns/my'); return r.data; },
  });

  // Ambil order yang sudah delivered/completed untuk dropdown
  const { data: ordersData } = useQuery({
    queryKey: ['my-orders-eligible'],
    queryFn: () => orderService.getOrders({ limit: 50 }),
  });

  const eligibleOrders = (ordersData?.orders || []).filter((o: any) =>
    ['delivered', 'completed'].includes(o.status)
  );

  const createMutation = useMutation({
    mutationFn: () => api.post('/returns', {
      order_id: form.order_id,
      reason: form.reason,
      items: form.items.filter(i => i.product_name.trim()),
    }),
    onSuccess: () => {
      toast.success('Pengajuan retur berhasil dikirim');
      setCreateOpen(false);
      setForm({ order_id: '', reason: '', items: [{ product_name: '', qty: 1, reason: '' }] });
      qc.invalidateQueries({ queryKey: ['my-returns'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal mengajukan retur'),
  });

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { product_name: '', qty: 1, reason: '' }] }));
  const removeItem = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i: number, field: string, value: any) =>
    setForm(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, [field]: value } : it) }));

  const returns = returnsData?.returns || [];

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Retur & Klaim</h1>
          <p className="text-muted-foreground">Ajukan dan pantau status retur barang</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />Ajukan Retur
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : returns.length === 0 ? (
        <Card className="p-12 text-center">
          <PackageX className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Belum ada pengajuan retur</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Jika ada barang yang perlu diretur, klik tombol "Ajukan Retur"
          </p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />Ajukan Retur Pertama
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {returns.map((ret: any) => {
            const st = STATUS_MAP[ret.status] || STATUS_MAP.requested;
            const Icon = st.icon;
            return (
              <Card key={ret.id}>
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold">#{ret.orders?.order_number || ret.order_id?.slice(0,8)}</span>
                        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1', st.cls)}>
                          <Icon className="h-3 w-3" />{st.label}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{ret.reason}</p>
                      {ret.admin_notes && (
                        <p className="text-sm text-blue-600 dark:text-blue-400">
                          📝 Catatan admin: {ret.admin_notes}
                        </p>
                      )}
                      {ret.refund_amount > 0 && (
                        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                          💰 Refund: {fmtCur(ret.refund_amount)} via {ret.refund_method === 'credit_note' ? 'Credit Note' : 'Transfer'}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">
                        {ret.created_at ? format(new Date(ret.created_at), 'dd MMM yyyy') : '—'}
                      </p>
                      {Array.isArray(ret.items) && (
                        <p className="text-xs text-muted-foreground">{ret.items.length} item</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Retur Dialog */}
      <Dialog open={createOpen} onOpenChange={o => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajukan Retur</DialogTitle>
            <DialogDescription>
              Retur hanya bisa diajukan untuk pesanan yang sudah diterima (delivered/completed)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Pilih Pesanan *</Label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={form.order_id}
                onChange={e => setForm(f => ({ ...f, order_id: e.target.value }))}
              >
                <option value="">— Pilih pesanan —</option>
                {eligibleOrders.map((o: any) => (
                  <option key={o.id} value={o.id}>
                    #{o.order_number || o.id.slice(0,8)} — {fmtCur(o.total)} ({o.status})
                  </option>
                ))}
              </select>
              {eligibleOrders.length === 0 && (
                <p className="text-xs text-muted-foreground">Tidak ada pesanan yang memenuhi syarat retur</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Alasan Retur *</Label>
              <Textarea placeholder="Jelaskan alasan retur secara detail..." rows={3}
                value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Item yang Diretur</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Tambah
                </Button>
              </div>
              {form.items.map((item, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex gap-2">
                    <Input placeholder="Nama produk" className="flex-1" value={item.product_name}
                      onChange={e => updateItem(i, 'product_name', e.target.value)} />
                    <Input type="number" min="1" className="w-20" value={item.qty}
                      onChange={e => updateItem(i, 'qty', parseInt(e.target.value) || 1)} />
                    {form.items.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="h-10 w-10 text-destructive shrink-0"
                        onClick={() => removeItem(i)}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <Input placeholder="Alasan item ini diretur (opsional)" value={item.reason}
                    onChange={e => updateItem(i, 'reason', e.target.value)} />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Batal</Button>
            <Button onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.order_id || !form.reason.trim()}>
              {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              Kirim Pengajuan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
