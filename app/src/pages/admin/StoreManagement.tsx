import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import api from '@/services/api';
import { supplierService } from '@/services/suppliers';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Search, Store, CheckCircle, XCircle, Clock, Eye, Shield,
  Plus, Loader2, Users, Building2, Phone, Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  draft:          { label: 'Draft',           color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',         icon: Store },
  pending_review: { label: 'Menunggu Review', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',   icon: Clock },
  approved:       { label: 'Disetujui',       color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', icon: CheckCircle },
  rejected:       { label: 'Ditolak',         color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',           icon: XCircle },
  suspended:      { label: 'Ditangguhkan',    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300', icon: Shield },
  // Status untuk user tanpa store profile
  active:         { label: 'Aktif',           color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',       icon: CheckCircle },
};

const TIER_CONFIG = {
  agent:    { label: 'Agent',    color: 'bg-emerald-600 text-white' },
  reseller: { label: 'Reseller', color: 'bg-amber-600 text-white' },
};

export default function StoreManagement() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Dialog states
  const [approveDialog, setApproveDialog] = useState<any>(null);
  const [rejectDialog, setRejectDialog]   = useState<any>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const [approveData, setApproveData] = useState({ tier: 'reseller', credit_limit: '0', notes: '' });
  const [rejectReason, setRejectReason] = useState('');
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', company_name: '', phone: '' });

  // BUG FIX: pakai /suppliers endpoint yang sudah gabungkan store + user tanpa store
  const { data, isLoading } = useQuery({
    queryKey: ['pelanggan', search, statusFilter],
    queryFn: () => api.get('/suppliers', {
      params: {
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        limit: 100,
      }
    }).then(r => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, ...body }: any) => api.patch(`/admin/stores/${id}/approve`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pelanggan'] });
      toast.success('Toko berhasil disetujui');
      setApproveDialog(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal menyetujui toko'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: any) => api.patch(`/admin/stores/${id}/reject`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pelanggan'] });
      toast.success('Toko ditolak');
      setRejectDialog(null);
      setRejectReason('');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal menolak toko'),
  });

  const addMutation = useMutation({
    mutationFn: supplierService.createSupplier,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pelanggan'] });
      toast.success('Pelanggan berhasil ditambahkan');
      setAddDialogOpen(false);
      setAddForm({ name: '', email: '', password: '', company_name: '', phone: '' });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal menambahkan pelanggan'),
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name || !addForm.email || !addForm.password) {
      toast.error('Nama, email, dan password wajib diisi');
      return;
    }
    addMutation.mutate(addForm);
  };

  const suppliers: any[] = data?.suppliers || [];

  // Hitung summary stats
  const statsCount = {
    draft:          suppliers.filter(s => s.status === 'draft').length,
    pending_review: suppliers.filter(s => s.status === 'pending_review').length,
    approved:       suppliers.filter(s => s.status === 'approved').length,
    rejected:       suppliers.filter(s => s.status === 'rejected').length,
  };

  const pendingCount = statsCount.pending_review;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pelanggan</h1>
          <p className="text-muted-foreground">Verifikasi dan kelola toko/reseller yang mendaftar</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Badge className="bg-amber-500 text-white px-3 py-1 text-sm">
              {pendingCount} menunggu review
            </Badge>
          )}
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Pelanggan
          </Button>
        </div>
      </div>

      {/* Stats cards — klik untuk filter */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.entries(STATUS_CONFIG).slice(0, 4) as [string, typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]][]).map(([status, config]) => {
          const count = statsCount[status as keyof typeof statsCount] ?? 0;
          return (
            <Card
              key={status}
              className={cn(
                'cursor-pointer transition-shadow hover:shadow-md',
                statusFilter === status && 'ring-2 ring-primary'
              )}
              onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
            >
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{count}</p>
                <Badge className={cn('text-xs mt-1', config.color)}>{config.label}</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search + Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama toko, pemilik, email..."
                value={search}
                onChange={e => { setSearch(e.target.value); }}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                {Object.entries(STATUS_CONFIG)
                  .filter(([k]) => k !== 'active')
                  .map(([v, c]) => (
                    <SelectItem key={v} value={v}>{c.label}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* List Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          ) : suppliers.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Tidak ada pelanggan ditemukan</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Toko / Pemilik</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground hidden md:table-cell">Kontak</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground hidden lg:table-cell">Tier</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground hidden lg:table-cell">Kredit</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground hidden md:table-cell">Daftar</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s: any) => {
                    const statusConf = STATUS_CONFIG[s.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft;
                    const tierConf   = TIER_CONFIG[s.tier as keyof typeof TIER_CONFIG];
                    // BUG FIX: store_name bisa null jika user belum punya store profile
                    const displayName  = s.store_name || s.company_name || s.owner_name || s.name || '-';
                    const ownerName    = s.owner_name  || s.name || '-';
                    const contactPhone = s.whatsapp    || s.phone_store || s.phone || '-';
                    const contactEmail = s.email       || '-';
                    // BUG FIX: credit_limit bisa undefined/null — default ke 0
                    const creditLimit  = s.credit_limit  ?? 0;
                    const creditUsed   = s.credit_used   ?? s.current_credit ?? 0;
                    // BUG FIX: detail link — gunakan store id (s.id) bukan user_id
                    const detailId     = s.id;

                    return (
                      <tr key={s.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Building2 className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{displayName}</p>
                              <p className="text-xs text-muted-foreground truncate">{ownerName}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              <span className="truncate max-w-[160px]">{contactEmail}</span>
                            </div>
                            {contactPhone !== '-' && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <span>{contactPhone}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 hidden lg:table-cell">
                          {tierConf ? (
                            <Badge className={cn('text-xs', tierConf.color)}>{tierConf.label}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={cn('text-xs', statusConf.color)}>{statusConf.label}</Badge>
                        </td>
                        <td className="py-3 px-4 hidden lg:table-cell">
                          <div className="text-xs">
                            <p className="font-medium">{formatCurrency(creditLimit)}</p>
                            {creditUsed > 0 && (
                              <p className="text-muted-foreground">Terpakai: {formatCurrency(creditUsed)}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          <span className="text-xs text-muted-foreground">
                            {s.created_at ? new Date(s.created_at).toLocaleDateString('id-ID') : '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
                            {s.status === 'pending_review' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-red-200 text-red-600 hover:bg-red-50 h-7 w-7 p-0"
                                  onClick={() => { setRejectDialog(s); setRejectReason(''); }}
                                  title="Tolak"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 h-7 px-2 text-xs"
                                  onClick={() => { setApproveDialog(s); setApproveData({ tier: 'reseller', credit_limit: '0', notes: '' }); }}
                                >
                                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                  Setujui
                                </Button>
                              </>
                            )}
                            {/* BUG FIX: link ke /suppliers/:id untuk yang punya store profile */}
                            {s.id && s.status !== 'active' ? (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                                <NavLink to={`/admin/suppliers/${detailId}`} title="Lihat detail">
                                  <Eye className="h-3.5 w-3.5" />
                                </NavLink>
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled title="Belum ada profil toko">
                                <Eye className="h-3.5 w-3.5 opacity-40" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Tambah Pelanggan */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Pelanggan Baru</DialogTitle>
            <DialogDescription>
              Buat akun pelanggan/reseller baru langsung dari admin
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSubmit}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-name">Nama Lengkap *</Label>
                  <Input
                    id="add-name"
                    value={addForm.name}
                    onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Nama pemilik toko"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-company">Nama Toko</Label>
                  <Input
                    id="add-company"
                    value={addForm.company_name}
                    onChange={e => setAddForm(f => ({ ...f, company_name: e.target.value }))}
                    placeholder="Nama toko"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-email">Email *</Label>
                <Input
                  id="add-email"
                  type="email"
                  value={addForm.email}
                  onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-phone">No. Telepon</Label>
                  <Input
                    id="add-phone"
                    value={addForm.phone}
                    onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="08xxxxxxxxxx"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-password">Password Awal *</Label>
                  <Input
                    id="add-password"
                    type="password"
                    value={addForm.password}
                    onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min. 6 karakter"
                    required
                    minLength={6}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={addMutation.isPending}>
                {addMutation.isPending
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</>
                  : 'Tambah Pelanggan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Setujui Toko */}
      <Dialog open={!!approveDialog} onOpenChange={() => setApproveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Setujui Toko: {approveDialog?.store_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tier Pelanggan</Label>
              <Select value={approveData.tier} onValueChange={v => setApproveData(p => ({ ...p, tier: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIER_CONFIG).map(([v, c]) => (
                    <SelectItem key={v} value={v}>
                      <span className={cn('px-2 py-0.5 rounded text-xs mr-2', c.color)}>{c.label}</span>
                      {v === 'agent' ? '— Harga Agent' : '— Harga Reseller'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Limit Kredit (Rp)</Label>
              <Input
                type="number"
                value={approveData.credit_limit}
                onChange={e => setApproveData(p => ({ ...p, credit_limit: e.target.value }))}
                placeholder="0 = tidak ada kredit"
              />
              <p className="text-xs text-muted-foreground">0 = toko harus bayar di muka</p>
            </div>
            <div className="space-y-2">
              <Label>Catatan Internal (opsional)</Label>
              <Textarea
                value={approveData.notes}
                onChange={e => setApproveData(p => ({ ...p, notes: e.target.value }))}
                placeholder="Catatan untuk tim internal..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(null)}>Batal</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => approveMutation.mutate({
                id: approveDialog.id,
                tier: approveData.tier,
                credit_limit: Number(approveData.credit_limit),
                notes: approveData.notes,
              })}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? 'Memproses...' : 'Setujui Toko'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Tolak Toko */}
      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak Toko: {rejectDialog?.store_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Alasan Penolakan *</Label>
            <Textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Contoh: Foto KTP tidak jelas, tolong upload ulang dengan kualitas lebih baik."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Alasan ini akan dikirim ke toko via WhatsApp &amp; notifikasi.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Batal</Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate({ id: rejectDialog.id, reason: rejectReason })}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? 'Memproses...' : 'Tolak Toko'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
