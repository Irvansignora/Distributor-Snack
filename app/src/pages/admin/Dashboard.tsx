import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboard';
import { orderService } from '@/services/orders';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Banknote, 
  ShoppingCart, 
  Package, 
  Users, 
  AlertTriangle,
  ArrowRight,
  Calendar
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
// ChartData type used implicitly through recharts

function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  trend,
  trendUp,
  alert 
}: { 
  title: string; 
  value: string; 
  description?: string; 
  icon: React.ElementType;
  trend?: string;
  trendUp?: boolean;
  alert?: boolean;
}) {
  return (
    <Card className={cn(alert && "border-destructive/50")}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={cn(
          "p-2 rounded-lg",
          alert ? "bg-destructive/10" : "bg-primary/10"
        )}>
          <Icon className={cn("h-4 w-4", alert ? "text-destructive" : "text-primary")} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {trend && (
          <div className="flex items-center gap-1 mt-1">
            {trendUp ? (
              <TrendingUp className="h-3 w-3 text-emerald-500" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-500" />
            )}
            <span className={cn("text-xs", trendUp ? "text-emerald-500" : "text-red-500")}>
              {trend}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [chartPeriod, setChartPeriod] = useState<'7d' | '30d'>('7d');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardService.getStats,
  });

  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ['dashboard-chart', chartPeriod],
    queryFn: () => dashboardService.getChartData(chartPeriod),
  });

  const { data: recentOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ['recent-orders'],
    queryFn: () => orderService.getOrders({ limit: 5 }),
  });

  const formatCurrency = (value: number | null | undefined) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value || 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with your business.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {format(new Date(), 'EEEE, MMMM do, yyyy')}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's Sales"
          value={statsLoading ? '...' : formatCurrency(stats?.todaySales || 0)}
          description="Total revenue today"
          icon={Banknote}
          trend="+12% from yesterday"
          trendUp={true}
        />
        <StatCard
          title="Today's Orders"
          value={statsLoading ? '...' : (stats?.todayOrders || 0).toString()}
          description="Orders received today"
          icon={ShoppingCart}
          trend="+5% from yesterday"
          trendUp={true}
        />
        <StatCard
          title="Pending Orders"
          value={statsLoading ? '...' : (stats?.pendingOrders || 0).toString()}
          description="Orders awaiting approval"
          icon={Package}
          alert={stats?.pendingOrders ? stats.pendingOrders > 10 : false}
        />
        <StatCard
          title="Low Stock Items"
          value={statsLoading ? '...' : (stats?.lowStockCount || 0).toString()}
          description="Products below reorder level"
          icon={AlertTriangle}
          alert={stats?.lowStockCount ? stats.lowStockCount > 0 : false}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-7">
        {/* Sales Chart */}
        <Card className="lg:col-span-5">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Sales Overview</CardTitle>
              <CardDescription>Revenue trends over time</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={chartPeriod === '7d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartPeriod('7d')}
              >
                7 Days
              </Button>
              <Button
                variant={chartPeriod === '30d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartPeriod('30d')}
              >
                30 Days
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {!chartLoading && chartData?.data && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData.data}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [formatCurrency(value), 'Sales']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="sales" 
                      stroke="hsl(var(--primary))" 
                      fillOpacity={1} 
                      fill="url(#colorSales)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
            <CardDescription>This month's performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Banknote className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Monthly Revenue</p>
                  <p className="text-xs text-muted-foreground">
                    {statsLoading ? '...' : formatCurrency(stats?.monthSales || 0)}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Users className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Total Suppliers</p>
                  <p className="text-xs text-muted-foreground">
                    {statsLoading ? '...' : stats?.totalSuppliers || 0}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Package className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Total Products</p>
                  <p className="text-xs text-muted-foreground">
                    {statsLoading ? '...' : stats?.totalProducts || 0}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Latest orders from your suppliers</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="/admin/orders">
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Order ID</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Supplier</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {ordersLoading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">Loading...</td>
                  </tr>
                ) : recentOrders?.orders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">No orders yet</td>
                  </tr>
                ) : (
                  recentOrders?.orders.map((order) => (
                    <tr key={order.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 text-sm font-medium">#{order.order_number || order.id.slice(0, 8)}</td>
                      <td className="py-3 px-4 text-sm">{order.users?.company_name || order.users?.name}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {order.created_at ? format(new Date(order.created_at), 'MMM dd, yyyy') : '-'}
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
                      <td className="py-3 px-4 text-sm text-right font-medium">
                        {formatCurrency(order.total || 0)}
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
  );
}
