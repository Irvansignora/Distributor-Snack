import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { orderService } from '@/services/orders';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Download, FileText, Search, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { Order } from '@/types';

// BUG-02 FIX: fungsi generate & download invoice sebagai HTML yang di-print ke PDF
function downloadInvoice(order: Order, user: { name?: string; company_name?: string; email?: string; phone?: string; address?: string } | null) {
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

  const items = order.order_items || [];
  const itemRows = items.map(item => `
    <tr>
      <td style="padding:8px;border:1px solid #e5e7eb;">${item.product_name || item.product?.name || '-'}</td>
      <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">${item.qty_karton ?? item.quantity ?? 0} karton</td>
      <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${formatCurrency((item.price_per_karton ?? item.unit_price) || 0)}</td>
      <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${formatCurrency((item.subtotal ?? item.total_price) || 0)}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <title>Invoice #${order.order_number || order.id.slice(0,8)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 32px; color: #111; }
    .header { display: flex; justify-content: space-between; margin-bottom: 32px; }
    .brand { font-size: 24px; font-weight: bold; color: #1e40af; }
    .brand small { display: block; font-size: 12px; color: #6b7280; font-weight: normal; }
    .invoice-title { font-size: 20px; font-weight: bold; text-align:right; }
    .invoice-meta { text-align:right; font-size: 13px; color: #6b7280; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 13px; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #1e40af; color: #fff; padding: 10px 8px; text-align: left; font-size: 13px; }
    td { font-size: 13px; }
    .totals { width: 300px; margin-left: auto; }
    .totals td { padding: 4px 8px; border: none; }
    .totals .grand { font-weight: bold; font-size: 15px; border-top: 2px solid #1e40af; }
    .footer { margin-top: 48px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 16px; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">SnackHub<small>Distributor Snack Terpercaya</small></div>
      <div style="margin-top:12px;font-size:13px;">
        <div>${user?.company_name || user?.name || '-'}</div>
        <div style="color:#6b7280">${user?.email || ''}</div>
        <div style="color:#6b7280">${user?.phone || ''}</div>
      </div>
    </div>
    <div>
      <div class="invoice-title">INVOICE</div>
      <div class="invoice-meta">
        <div>#${order.order_number || order.id.slice(0,8)}</div>
        <div>Tanggal: ${order.created_at ? format(new Date(order.created_at), 'dd MMMM yyyy') : '-'}</div>
        <div>Status: <strong>${order.payment_status?.toUpperCase()}</strong></div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Alamat Pengiriman</div>
    <div style="font-size:13px;">${
      typeof order.shipping_address === 'string'
        ? order.shipping_address
        : (order.shipping_address as any)?.address || user?.address || '-'
    }</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Produk</th>
        <th style="text-align:center;">Qty</th>
        <th style="text-align:right;">Harga Satuan</th>
        <th style="text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows || '<tr><td colspan="4" style="padding:12px;text-align:center;color:#6b7280;">Tidak ada detail item</td></tr>'}
    </tbody>
  </table>

  <table class="totals">
    <tr><td>Subtotal</td><td style="text-align:right;">${formatCurrency(order.subtotal || order.total)}</td></tr>
    <tr><td>PPN</td><td style="text-align:right;">${formatCurrency(order.tax || 0)}</td></tr>
    <tr><td>Diskon</td><td style="text-align:right;">-${formatCurrency(order.discount || 0)}</td></tr>
    <tr class="grand"><td>TOTAL</td><td style="text-align:right;">${formatCurrency(order.total)}</td></tr>
  </table>

  <div class="footer">
    Terima kasih telah berbelanja di SnackHub. Invoice ini digenerate otomatis.
  </div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    toast.error('Popup diblokir browser. Izinkan popup untuk download invoice.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 500);
}

export default function Invoices() {
  const [search, setSearch] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => orderService.getOrders({ limit: 100 }),
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const filteredOrders = data?.orders.filter(order =>
    order.payment_status === 'paid' &&
    (order.order_number?.toLowerCase().includes(search.toLowerCase()) ||
     order.id.toLowerCase().includes(search.toLowerCase()))
  );

  // BUG-02 FIX: handler download dengan fetch detail order agar dapat order_items
  const handleDownload = async (order: Order) => {
    setDownloadingId(order.id);
    try {
      const detail = await orderService.getOrder(order.id);
      downloadInvoice(detail.order, user);
    } catch {
      // fallback dengan data yang sudah ada
      downloadInvoice(order, user);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Invoices</h1>
        <p className="text-muted-foreground">Lihat dan download invoice pesanan Anda</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari invoice..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : filteredOrders?.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Belum ada invoice</h3>
          <p className="text-muted-foreground">Invoice muncul setelah pesanan Anda lunas</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredOrders?.map((order) => (
            <Card key={order.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Invoice #{order.order_number || order.id.slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">
                        {order.created_at ? format(new Date(order.created_at), 'MMMM dd, yyyy') : '-'}
                      </p>
                      <Badge variant="default" className="mt-1">Paid</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-bold text-lg">{formatCurrency(order.total)}</p>
                    {/* BUG-02 FIX: tombol download dengan fungsi nyata */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(order)}
                      disabled={downloadingId === order.id}
                    >
                      {downloadingId === order.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      Download
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
