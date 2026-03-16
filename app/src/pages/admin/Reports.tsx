import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { reportService } from '@/services/reports';
import api from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Download, FileText, Package, TrendingUp, CreditCard, Users,
  Loader2, AlertTriangle, Bell, ClipboardList, RotateCcw,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Order, Product } from '@/types';

const CHART_COLOR = '#6366f1';

const fmtCur = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

const fmtM = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}rb`;
  return String(v);
};

function exportToCSV(data: any[], filename: string) {
  if (!data?.length) { toast.error('Tidak ada data'); return; }
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(','), ...data.map(row =>
    headers.map(h => { const v = row[h] ?? ''; return typeof v === 'string' && v.includes(',') ? `"${v}"` : v; }).join(',')
  )];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `${filename}_${format(new Date(), 'yyyyMMdd')}.csv`;
  a.click(); URL.revokeObjectURL(url);
  toast.success(`${filename}.csv berhasil diunduh`);
}

export default function Reports() {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [arOverdueOnly, setArOverdueOnly] = useState(false);
  const [commMonth, setCommMonth] = useState(new Date().getMonth() + 1);
  const [commYear, setCommYear] = useState(new Date().getFullYear());

  // ── Queries ──────────────────────────────────────────────
  const { data: salesData } = useQuery({
    queryKey: ['sales-report', startDate, endDate],
    queryFn: () => reportService.getSalesReport({ start_date: startDate?.toISOString(), end_date: endDate?.toISOString() }),
  });

  const { data: inventoryData } = useQuery({
    queryKey: ['inventory-report'],
    queryFn: reportService.getInventoryReport,
  });

  const { data: arData, isLoading: arLoading } = useQuery({
    queryKey: ['ar-report', arOverdueOnly],
    queryFn: async () => {
      const r = await api.get('/reports/ar', { params: { overdue_only: arOverdueOnly } });
      return r.data;
    },
  });

  const { data: commData, isLoading: commLoading } = useQuery({
    queryKey: ['commission-report', commMonth, commYear],
    queryFn: async () => {
      const r = await api.get('/reports/salesman-commission', { params: { month: commMonth, year: commYear } });
      return r.data;
    },
  });

  const { data: lowStockData, isLoading: lowStockLoading } = useQuery({
    queryKey: ['low-stock-alert'],
    queryFn: async () => { const r = await api.get('/inventory/low-stock-alert'); return r.data; },
  });

  const alertMutation = useMutation({
    mutationFn: () => api.post('/inventory/send-low-stock-alert'),
    onSuccess: (r: any) => toast.success(r.data?.message || 'Alert dikirim'),
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal kirim alert'),
  });

  // Chart sales
  const chartData = (() => {
    if (!salesData?.orders?.length) return [];
    const byDate: Record<string, number> = {};
    salesData.orders.forEach((o: Order) => {
      if (!o.created_at) return;
      const d = format(new Date(o.created_at), 'dd MMM');
      byDate[d] = (byDate[d] || 0) + o.total;
    });
    return Object.entries(byDate).map(([date, total]) => ({ date, total })).slice(-14);
  })();

  const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Laporan</h1>
          <p className="text-muted-foreground">Laporan penjualan, piutang, komisi, dan inventori</p>
        </div>
        <Button variant="outline" onClick={() => {
          if (salesData?.orders) exportToCSV(salesData.orders.map((o: Order) => ({
            order_number: o.order_number || o.id.slice(0,8), tanggal: o.created_at ? format(new Date(o.created_at),'yyyy-MM-dd') : '-',
            status: o.status, payment_status: o.payment_status, total: o.total,
          })), 'laporan_penjualan');
        }}>
          <Download className="mr-2 h-4 w-4" />Export Penjualan
        </Button>
      </div>

      <Tabs defaultValue="sales">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="sales"><TrendingUp className="mr-1.5 h-4 w-4" />Penjualan</TabsTrigger>
          <TabsTrigger value="ar"><CreditCard className="mr-1.5 h-4 w-4" />Piutang (AR)</TabsTrigger>
          <TabsTrigger value="commission"><Users className="mr-1.5 h-4 w-4" />Komisi Salesman</TabsTrigger>
          <TabsTrigger value="inventory"><Package className="mr-1.5 h-4 w-4" />Inventori</TabsTrigger>
          <TabsTrigger value="lowstock"><AlertTriangle className="mr-1.5 h-4 w-4" />Stok Menipis</TabsTrigger>
        </TabsList>

        {/* ── Tab: Penjualan ── */}
        <TabsContent value="sales" className="space-y-6 mt-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block">Dari Tanggal</label>
                  <Input type="date" value={startDate?.toISOString().split('T')[0] || ''}
                    onChange={e => setStartDate(e.target.value ? new Date(e.target.value) : undefined)} />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block">Sampai Tanggal</label>
                  <Input type="date" value={endDate?.toISOString().split('T')[0] || ''}
                    onChange={e => setEndDate(e.target.value ? new Date(e.target.value) : undefined)} />
                </div>
                <Button variant="outline" onClick={() => salesData?.orders && exportToCSV(
                  salesData.orders.map((o: Order) => ({
                    order_number: o.order_number || o.id.slice(0,8),
                    tanggal: o.created_at ? format(new Date(o.created_at),'yyyy-MM-dd') : '-',
                    status: o.status, payment_status: o.payment_status, total: o.total,
                  })), 'laporan_penjualan')}>
                  <FileText className="mr-2 h-4 w-4" />Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { title: 'Total Penjualan', value: fmtCur(salesData?.summary?.totalSales || 0), icon: TrendingUp },
              { title: 'Total Pesanan',   value: String(salesData?.summary?.totalOrders || 0), icon: FileText },
              { title: 'Rata-rata Pesanan', value: fmtCur(salesData?.summary?.averageOrder || 0), icon: TrendingUp },
            ].map(c => (
              <Card key={c.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{c.title}</CardTitle>
                  <c.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{c.value}</div></CardContent>
              </Card>
            ))}
          </div>

          {chartData.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Grafik Penjualan (14 Hari Terakhir)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={v => `${(v/1000000).toFixed(0)}jt`} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => [fmtCur(v), 'Total']} />
                    <Bar dataKey="total" fill={CHART_COLOR} radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Pesanan Terbaru</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">No. Pesanan</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Tanggal</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                  </tr></thead>
                  <tbody>
                    {salesData?.orders?.slice(0,10).map((o: Order) => (
                      <tr key={o.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">#{o.order_number || o.id.slice(0,8)}</td>
                        <td className="py-3 px-4 text-muted-foreground">{o.created_at ? format(new Date(o.created_at),'dd MMM yyyy') : '-'}</td>
                        <td className="py-3 px-4 capitalize">{o.status}</td>
                        <td className="py-3 px-4 text-right font-medium">{fmtCur(o.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Piutang (AR) ── */}
        <TabsContent value="ar" className="space-y-6 mt-4">
          <Card>
            <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded" checked={arOverdueOnly}
                    onChange={e => setArOverdueOnly(e.target.checked)} />
                  <span className="text-sm">Tampilkan hanya yang jatuh tempo</span>
                </label>
              </div>
              <Button variant="outline" size="sm" onClick={() => arData?.stores && exportToCSV(
                arData.stores.map((s: any) => ({
                  toko: s.store_name, owner: s.owner_name, tier: s.tier,
                  piutang: s.credit_used, limit: s.credit_limit, persen_ar: s.ar_percentage,
                  overdue: s.overdue_amount,
                })), 'laporan_piutang')}>
                <Download className="mr-2 h-4 w-4" />Export CSV
              </Button>
            </CardContent>
          </Card>

          {/* Summary */}
          {arData?.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Toko AR', value: arData.summary.total_stores, cls: '' },
                { label: 'Total Piutang', value: fmtCur(arData.summary.total_ar), cls: 'text-blue-500' },
                { label: 'Total Overdue', value: fmtCur(arData.summary.total_overdue), cls: 'text-red-500' },
                { label: 'Toko Overdue', value: arData.summary.overdue_stores, cls: 'text-amber-500' },
              ].map(c => (
                <Card key={c.label}>
                  <CardContent className="p-4 text-center">
                    <p className={cn('text-2xl font-bold', c.cls)}>{c.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Toko</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tier</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Piutang</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Limit</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">% AR</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground text-red-500">Overdue</th>
                  </tr></thead>
                  <tbody>
                    {arLoading ? (
                      <tr><td colSpan={6} className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                    ) : (arData?.stores || []).map((s: any) => (
                      <tr key={s.id} className={cn('border-b hover:bg-muted/30', s.overdue_amount > 0 && 'bg-red-50/30 dark:bg-red-950/10')}>
                        <td className="py-3 px-4">
                          <p className="font-medium">{s.store_name}</p>
                          <p className="text-xs text-muted-foreground">{s.owner_name}</p>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={s.tier === 'agent' ? 'default' : 'secondary'} className="text-xs">{s.tier}</Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-medium">{fmtCur(s.credit_used)}</td>
                        <td className="py-3 px-4 text-right text-muted-foreground">{fmtCur(s.credit_limit)}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div className={cn('h-full rounded-full', s.ar_percentage >= 90 ? 'bg-red-500' : s.ar_percentage >= 70 ? 'bg-amber-500' : 'bg-emerald-500')}
                                style={{ width: `${Math.min(100, s.ar_percentage)}%` }} />
                            </div>
                            <span className="text-xs w-8">{s.ar_percentage}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {s.overdue_amount > 0
                            ? <span className="font-bold text-red-500">{fmtCur(s.overdue_amount)}</span>
                            : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Komisi Salesman ── */}
        <TabsContent value="commission" className="space-y-6 mt-4">
          <Card>
            <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-end justify-between">
              <div className="flex gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Bulan</Label>
                  <select className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={commMonth} onChange={e => setCommMonth(Number(e.target.value))}>
                    {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tahun</Label>
                  <select className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={commYear} onChange={e => setCommYear(Number(e.target.value))}>
                    {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => commData?.commissions && exportToCSV(
                commData.commissions.map((c: any) => ({
                  nama: c.salesman_name, bulan: commMonth, tahun: commYear,
                  target_revenue: c.target_revenue, actual_revenue: c.actual_revenue,
                  achievement_pct: c.achievement_pct, kunjungan: c.actual_visits,
                  order: c.actual_orders, komisi: c.estimated_commission,
                })), `komisi_salesman_${commMonth}_${commYear}`)}>
                <Download className="mr-2 h-4 w-4" />Export CSV
              </Button>
            </CardContent>
          </Card>

          {commData?.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Salesman', value: commData.summary.total_salesman, cls: '' },
                { label: 'Total Revenue', value: fmtCur(commData.summary.total_revenue), cls: 'text-emerald-500' },
                { label: 'Total Komisi', value: fmtCur(commData.summary.total_commission), cls: 'text-blue-500' },
                { label: 'Avg Achievement', value: `${commData.summary.avg_achievement}%`, cls: commData.summary.avg_achievement >= 100 ? 'text-emerald-500' : 'text-amber-500' },
              ].map(c => (
                <Card key={c.label}>
                  <CardContent className="p-4 text-center">
                    <p className={cn('text-2xl font-bold', c.cls)}>{c.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Salesman</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Target</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actual</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">Capaian</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">Kunjungan</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Est. Komisi</th>
                  </tr></thead>
                  <tbody>
                    {commLoading ? (
                      <tr><td colSpan={6} className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                    ) : (commData?.commissions || []).length === 0 ? (
                      <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">Tidak ada data untuk periode ini</td></tr>
                    ) : (commData?.commissions || []).map((c: any) => {
                      const pct = c.achievement_pct || 0;
                      return (
                        <tr key={c.salesman_id} className="border-b hover:bg-muted/30">
                          <td className="py-3 px-4 font-medium">{c.salesman_name}</td>
                          <td className="py-3 px-4 text-right text-muted-foreground">{fmtM(c.target_revenue || 0)}</td>
                          <td className="py-3 px-4 text-right font-medium">{fmtM(c.actual_revenue || 0)}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-emerald-500' : pct >= 75 ? 'bg-blue-500' : 'bg-amber-500')}
                                  style={{ width: `${Math.min(100, pct)}%` }} />
                              </div>
                              <span className={cn('text-xs w-8', pct >= 100 ? 'text-emerald-500 font-bold' : '')}>{pct}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">{c.actual_visits || 0}</td>
                          <td className="py-3 px-4 text-right font-bold text-blue-500">{fmtCur(c.estimated_commission || 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Inventori ── */}
        <TabsContent value="inventory" className="space-y-6 mt-4">
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => inventoryData?.products && exportToCSV(
              inventoryData.products.map((p: Product) => ({
                sku: p.sku, nama_produk: p.name, stok: p.stock_quantity,
                reorder_level: p.reorder_level, harga: p.price, nilai_stok: p.stock_quantity * p.price,
              })), 'laporan_inventori')}>
              <Download className="mr-2 h-4 w-4" />Export CSV
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { title: 'Total Produk', value: inventoryData?.summary?.totalProducts || 0, icon: Package, cls: '' },
              { title: 'Stok Menipis', value: inventoryData?.summary?.lowStock || 0, icon: TrendingUp, cls: 'text-amber-500' },
              { title: 'Stok Habis', value: inventoryData?.summary?.outOfStock || 0, icon: Package, cls: 'text-destructive' },
              { title: 'Nilai Inventori', value: fmtCur(inventoryData?.summary?.totalValue || 0), icon: TrendingUp, cls: 'text-emerald-500' },
            ].map(c => (
              <Card key={c.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{c.title}</CardTitle>
                  <c.icon className={cn('h-4 w-4 text-muted-foreground', c.cls)} />
                </CardHeader>
                <CardContent><div className={cn('text-2xl font-bold', c.cls)}>{c.value}</div></CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader><CardTitle>Status Inventori</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Produk</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">SKU</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Stok</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Nilai</th>
                  </tr></thead>
                  <tbody>
                    {inventoryData?.products?.slice(0,20).map((p: Product) => (
                      <tr key={p.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{p.name}</td>
                        <td className="py-3 px-4 text-muted-foreground">{p.sku}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={p.stock_quantity === 0 ? 'text-destructive font-medium' : p.stock_quantity <= p.reorder_level ? 'text-amber-500 font-medium' : 'text-emerald-500'}>
                            {p.stock_quantity}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">{fmtCur(p.stock_quantity * p.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Stok Menipis & Alert ── */}
        <TabsContent value="lowstock" className="space-y-6 mt-4">
          <Card>
            <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div>
                <p className="font-medium">Alert Stok Menipis via WhatsApp</p>
                <p className="text-sm text-muted-foreground">Kirim notifikasi ke semua nomor admin yang terdaftar</p>
              </div>
              <Button onClick={() => alertMutation.mutate()} disabled={alertMutation.isPending}>
                {alertMutation.isPending
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <Bell className="mr-2 h-4 w-4" />}
                Kirim Alert WA
              </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card className="border-amber-200 dark:border-amber-800">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-amber-500">{lowStockData?.count || 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Produk Stok Menipis</p>
              </CardContent>
            </Card>
            <Card className="border-red-200 dark:border-red-800">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-red-500">{lowStockData?.out_of_stock?.length || 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Produk Stok Habis</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />Daftar Produk Perlu Restok
            </CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Produk</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">SKU</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Kategori</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">Stok</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">Reorder</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">Status</th>
                  </tr></thead>
                  <tbody>
                    {lowStockLoading ? (
                      <tr><td colSpan={6} className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                    ) : (lowStockData?.low_stock || []).length === 0 ? (
                      <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">Semua stok aman 🎉</td></tr>
                    ) : (lowStockData?.low_stock || []).map((p: any) => (
                      <tr key={p.id} className={cn('border-b hover:bg-muted/30', p.stock_karton === 0 && 'bg-red-50/30 dark:bg-red-950/10')}>
                        <td className="py-3 px-4 font-medium">{p.name}</td>
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{p.sku}</td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">{p.categories?.name || '—'}</td>
                        <td className="py-3 px-4 text-center font-bold">
                          <span className={p.stock_karton === 0 ? 'text-red-500' : 'text-amber-500'}>{p.stock_karton}</span>
                        </td>
                        <td className="py-3 px-4 text-center text-muted-foreground">{p.reorder_level}</td>
                        <td className="py-3 px-4 text-center">
                          {p.stock_karton === 0
                            ? <Badge variant="destructive" className="text-xs">Habis</Badge>
                            : <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-0 text-xs">Menipis</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// BUG-06 FIX: un-comment recharts imports
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, FileText, Package, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import type { Order, Product } from '@/types';

// BUG-06 FIX: hapus _COLORS yang tidak dipakai, gunakan langsung
