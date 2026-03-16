import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, ToggleLeft, Ticket, Loader2, Percent, BadgeDollarSign, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const fmtCur = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

const EMPTY_FORM = {
  code: '', name: '', type: 'percentage', discount_percent: '', discount_amount: '',
  min_order_value: '', max_discount_cap: '', valid_from: '', valid_until: '', is_active: true,
};

export default function AdminPromos() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ mode: 'create' | 'edit'; data?: any } | null>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-promos'],
    queryFn: async () => { const r = await api.get('/admin/promos'); return r.data; },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        discount_percent: form.discount_percent ? parseFloat(form.discount_percent) : undefined,
        discount_amount:  form.discount_amount  ? parseFloat(form.discount_amount)  : undefined,
        min_order_value:  form.min_order_value  ? parseFloat(form.min_order_value)  : undefined,
        max_discount_cap: form.max_discount_cap ? parseFloat(form.max_discount_cap) : undefined,
        valid_from:  form.valid_from  || undefined,
        valid_until: form.valid_until || undefined,
      };
      return dialog?.mode === 'edit'
        ? api.put(`/admin/promos/${dialog.data.id}`, payload)
        : api.post('/promos', payload);
    },
    onSuccess: () => {
      toast.success(dialog?.mode === 'edit' ? 'Promo diperbarui' : 'Promo dibuat');
      setDialog(null);
      qc.invalidateQueries({ queryKey: ['admin-promos'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal menyimpan'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      is_active ? api.put(`/admin/promos/${id}`, { is_active: false }) : api.put(`/admin/promos/${id}`, { is_active: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-promos'] }),
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal'),
  });

  const promos = data?.promos || [];
  const now = new Date();

  const openCreate = () => { setForm({ ...EMPTY_FORM }); setDialog({ mode: 'create' }); };
  const openEdit = (p: any) => {
    setForm({
      code: p.code, name: p.name || '', type: p.type,
      discount_percent: p.discount_percent?.toString() || '',
      discount_amount:  p.discount_amount?.toString()  || '',
      min_order_value:  p.min_order_value?.toString()  || '',
      max_discount_cap: p.max_discount_cap?.toString() || '',
      valid_from:  p.valid_from  ? p.valid_from.split('T')[0]  : '',
      valid_until: p.valid_until ? p.valid_until.split('T')[0] : '',
      is_active: p.is_active,
    });
    setDialog({ mode: 'edit', data: p });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Promo</h1>
          <p className="text-muted-foreground">Buat dan kelola kode diskon untuk pelanggan</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />Buat Promo
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{promos.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total Promo</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-500">
            {promos.filter((p: any) => p.is_active && new Date(p.valid_until) > now).length}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Aktif</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-500">
            {promos.reduce((s: number, p: any) => s + (p.usage_count || 0), 0)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Total Penggunaan</p>
        </CardContent></Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Kode</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tipe</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Diskon</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Min. Order</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Berlaku</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Pakai</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                ) : promos.length === 0 ? (
                  <tr><td colSpan={8} className="py-12 text-center">
                    <Ticket className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">Belum ada promo. Buat promo pertama!</p>
                  </td></tr>
                ) : promos.map((p: any) => {
                  const expired = p.valid_until && new Date(p.valid_until) < now;
                  const TypeIcon = p.type === 'percentage' ? Percent : p.type === 'free_shipping' ? Truck : BadgeDollarSign;
                  return (
                    <tr key={p.id} className={cn('border-b hover:bg-muted/30', (!p.is_active || expired) && 'opacity-60')}>
                      <td className="py-3 px-4">
                        <p className="font-mono font-bold text-primary">{p.code}</p>
                        {p.name && <p className="text-xs text-muted-foreground">{p.name}</p>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="capitalize text-xs">{p.type === 'percentage' ? 'Persen' : p.type === 'fixed_amount' ? 'Nominal' : 'Gratis Ongkir'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {p.type === 'percentage' ? `${p.discount_percent}%` :
                         p.type === 'fixed_amount' ? fmtCur(p.discount_amount || 0) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right text-xs text-muted-foreground">
                        {p.min_order_value ? fmtCur(p.min_order_value) : '—'}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {p.valid_until ? format(new Date(p.valid_until), 'dd MMM yyyy') : '—'}
                        {expired && <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5 py-0">Expired</Badge>}
                      </td>
                      <td className="py-3 px-4 text-center font-medium">{p.usage_count || 0}x</td>
                      <td className="py-3 px-4 text-center">
                        <Switch checked={p.is_active} onCheckedChange={() => toggleMutation.mutate({ id: p.id, is_active: p.is_active })} />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={!!dialog} onOpenChange={o => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === 'create' ? 'Buat Promo Baru' : 'Edit Promo'}</DialogTitle>
            <DialogDescription>Isi detail kode diskon untuk pelanggan</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Kode Promo *</Label>
                <Input placeholder="HEMAT50" className="uppercase" value={form.code}
                  onChange={e => setForm((f: any) => ({ ...f, code: e.target.value.toUpperCase() }))} />
              </div>
              <div className="space-y-2">
                <Label>Nama (opsional)</Label>
                <Input placeholder="Diskon Hari Raya" value={form.name}
                  onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipe Diskon *</Label>
              <Select value={form.type} onValueChange={v => setForm((f: any) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Persentase (%)</SelectItem>
                  <SelectItem value="fixed_amount">Nominal Tetap (Rp)</SelectItem>
                  <SelectItem value="free_shipping">Gratis Ongkir</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.type === 'percentage' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Diskon (%)</Label>
                  <Input type="number" min="1" max="100" placeholder="10" value={form.discount_percent}
                    onChange={e => setForm((f: any) => ({ ...f, discount_percent: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Maks. Diskon (Rp)</Label>
                  <Input type="number" placeholder="Opsional" value={form.max_discount_cap}
                    onChange={e => setForm((f: any) => ({ ...f, max_discount_cap: e.target.value }))} />
                </div>
              </div>
            )}
            {form.type === 'fixed_amount' && (
              <div className="space-y-2">
                <Label>Nominal Diskon (Rp)</Label>
                <Input type="number" placeholder="50000" value={form.discount_amount}
                  onChange={e => setForm((f: any) => ({ ...f, discount_amount: e.target.value }))} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Minimum Order (Rp)</Label>
              <Input type="number" placeholder="Opsional" value={form.min_order_value}
                onChange={e => setForm((f: any) => ({ ...f, min_order_value: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Berlaku Dari</Label>
                <Input type="date" value={form.valid_from}
                  onChange={e => setForm((f: any) => ({ ...f, valid_from: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Berlaku s.d. *</Label>
                <Input type="date" value={form.valid_until}
                  onChange={e => setForm((f: any) => ({ ...f, valid_until: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={v => setForm((f: any) => ({ ...f, is_active: v }))} />
              <Label>Aktif sekarang</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Batal</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.code || !form.valid_until}>
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {dialog?.mode === 'edit' ? 'Simpan' : 'Buat Promo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
