import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supplierService } from '@/services/suppliers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
// Tabs component not used currently
import { ArrowLeft, Building2, Mail, Phone, MapPin, Package, Banknote } from 'lucide-react';
import { format } from 'date-fns';

export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['supplier', id],
    queryFn: () => supplierService.getSupplier(id!),
    enabled: !!id,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Memuat data supplier...</p>
        </div>
      </div>
    );
  }

  const supplier = data?.supplier;
  if (!supplier) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Building2 className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Supplier tidak ditemukan</h2>
        <Button onClick={() => navigate('/admin/suppliers')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali ke Daftar Supplier
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/admin/suppliers')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {supplier.company_name || supplier.name}
          </h1>
          <p className="text-muted-foreground">Detail Pelanggan</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{supplier.name}</h3>
                  <Badge variant={supplier.status === 'active' ? 'default' : 'secondary'}>
                    {supplier.status}
                  </Badge>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{supplier.email}</span>
                </div>
                {supplier.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{supplier.phone}</span>
                  </div>
                )}
                {supplier.address && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{supplier.address}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informasi Kredit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Limit Kredit</p>
                <p className="text-2xl font-bold">{formatCurrency(supplier.credit_limit || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Kredit Terpakai</p>
                <p className="text-2xl font-bold">{formatCurrency(supplier.current_credit || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Kredit Tersedia</p>
                <p className="text-2xl font-bold text-emerald-500">
                  {formatCurrency((supplier.credit_limit || 0) - (supplier.current_credit || 0))}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Statistik Pesanan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span>Total Pesanan</span>
                </div>
                <span className="font-bold">{data?.stats?.totalOrders || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-emerald-500" />
                  <span>Selesai</span>
                </div>
                <span className="font-bold">{data?.stats?.completedOrders || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-muted-foreground" />
                  <span>Total Belanja</span>
                </div>
                <span className="font-bold">{formatCurrency(data?.stats?.totalSpent || 0)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Riwayat Pesanan</CardTitle>
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
                    {data?.orders?.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-muted-foreground">No orders yet</td>
                      </tr>
                    ) : (
                      data?.orders?.map((order) => (
                        <tr key={order.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4 font-medium">
                            #{order.order_number || order.id.slice(0, 8)}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {order.created_at ? format(new Date(order.created_at), 'dd MMM yyyy') : '-'}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={
                              order.status === 'completed' ? 'default' :
                              order.status === 'pending' ? 'secondary' :
                              order.status === 'cancelled' ? 'destructive' :
                              'outline'
                            }>
                              {order.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right font-medium">
                            {formatCurrency(order.total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
