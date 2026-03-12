import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { orderService } from '@/services/orders';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Package, Eye, Clock, CheckCircle, Truck, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { OrderStatus } from '@/types';

const statusOptions = [
  { value: 'all', label: 'All Orders' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'packing', label: 'Packing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function MyOrders() {
  const [status, setStatus] = useState<OrderStatus | 'all'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['my-orders', status],
    queryFn: () => orderService.getOrders({
      status: status === 'all' ? undefined : status,
      limit: 20,
    }),
  });

  const formatCurrency = (value: number | null | undefined) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value || 0);
  };

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'confirmed': return <CheckCircle className="h-4 w-4" />;
      case 'packing': return <Package className="h-4 w-4" />;
      case 'shipped': return <Truck className="h-4 w-4" />;
      case 'delivered': return <CheckCircle className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'cancelled': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">My Orders</h1>
        <p className="text-muted-foreground">Track and manage your orders</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus | 'all')}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : data?.orders.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No orders found</h3>
          <p className="text-muted-foreground mb-4">Start by browsing our catalog</p>
          <Button asChild>
            <NavLink to="/supplier/catalog">Browse Catalog</NavLink>
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {data?.orders.map((order) => (
            <Card key={order.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">#{order.order_number || order.id.slice(0, 8)}</span>
                      <Badge variant={
                        order.status === 'completed' ? 'default' :
                        order.status === 'pending' ? 'secondary' :
                        order.status === 'cancelled' ? 'destructive' :
                        'outline'
                      }>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(order.status)}
                          {order.status}
                        </span>
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {order.created_at ? format(new Date(order.created_at), 'MMMM dd, yyyy') : '-'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {order.order_items?.length || 0} item(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-lg">{formatCurrency(order.total || 0)}</p>
                      <p className="text-xs text-muted-foreground">
                        Payment: {order.payment_status}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <NavLink to={`/supplier/orders/${order.id}`}>
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </NavLink>
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
