import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  RotateCcw, CheckCircle2, XCircle, Clock, Loader2, Eye, PackageX,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STATUS_MAP: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  requested: { label: 'Diajukan',   cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',  icon: Clock },
  approved:  { label: 'Disetujui', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', icon: CheckCircle2 },
  rejected:  { label: 'Ditolak',   cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',    icon: XCircle },
  processed: { label: 'Diproses',  cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',   icon: RotateCcw },
};

export default function AdminReturns() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState('all');
  const [detail, setDetail] = useState<any>(null);
  const [processForm, setProcessForm] = useState({ status: 'approved', admin_notes: '', refund_amount: '', refund_method: 'credit_note' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-returns', filterStatus],
    queryFn: async () => {
      const params: any = { page: 1, limit: 50 };
      if (filterStatus !== 'all') params.status = filterStatus;
      const r = await api.get('/returns', { params });
      return r.data;
    },
  });

  const processMutation = useMutation({
    mutationFn: () => api.patch(`/returns/${detail.id}/process`, {
      ...processForm,
      refund_amount: processForm.refund_amount ? parseFloat(processForm.refund_amount) : undefined,
    }),
    onSuccess: () => {
      toast.success('Status retur berhasil diperbarui');
      setDetail(null);
      qc.invalidateQueries({ queryKey: ['admin-returns'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal memproses retur'),
  });

  const returns = data?.returns || [];
  const counts = {
    all: returns.length,
    requested: returns.filter((r: any) => r.status === 'requested').length,
    approved: returns.filter((r: any) => r.status === 'approved').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Retur & Klaim</h1>
          <p className="text-muted-foreground">Kelola permintaan retur barang dari pelanggan</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Retur', value: counts.all, cls: '' },
          { label: 'Menunggu Review', value: counts.requested, cls: 'text-amber-500' },
          { label: 'Disetujui', value: counts.approved, cls: 'text-emerald-500' },
        ].map(c => (
          <Card key={c.label}>
            <CardContent className="p-4 text-center">
              <p className={cn('text-2xl font-bold', c.cls)}>{c.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['all','requested','approved','rejected','processed'].map(s => (
          <Button key={s} size="sm" variant={filterStatus === s ? 'default' : 'outline'}
            onClick={() => setFilterStatus(s)}>
            {s === 'all' ? 'Semua' : STATUS_MAP[s]?.label || s}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Toko</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Order</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Alasan</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tanggal</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                ) : returns.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center">
                    <PackageX className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">Belum ada pengajuan retur</p>
                  </td></tr>
                ) : returns.map((ret: any) => {
                  const st = STATUS_MAP[ret.status] || STATUS_MAP.requested;
                  const Icon = st.icon;
                  return (
                    <tr key={ret.id} className="border-b hover:bg-muted/30">
                      <td className="py-3 px-4 font-medium">
                        {ret.customer_stores?.store_name || '—'}
                        <p className="text-xs text-muted-foreground">{ret.customer_stores?.owner_name}</p>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">{ret.orders?.order_number || ret.order_id?.slice(0,8)}</td>
                      <td className="py-3 px-4 max-w-[200px]">
                        <p className="truncate text-xs" title={ret.reason}>{ret.reason}</p>
                        <p className="text-xs text-muted-foreground">{Array.isArray(ret.items) ? `${ret.items.length} item` : ''}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn('text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1 w-fit', st.cls)}>
                          <Icon className="h-3 w-3" />{st.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        {ret.created_at ? format(new Date(ret.created_at), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button variant="ghost" size="sm" onClick={() => {
                          setDetail(ret);
                          setProcessForm({ status: 'approved', admin_notes: ret.admin_notes || '', refund_amount: ret.refund_amount?.toString() || '', refund_method: ret.refund_method || 'credit_note' });
                        }}>
                          <Eye className="h-4 w-4 mr-1" />Detail
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

      {/* Detail & Proses Dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Retur — {detail?.customer_stores?.store_name}</DialogTitle>
            <DialogDescription>Order #{detail?.orders?.order_number}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Alasan:</span> {detail.reason}</p>
                {detail.admin_notes && <p><span className="text-muted-foreground">Catatan admin:</span> {detail.admin_notes}</p>}
              </div>

              {/* Items */}
              {Array.isArray(detail.items) && detail.items.length > 0 && (
                <div className="rounded-lg border overflow-hidden">
                  <div className="bg-muted/50 px-3 py-2 text-xs font-medium">Item yang diretur</div>
                  <div className="divide-y">
                    {detail.items.map((item: any, i: number) => (
                      <div key={i} className="px-3 py-2 text-sm flex justify-between">
                        <span>{item.product_name || item.order_item_id}</span>
                        <span className="text-muted-foreground">{item.qty} karton</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Process form — hanya tampil kalau masih requested */}
              {detail.status === 'requested' && (
                <div className="space-y-3 border-t pt-4">
                  <p className="text-sm font-medium">Proses Retur</p>
                  <div className="space-y-1">
                    <Label className="text-xs">Keputusan</Label>
                    <Select value={processForm.status} onValueChange={v => setProcessForm(f => ({ ...f, status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="approved">✅ Setujui</SelectItem>
                        <SelectItem value="rejected">❌ Tolak</SelectItem>
                        <SelectItem value="processed">📦 Tandai Diproses</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {processForm.status === 'approved' && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Nominal Refund (Rp)</Label>
                          <Input type="number" placeholder="0" value={processForm.refund_amount}
                            onChange={e => setProcessForm(f => ({ ...f, refund_amount: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Metode Refund</Label>
                          <Select value={processForm.refund_method} onValueChange={v => setProcessForm(f => ({ ...f, refund_method: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="credit_note">Credit Note</SelectItem>
                              <SelectItem value="transfer_back">Transfer Balik</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs">Catatan Admin</Label>
                    <Textarea placeholder="Keterangan untuk pelanggan..." rows={2}
                      value={processForm.admin_notes}
                      onChange={e => setProcessForm(f => ({ ...f, admin_notes: e.target.value }))} />
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>Tutup</Button>
            {detail?.status === 'requested' && (
              <Button onClick={() => processMutation.mutate()} disabled={processMutation.isPending}>
                {processMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Simpan Keputusan
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
