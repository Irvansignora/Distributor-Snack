import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import api from '@/services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Search, Store, CheckCircle, XCircle, Clock, Eye, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  draft:          { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: Store },
  pending_review: { label: 'Menunggu Review', color: 'bg-amber-100 text-amber-700', icon: Clock },
  approved:       { label: 'Disetujui', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  rejected:       { label: 'Ditolak', color: 'bg-red-100 text-red-700', icon: XCircle },
  suspended:      { label: 'Ditangguhkan', color: 'bg-orange-100 text-orange-700', icon: Shield },
};

const TIER_CONFIG = {
  bronze:   { label: 'Bronze', color: 'bg-amber-700 text-white' },
  silver:   { label: 'Silver', color: 'bg-gray-400 text-white' },
  gold:     { label: 'Gold', color: 'bg-yellow-500 text-white' },
  platinum: { label: 'Platinum', color: 'bg-blue-600 text-white' },
};

export default function StoreManagement() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [approveDialog, setApproveDialog] = useState<any>(null);
  const [rejectDialog, setRejectDialog] = useState<any>(null);
  const [approveData, setApproveData] = useState({ tier: 'bronze', credit_limit: '0', notes: '' });
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-stores', search, statusFilter],
    queryFn: () => api.get('/admin/stores', { params: { search: search || undefined, status: statusFilter !== 'all' ? statusFilter : undefined, limit: 50 } }).then(r => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => api.patch(`/admin/stores/${id}/approve`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-stores'] }); toast.success('Toko berhasil disetujui'); setApproveDialog(null); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal menyetujui toko'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: any) => api.patch(`/admin/stores/${id}/reject`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-stores'] }); toast.success('Toko ditolak'); setRejectDialog(null); setRejectReason(''); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal menolak toko'),
  });

  const pendingCount = data?.stores?.filter((s: any) => s.status === 'pending_review').length || 0;

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manajemen Toko</h1>
          <p className="text-muted-foreground">Verifikasi dan kelola toko/reseller yang mendaftar</p>
        </div>
        {pendingCount > 0 && <Badge className="bg-amber-500 text-white text-sm px-3 py-1">{pendingCount} menunggu review</Badge>}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari nama toko, pemilik, email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(STATUS_CONFIG).slice(0, 4).map(([status, config]) => {
          const count = data?.stores?.filter((s: any) => s.status === status).length || 0;
          return (
            <Card key={status} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter(status)}>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{count}</p>
                <Badge className={cn("text-xs mt-1", config.color)}>{config.label}</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Memuat data...</div>
          ) : data?.stores?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Tidak ada toko ditemukan</div>
          ) : (
            <div className="divide-y">
              {data?.stores?.map((store: any) => {
                const statusConf = STATUS_CONFIG[store.status as keyof typeof STATUS_CONFIG];
                const tierConf = TIER_CONFIG[store.tier as keyof typeof TIER_CONFIG];
                return (
                  <div key={store.id} className="p-4 hover:bg-muted/30 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate">{store.store_name}</p>
                        <Badge className={cn("text-xs shrink-0", tierConf?.color)}>{tierConf?.label}</Badge>
                        <Badge className={cn("text-xs shrink-0", statusConf?.color)}>{statusConf?.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{store.owner_name} · {store.email} · {store.city_name || store.province_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Daftar: {new Date(store.created_at).toLocaleDateString('id-ID')}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {store.status === 'pending_review' && (
                        <>
                          <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => setRejectDialog(store)}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setApproveDialog(store); setApproveData({ tier: 'bronze', credit_limit: '0', notes: '' }); }}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Setujui
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost" asChild>
                        <NavLink to={`/admin/stores/${store.id}`}><Eye className="h-4 w-4" /></NavLink>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={!!approveDialog} onOpenChange={() => setApproveDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Setujui Toko: {approveDialog?.store_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tier Pelanggan</Label>
              <Select value={approveData.tier} onValueChange={v => setApproveData(p => ({ ...p, tier: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIER_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}><span className={cn("px-2 py-0.5 rounded text-xs mr-2", c.color)}>{c.label}</span>{v === 'bronze' ? '— Harga Standar' : v === 'silver' ? '— Harga Lebih Murah' : v === 'gold' ? '— Harga Terbaik' : '— Harga Khusus'}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Limit Kredit (Rp)</Label>
              <Input type="number" value={approveData.credit_limit} onChange={e => setApproveData(p => ({ ...p, credit_limit: e.target.value }))} placeholder="0 = tidak ada kredit" />
              <p className="text-xs text-muted-foreground">0 = toko harus bayar di muka</p>
            </div>
            <div className="space-y-2">
              <Label>Catatan Internal (opsional)</Label>
              <Textarea value={approveData.notes} onChange={e => setApproveData(p => ({ ...p, notes: e.target.value }))} placeholder="Catatan untuk tim internal..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(null)}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => approveMutation.mutate({ id: approveDialog.id, tier: approveData.tier, credit_limit: Number(approveData.credit_limit), notes: approveData.notes })} disabled={approveMutation.isPending}>
              {approveMutation.isPending ? 'Memproses...' : 'Setujui Toko'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tolak Toko: {rejectDialog?.store_name}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Alasan Penolakan *</Label>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Contoh: Foto KTP tidak jelas, tolong upload ulang dengan kualitas yang lebih baik." rows={4} />
            <p className="text-xs text-muted-foreground">Alasan ini akan dikirim ke toko via WhatsApp & notifikasi.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Batal</Button>
            <Button variant="destructive" onClick={() => rejectMutation.mutate({ id: rejectDialog.id, reason: rejectReason })} disabled={!rejectReason || rejectMutation.isPending}>
              {rejectMutation.isPending ? 'Memproses...' : 'Tolak Toko'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
