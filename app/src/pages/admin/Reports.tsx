import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportService } from '@/services/reports';
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
const CHART_COLOR = '#6366f1';

// BUG-06 FIX: fungsi export CSV
function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    toast.error('Tidak ada data untuk diekspor');
    return;
  }
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h] ?? '';
        return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
      }).join(',')
    ),
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${format(new Date(), 'yyyyMMdd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`${filename}.csv berhasil diunduh`);
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

export default function Reports() {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  const { data: salesData } = useQuery({
    queryKey: ['sales-report', startDate, endDate],
    queryFn: () => reportService.getSalesReport({
      start_date: startDate?.toISOString(),
      end_date: endDate?.toISOString(),
    }),
  });

  const { data: inventoryData } = useQuery({
    queryKey: ['inventory-report'],
    queryFn: reportService.getInventoryReport,
  });

  // BUG-06 FIX: fungsi Export All — export kedua laporan sekaligus
  const handleExportAll = () => {
    if (salesData?.orders) {
      exportToCSV(
        salesData.orders.map((o: Order) => ({
          order_number: o.order_number || o.id.slice(0, 8),
          tanggal: o.created_at ? format(new Date(o.created_at), 'yyyy-MM-dd') : '-',
          status: o.status,
          payment_status: o.payment_status,
          total: o.total,
        })),
        'laporan_penjualan'
      );
    }
    if (inventoryData?.products) {
      exportToCSV(
        inventoryData.products.map((p: Product) => ({
          sku: p.sku,
          nama_produk: p.name,
          stok: p.stock_quantity,
          reorder_level: p.reorder_level,
          harga: p.price,
          nilai_stok: p.stock_quantity * p.price,
        })),
        'laporan_inventori'
      );
    }
  };

  // Siapkan data chart: grouping order per tanggal
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">Lihat dan ekspor laporan bisnis</p>
        </div>
        {/* BUG-06 FIX: Export All tombol dengan handler nyata */}
        <Button variant="outline" onClick={handleExportAll}>
          <Download className="mr-2 h-4 w-4" />
          Export All (CSV)
        </Button>
      </div>

      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">
            <TrendingUp className="mr-2 h-4 w-4" />
            Laporan Penjualan
          </TabsTrigger>
          <TabsTrigger value="inventory">
            <Package className="mr-2 h-4 w-4" />
            Laporan Inventori
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block">Dari Tanggal</label>
                  <Input
                    type="date"
                    value={startDate?.toISOString().split('T')[0] || ''}
                    onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : undefined)}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block">Sampai Tanggal</label>
                  <Input
                    type="date"
                    value={endDate?.toISOString().split('T')[0] || ''}
                    onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : undefined)}
                  />
                </div>
                {/* BUG-06 FIX: tombol export per tab dengan handler */}
                <Button
                  variant="outline"
                  onClick={() => salesData?.orders && exportToCSV(
                    salesData.orders.map((o: Order) => ({
                      order_number: o.order_number || o.id.slice(0, 8),
                      tanggal: o.created_at ? format(new Date(o.created_at), 'yyyy-MM-dd') : '-',
                      status: o.status,
                      payment_status: o.payment_status,
                      total: o.total,
                    })),
                    'laporan_penjualan'
                  )}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Penjualan</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(salesData?.summary?.totalSales || 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Pesanan</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{salesData?.summary?.totalOrders || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Rata-rata Pesanan</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(salesData?.summary?.averageOrder || 0)}</div>
              </CardContent>
            </Card>
          </div>

          {/* BUG-06 FIX: chart penjualan aktif */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Grafik Penjualan (14 Hari Terakhir)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => [formatCurrency(v), 'Total']} />
                    <Bar dataKey="total" fill={CHART_COLOR} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Pesanan Terbaru</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">No. Pesanan</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Tanggal</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesData?.orders?.slice(0, 10).map((order) => (
                      <tr key={order.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">#{order.order_number || order.id.slice(0, 8)}</td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {order.created_at ? format(new Date(order.created_at), 'dd MMM yyyy') : '-'}
                        </td>
                        <td className="py-3 px-4 capitalize">{order.status}</td>
                        <td className="py-3 px-4 text-right font-medium">{formatCurrency(order.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-6">
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => inventoryData?.products && exportToCSV(
                inventoryData.products.map((p: Product) => ({
                  sku: p.sku,
                  nama_produk: p.name,
                  stok: p.stock_quantity,
                  reorder_level: p.reorder_level,
                  harga: p.price,
                  nilai_stok: p.stock_quantity * p.price,
                })),
                'laporan_inventori'
              )}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Produk</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{inventoryData?.summary?.totalProducts || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Stok Menipis</CardTitle>
                <TrendingUp className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-500">{inventoryData?.summary?.lowStock || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Stok Habis</CardTitle>
                <Package className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{inventoryData?.summary?.outOfStock || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Nilai Inventori</CardTitle>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-500">{formatCurrency(inventoryData?.summary?.totalValue || 0)}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Status Inventori</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Produk</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">SKU</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Stok</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryData?.products?.slice(0, 20).map((product) => (
                      <tr key={product.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{product.name}</td>
                        <td className="py-3 px-4 text-muted-foreground">{product.sku}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={
                            product.stock_quantity === 0 ? 'text-destructive font-medium' :
                            product.stock_quantity <= product.reorder_level ? 'text-amber-500 font-medium' :
                            'text-emerald-500'
                          }>
                            {product.stock_quantity}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">{formatCurrency(product.stock_quantity * product.price)}</td>
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
