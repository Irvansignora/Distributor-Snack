import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { orderService } from '@/services/orders';
import { paymentService } from '@/services/payments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingBag,
  Package,
  CreditCard,
  Clock,
  CheckCircle,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';

export default function SupplierDashboard() {
  const { data: ordersData } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => orderService.getOrders({ limit: 5 }),
  });

  // Payments data can be used later for notifications
  useQuery({
    queryKey: ['my-payments'],
    queryFn: () => paymentService.getPayments({ limit: 5 }),
  });

  const pendingOrders = ordersData?.orders.filter(o => o.status === 'pending').length || 0;
  const completedOrders = ordersData?.orders.filter(o => o.status === 'completed').length || 0;
  const totalSpent = ordersData?.orders
    .filter(o => o.status === 'completed')
    .reduce((sum, o) => sum + o.total, 0) || 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  return (
    <div className="space-y-6 p-4 lg:p-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Welcome back!</h1>
        <p className="text-muted-foreground">
          Here's an overview of your account and recent activity.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ordersData?.orders.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{pendingOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{completedOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalSpent)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Button asChild className="h-auto py-4 flex flex-col items-center gap-2">
          <NavLink to="/supplier/catalog">
            <ShoppingBag className="h-6 w-6" />
            <span>Browse Catalog</span>
          </NavLink>
        </Button>
        <Button variant="outline" asChild className="h-auto py-4 flex flex-col items-center gap-2">
          <NavLink to="/supplier/orders">
            <Package className="h-6 w-6" />
            <span>My Orders</span>
          </NavLink>
        </Button>
        <Button variant="outline" asChild className="h-auto py-4 flex flex-col items-center gap-2">
          <NavLink to="/supplier/invoices">
            <CreditCard className="h-6 w-6" />
            <span>Invoices</span>
          </NavLink>
        </Button>
        <Button variant="outline" asChild className="h-auto py-4 flex flex-col items-center gap-2">
          <NavLink to="/supplier/profile">
            <TrendingUp className="h-6 w-6" />
            <span>My Profile</span>
          </NavLink>
        </Button>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Orders</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <NavLink to="/supplier/orders">
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </NavLink>
          </Button>
        </CardHeader>
        <CardContent>
          {ordersData?.orders.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No orders yet</p>
              <Button asChild className="mt-4">
                <NavLink to="/supplier/catalog">Start Shopping</NavLink>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {ordersData?.orders.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium">#{order.order_number || order.id.slice(0, 8)}</p>
                    <p className="text-sm text-muted-foreground">
                      {order.created_at ? format(new Date(order.created_at), 'MMM dd, yyyy') : '-'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={
                      order.status === 'completed' ? 'default' :
                      order.status === 'pending' ? 'secondary' :
                      order.status === 'cancelled' ? 'destructive' :
                      'outline'
                    }>
                      {order.status}
                    </Badge>
                    <span className="font-medium">{formatCurrency(order.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
