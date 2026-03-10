import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { orderService } from '@/services/orders';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Download, FileText, Search } from 'lucide-react';
import { format } from 'date-fns';

export default function Invoices() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => orderService.getOrders({ limit: 50 }),
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const filteredOrders = data?.orders.filter(order =>
    order.payment_status === 'paid' &&
    (order.order_number?.toLowerCase().includes(search.toLowerCase()) ||
     order.id.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Invoices</h1>
        <p className="text-muted-foreground">View and download your invoices</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : filteredOrders?.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No invoices found</h3>
          <p className="text-muted-foreground">Invoices will appear here after your orders are paid</p>
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
                    <Button variant="outline" size="sm">
                      <Download className="mr-2 h-4 w-4" />
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
