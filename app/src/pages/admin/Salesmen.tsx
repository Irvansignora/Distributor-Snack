import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminSalesmanService } from '@/services/salesman';
import { supplierService } from '@/services/suppliers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Users,
  TrendingUp,
  Target,
  MapPin,
  Plus,
  Settings2,
  Loader2,
  ShoppingCart,
  Banknote,
  Store,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);
const formatM = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}rb`;
  return String(v);
};

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];

export default function AdminSalesmen() {
  const [targetDialog, setTargetDialog] = useState<{ salesman_id: string; name: string } | null>(null);
  const [assignDialog, setAssignDialog] = useState(false);
  const [targetForm, setTargetForm] = useState({
    period_month: String(new Date().getMonth() + 1),
    period_year: String(new Date().getFullYear()),
    target_revenue: '',
    target_visits: '100',
    commission_rate: '0.02',
    bonus_threshold: '',
    bonus_amount: '',
    notes: '',
  });
  const [assignForm, setAssignForm] = useState({ store_id: '', salesman_id: '' });

  const qc = useQueryClient();

  const { data: salesmenData, isLoading } = useQuery({
    queryKey: ['admin-salesmen'],
    queryFn: adminSalesmanService.getSalesmen,
  });

  const { data: storesData } = useQuery({
    queryKey: ['suppliers'],
    queryFn: supplierService.getSuppliers,
  });

  const { data: visitsData } = useQuery({
    queryKey: ['admin-visits'],
    queryFn: () => adminSalesmanService.getVisits({ page: 1 }),
  });

  const targetMutation = useMutation({
    mutationFn: () => adminSalesmanService.setTarget({
      salesman_id: targetDialog!.salesman_id,
      period_month: parseInt(targetForm.period_month),
      period_year: parseInt(targetForm.period_year),
      target_revenue: parseFloat(targetForm.target_revenue),
      target_visits: parseInt(targetForm.target_visits) || 0,
      commission_rate: parseFloat(targetForm.commission_rate) || 0.02,
      bonus_threshold: parseFloat(targetForm.bonus_threshold) || 0,
      bonus_amount: parseFloat(targetForm.bonus_amount) || 0,
      notes: targetForm.notes,
    }),
    onSuccess: () => {
      toast.success('Target berhasil disimpan');
      setTargetDialog(null);
      qc.invalidateQueries({ queryKey: ['admin-salesmen'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal menyimpan target'),
  });

  const assignMutation = useMutation({
    mutationFn: () => adminSalesmanService.assignStore(assignForm.store_id, assignForm.salesman_id || null),
    onSuccess: () => {
      toast.success('Toko berhasil di-assign');
      setAssignDialog(false);
      qc.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal assign toko'),
  });

  const salesmen = salesmenData?.salesmen || [];
  const stores = storesData?.suppliers || [];
  const visits = visitsData?.visits || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Manajemen Salesman</h1>
          <p className="text-muted-foreground">Monitor performa & kelola tim salesman</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAssignDialog(true)}>
            <Store className="mr-2 h-4 w-4" />
            Assign Toko
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="visits">Kunjungan</TabsTrigger>
          <TabsTrigger value="stores">Toko per Salesman</TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW TAB ── */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : salesmen.length === 0 ? (
            <Card className="p-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Belum ada salesman</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Buat akun user dengan role "salesman" untuk mulai mengelola tim
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {salesmen.map((sm: any) => {
                const a = sm.achievement;
                const pct = a?.achievement_pct ?? 0;
                return (
                  <Card key={sm.id} className="overflow-hidden">
                    <div className={cn(
                      'h-1.5',
                      pct >= 100 ? 'bg-green-500' : pct >= 75 ? 'bg-blue-500' : pct >= 50 ? 'bg-orange-500' : 'bg-gray-200'
                    )} style={{ width: `${Math.min(pct, 100)}%` }} />
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                            <span className="text-sm font-bold text-orange-500">
                              {sm.name?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <h3 className="font-semibold">{sm.name}</h3>
                            <p className="text-xs text-muted-foreground">{sm.email}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setTargetDialog({ salesman_id: sm.id, name: sm.name })}
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {a ? (
                        <div className="space-y-3">
                          {/* Progress bar */}
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted-foreground">Target Bulan Ini</span>
                              <span className={cn('font-bold',
                                pct >= 100 ? 'text-green-500' : pct >= 75 ? 'text-blue-500' : 'text-orange-500'
                              )}>{pct}%</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn('h-full rounded-full',
                                  pct >= 100 ? 'bg-green-500' : pct >= 75 ? 'bg-blue-500' : 'bg-orange-500'
                                )}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex items-center gap-1.5">
                              <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                              <span className="text-muted-foreground text-xs">Revenue:</span>
                              <span className="font-medium text-xs">{formatM(a.actual_revenue)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-blue-500" />
                              <span className="text-muted-foreground text-xs">Kunjungan:</span>
                              <span className="font-medium text-xs">{a.actual_visits}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <ShoppingCart className="h-3.5 w-3.5 text-orange-500" />
                              <span className="text-muted-foreground text-xs">Order:</span>
                              <span className="font-medium text-xs">{a.actual_orders}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Banknote className="h-3.5 w-3.5 text-purple-500" />
                              <span className="text-muted-foreground text-xs">Komisi:</span>
                              <span className="font-medium text-xs">{formatM(a.estimated_commission)}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-3 border border-dashed rounded-lg">
                          <Target className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                          <p className="text-xs text-muted-foreground">Belum ada target</p>
                          <Button
                            variant="link"
                            className="text-xs h-6 p-0 mt-1"
                            onClick={() => setTargetDialog({ salesman_id: sm.id, name: sm.name })}
                          >
                            Set target sekarang
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── VISITS TAB ── */}
        <TabsContent value="visits" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Kunjungan Terbaru</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Salesman</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Toko</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Waktu</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Hasil</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">Order/Tagihan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">Belum ada kunjungan</td>
                      </tr>
                    ) : visits.map((v: any) => (
                      <tr key={v.id} className="border-b hover:bg-muted/30">
                        <td className="py-3 px-4 font-medium">{v.users?.name || '—'}</td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium">{v.customer_stores?.store_name}</p>
                            <p className="text-xs text-muted-foreground">{v.customer_stores?.owner_name}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-xs">
                          {new Date(v.checkin_at).toLocaleString('id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={v.visit_result === 'order_taken' ? 'default' : 'secondary'} className="text-xs">
                            {v.visit_result === 'order_taken' ? '✅ Order' :
                             v.visit_result === 'no_order' ? '🔄 Tidak' :
                             v.visit_result === 'collect_payment' ? '💰 Tagih' :
                             v.visit_result === 'closed_store' ? '🔒 Tutup' :
                             v.visit_result || 'Kunjungan'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {v.orders && (
                            <div>
                              <p className="text-xs font-medium">{v.orders.order_number}</p>
                              <p className="text-xs font-bold">{formatCurrency(v.orders.total)}</p>
                            </div>
                          )}
                          {v.payment_collected > 0 && (
                            <p className="text-xs text-green-600">+{formatCurrency(v.payment_collected)}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── STORES PER SALESMAN TAB ── */}
        <TabsContent value="stores" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {salesmen.map((sm: any) => {
              const assignedStores = stores.filter((s: any) =>
                s.assigned_salesman_id === sm.id
              );
              return (
                <Card key={sm.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-orange-500/10 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-orange-500">{sm.name?.charAt(0)}</span>
                        </div>
                        {sm.name}
                      </div>
                      <Badge variant="secondary" className="text-xs">{assignedStores.length} toko</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {assignedStores.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">Belum ada toko di-assign</p>
                    ) : (
                      <div className="space-y-1.5">
                        {assignedStores.slice(0, 5).map((store: any) => (
                          <div key={store.id} className="flex items-center justify-between text-xs">
                            <span className="font-medium">{store.store_name || store.company_name}</span>
                            <Badge variant="outline" className="text-[10px]">{store.tier}</Badge>
                          </div>
                        ))}
                        {assignedStores.length > 5 && (
                          <p className="text-xs text-muted-foreground">+{assignedStores.length - 5} toko lainnya</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Set Target Dialog */}
      <Dialog open={!!targetDialog} onOpenChange={(o) => !o && setTargetDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Target — {targetDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Bulan</Label>
                <Select value={targetForm.period_month} onValueChange={v => setTargetForm(f => ({ ...f, period_month: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tahun</Label>
                <Select value={targetForm.period_year} onValueChange={v => setTargetForm(f => ({ ...f, period_year: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2024,2025,2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Target Revenue (Rp)</Label>
              <Input type="number" placeholder="e.g. 50000000"
                value={targetForm.target_revenue}
                onChange={e => setTargetForm(f => ({ ...f, target_revenue: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Target Kunjungan</Label>
              <Input type="number" placeholder="e.g. 100"
                value={targetForm.target_visits}
                onChange={e => setTargetForm(f => ({ ...f, target_visits: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Rate Komisi (desimal, e.g. 0.02 = 2%)</Label>
              <Input type="number" step="0.001" placeholder="0.02"
                value={targetForm.commission_rate}
                onChange={e => setTargetForm(f => ({ ...f, commission_rate: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Minimum Bonus (Rp)</Label>
                <Input type="number" placeholder="Threshold revenue"
                  value={targetForm.bonus_threshold}
                  onChange={e => setTargetForm(f => ({ ...f, bonus_threshold: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Jumlah Bonus (Rp)</Label>
                <Input type="number" placeholder="Bonus amount"
                  value={targetForm.bonus_amount}
                  onChange={e => setTargetForm(f => ({ ...f, bonus_amount: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTargetDialog(null)}>Batal</Button>
            <Button
              onClick={() => targetMutation.mutate()}
              disabled={targetMutation.isPending || !targetForm.target_revenue}
            >
              {targetMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Simpan Target
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Store Dialog */}
      <Dialog open={assignDialog} onOpenChange={setAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Toko ke Salesman</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Pilih Toko</Label>
              <Select value={assignForm.store_id} onValueChange={v => setAssignForm(f => ({ ...f, store_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Pilih toko..." /></SelectTrigger>
                <SelectContent>
                  {stores.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.store_name || s.company_name || s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assign ke Salesman</Label>
              <Select value={assignForm.salesman_id} onValueChange={v => setAssignForm(f => ({ ...f, salesman_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Pilih salesman..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Tidak di-assign —</SelectItem>
                  {salesmen.map((sm: any) => (
                    <SelectItem key={sm.id} value={sm.id}>{sm.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(false)}>Batal</Button>
            <Button
              onClick={() => assignMutation.mutate()}
              disabled={assignMutation.isPending || !assignForm.store_id}
            >
              {assignMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
