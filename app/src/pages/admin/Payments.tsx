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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notes, setNotes] = useState('');

  const { data, refetch } = useQuery({
    queryKey: ['payments'],
    queryFn: () => paymentService.getPayments(),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      paymentService.updateStatus(id, 'approved', notes),
    onSuccess: () => {
      toast.success('Payment approved');
      setDialogOpen(false);
      refetch();
    },
    onError: () => {
      toast.error('Failed to approve payment');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      paymentService.updateStatus(id, 'rejected', notes),
    onSuccess: () => {
      toast.success('Payment rejected');
      setDialogOpen(false);
      refetch();
    },
    onError: () => {
      toast.error('Failed to reject payment');
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
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Supplier</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Order</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Amount</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Method</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No payments found</p>
                    </td>
                  </tr>
                ) : (
                  data?.payments.map((payment) => (
                    <tr key={payment.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">#{payment.id.slice(0, 8)}</td>
                      <td className="py-3 px-4">{payment.users?.company_name || payment.users?.name}</td>
                      <td className="py-3 px-4">#{payment.order_id.slice(0, 8)}</td>
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
                                  setDialogOpen(true);
                                }}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => rejectMutation.mutate({ id: payment.id })}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Payment</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this payment of {selectedPayment && formatCurrency(selectedPayment.amount)}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (Optional)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this payment approval"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedPayment && approveMutation.mutate({ id: selectedPayment.id, notes })}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? 'Approving...' : 'Approve Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
