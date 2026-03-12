import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { orderService } from '@/services/orders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// Badge component not used
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Package, Clock, CheckCircle, Truck, XCircle, Download } from 'lucide-react';
import { format } from 'date-fns';
import type { OrderStatus } from '@/types';

const getStatusIcon = (status: OrderStatus) => {
  switch (status) {
    case 'pending': return Clock;
    case 'confirmed': return CheckCircle;
    case 'packing': return Package;
    case 'shipped': return Truck;
    case 'delivered': return CheckCircle;
    case 'completed': return CheckCircle;
    case 'cancelled': return XCircle;
    default: return Clock;
  }
};

const getStatusColor = (status: OrderStatus) => {
  switch (status) {
    case 'completed': return 'text-emerald-500';
    case 'pending': return 'text-amber-500';
    case 'confirmed': return 'text-blue-500';
    case 'packing': return 'text-purple-500';
    case 'shipped': return 'text-cyan-500';
    case 'delivered': return 'text-teal-500';
    case 'cancelled': return 'text-red-500';
    default: return 'text-gray-500';
  }
};

export default function SupplierOrderDetail() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => orderService.getOrder(id!),
    enabled: !!id,
  });

  const formatCurrency = (value: number | null | undefined) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value || 0);
  };

  if (isLoading) {
    return <div className="p-4">Loading...</div>;
  }

  const order = data?.order;
  if (!order) {
    return <div className="p-4">Order not found</div>;
  }

  const StatusIcon = getStatusIcon(order.status);

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <NavLink to="/supplier/orders">
            <ArrowLeft className="h-4 w-4" />
          </NavLink>
        </Button>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">
            Order #{order.order_number || order.id.slice(0, 8)}
          </h1>
          <p className="text-muted-foreground">
            Placed on {order.created_at ? format(new Date(order.created_at), 'MMMM dd, yyyy') : '-'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <div className={`w-12 h-12 rounded-full bg-background flex items-center justify-center ${getStatusColor(order.status)}`}>
                  <StatusIcon className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-lg capitalize">{order.status}</p>
                  <p className="text-sm text-muted-foreground">
                    {order.status === 'pending' && 'Your order is awaiting confirmation'}
                    {order.status === 'confirmed' && 'Your order has been confirmed'}
                    {order.status === 'packing' && 'Your order is being packed'}
                    {order.status === 'shipped' && 'Your order is on the way'}
                    {order.status === 'delivered' && 'Your order has been delivered'}
                    {order.status === 'completed' && 'Your order is complete'}
                    {order.status === 'cancelled' && 'Your order has been cancelled'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.order_items?.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 p-4 border rounded-lg">
                    {item.product?.image_url ? (
                      <img
                        src={item.product.image_url}
                        alt={item.product_name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.quantity} x {formatCurrency(item.unit_price)}
                      </p>
                    </div>
                    <p className="font-bold">{formatCurrency(item.total_price)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(order.subtotal || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatCurrency((order.tax || 0))}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>{formatCurrency(order.total || 0)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shipping Information</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {order.shipping_address || 'No shipping address provided'}
              </p>
              {order.tracking_number && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground">Tracking Number</p>
                  <p className="font-medium">{order.tracking_number}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Download Invoice
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
