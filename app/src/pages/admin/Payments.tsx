import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { paymentService } from '@/services/payments';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CreditCard, CheckCircle, XCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import type { Payment } from '@/types';

export default function Payments() {
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 10;

  const { data, refetch } = useQuery({
    queryKey: ['payments', page],
    queryFn: () => paymentService.getPayments({ page, limit: LIMIT }),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      paymentService.updateStatus(id, 'approved', notes),
    onSuccess: () => {
      toast.success('Pembayaran berhasil dikonfirmasi');
      setApproveDialogOpen(false);
      setNotes('');
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Gagal mengkonfirmasi pembayaran');
    },
  });

  // BUG FIX: reject sekarang buka dialog untuk isi alasan penolakan, bukan langsung reject
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      paymentService.updateStatus(id, 'rejected', reason),
    onSuccess: () => {
      toast.success('Pembayaran ditolak');
      setRejectDialogOpen(false);
      setRejectReason('');
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Gagal menolak pembayaran');
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">
            Manage and verify payment confirmations
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Payment ID</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Toko</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Order</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Amount</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Method</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.payments?.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No payments found</p>
                    </td>
                  </tr>
                ) : (
                  data?.payments?.map((payment) => (
                    <tr key={payment.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">#{payment.id.slice(0, 8)}</td>
                      {/* BUG FIX: tampilkan store name dari customer_stores (join di backend) */}
                      <td className="py-3 px-4">
                        {(payment as any).customer_stores?.store_name ||
                         payment.users?.company_name ||
                         payment.users?.name || '-'}
                      </td>
                      <td className="py-3 px-4">
                        {(payment as any).orders?.order_number
                          ? `#${(payment as any).orders.order_number}`
                          : `#${payment.order_id.slice(0, 8)}`}
                      </td>
                      <td className="py-3 px-4 font-medium">{formatCurrency(payment.amount)}</td>
                      <td className="py-3 px-4 capitalize">{payment.payment_method.replace('_', ' ')}</td>
                      <td className="py-3 px-4">
                        <Badge variant={
                          payment.status === 'verified' ? 'default' :
                          payment.status === 'rejected' ? 'destructive' :
                          'secondary'
                        }>
                          {payment.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex justify-center gap-2">
                          {payment.proof_url && (
                            <Button variant="ghost" size="icon" asChild>
                              <a href={payment.proof_url} target="_blank" rel="noopener noreferrer">
                                <Eye className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {payment.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-emerald-500"
                                onClick={() => {
                                  setSelectedPayment(payment);
                                  setNotes('');
                                  setApproveDialogOpen(true);
                                }}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => {
                                  setSelectedPayment(payment);
                                  setRejectReason('');
                                  setRejectDialogOpen(true);
                                }}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog: Approve */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Pembayaran</DialogTitle>
            <DialogDescription>
              Konfirmasi pembayaran sebesar {selectedPayment && formatCurrency(selectedPayment.amount)}?
              Kredit pelanggan dan status order akan diperbarui otomatis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Catatan (Opsional)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tambahkan catatan verifikasi..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={() => selectedPayment && approveMutation.mutate({ id: selectedPayment.id, notes })}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? 'Memproses...' : 'Konfirmasi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Reject — BUG FIX: dulu reject langsung tanpa alasan, sekarang minta alasan */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak Pembayaran</DialogTitle>
            <DialogDescription>
              Masukkan alasan penolakan untuk pembayaran sebesar {selectedPayment && formatCurrency(selectedPayment.amount)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Alasan Penolakan *</label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Contoh: Bukti transfer tidak terbaca, nominal tidak sesuai, dll."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedPayment && rejectMutation.mutate({ id: selectedPayment.id, reason: rejectReason })}
              disabled={rejectMutation.isPending || !rejectReason.trim()}
            >
              {rejectMutation.isPending ? 'Memproses...' : 'Tolak Pembayaran'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pagination */}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-4 text-sm text-muted-foreground">
            Page {page} of {data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
            disabled={page === data.pagination.totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
