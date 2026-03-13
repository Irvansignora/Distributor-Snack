import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { salesmanService } from '@/services/salesman';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  Store,
  ShoppingCart,
  MapPin,
  CreditCard,
  Target,
  Banknote,
  ChevronRight,
  CheckCircle2,
  Clock,
} from 'lucide-react';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

const formatMillions = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}rb`;
  return String(v);
};

export default function SalesmanDashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['salesman-dashboard'],
    queryFn: salesmanService.getDashboard,
    refetchInterval: 60_000,
  });

  const now = new Date();
  const greeting = now.getHours() < 11 ? 'Selamat pagi' : now.getHours() < 15 ? 'Selamat siang' : 'Selamat sore';
  const achievementPct = data?.month.achievement_pct ?? 0;

  return (
    <div className="space-y-0">
      {/* Hero header */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white px-4 pt-4 pb-8">
        <p className="text-orange-100 text-sm">{greeting},</p>
        <h1 className="text-2xl font-bold">{user?.name?.split(' ')[0]} 👋</h1>
        <p className="text-orange-100 text-xs mt-1">
          {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>

        {/* Achievement bar */}
        {data?.target && (
          <div className="mt-4 bg-white/15 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Target Bulan Ini</span>
              <span className="text-sm font-bold">{achievementPct}%</span>
            </div>
            <div className="h-2 bg-white/25 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-700"
                style={{ width: `${Math.min(achievementPct, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-xs text-orange-100">
              <span>Realisasi: {formatMillions(data.month.revenue)}</span>
              <span>Target: {formatMillions(data.target.target_revenue)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Stats pull-up */}
      <div className="-mt-5 px-4 space-y-3">
        {/* Today quick stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Kunjungan Hari Ini</span>
                <MapPin className="h-3.5 w-3.5 text-orange-500" />
              </div>
              {isLoading ? (
                <div className="h-7 w-10 bg-muted animate-pulse rounded" />
              ) : (
                <div className="text-2xl font-bold">{data?.today.visits ?? 0}</div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Order Bulan Ini</span>
                <ShoppingCart className="h-3.5 w-3.5 text-blue-500" />
              </div>
              {isLoading ? (
                <div className="h-7 w-10 bg-muted animate-pulse rounded" />
              ) : (
                <div className="text-2xl font-bold">{data?.month.orders ?? 0}</div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Revenue Bulan Ini</span>
                <TrendingUp className="h-3.5 w-3.5 text-green-500" />
              </div>
              {isLoading ? (
                <div className="h-5 w-20 bg-muted animate-pulse rounded" />
              ) : (
                <div className="text-base font-bold text-green-600">{formatMillions(data?.month.revenue ?? 0)}</div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Est. Komisi</span>
                <Banknote className="h-3.5 w-3.5 text-purple-500" />
              </div>
              {isLoading ? (
                <div className="h-5 w-16 bg-muted animate-pulse rounded" />
              ) : (
                <div className="text-base font-bold text-purple-600">{formatMillions(data?.month.estimated_commission ?? 0)}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* AR warning */}
        {(data?.total_ar ?? 0) > 0 && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 shadow-sm">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-amber-600" />
                <div>
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-200">Total Piutang Toko</p>
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{formatCurrency(data?.total_ar ?? 0)}</p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-xs">
                Perlu Ditagih
              </Badge>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2 px-0.5">Aksi Cepat</h2>
          <div className="grid grid-cols-2 gap-3">
            <NavLink to="/salesman/stores">
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Store className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Kunjungi Toko</p>
                    <p className="text-xs text-muted-foreground">{data?.stores_assigned ?? 0} toko</p>
                  </div>
                </CardContent>
              </Card>
            </NavLink>

            <NavLink to="/salesman/orders/new">
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Buat Order</p>
                    <p className="text-xs text-muted-foreground">Input pesanan</p>
                  </div>
                </CardContent>
              </Card>
            </NavLink>

            <NavLink to="/salesman/vehicle">
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                    <Target className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Stok Motor</p>
                    <p className="text-xs text-muted-foreground">Opname harian</p>
                  </div>
                </CardContent>
              </Card>
            </NavLink>

            <NavLink to="/salesman/performance">
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-purple-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Performa</p>
                    <p className="text-xs text-muted-foreground">Lihat progress</p>
                  </div>
                </CardContent>
              </Card>
            </NavLink>
          </div>
        </div>

        {/* Tagihan info */}
        {data?.month && (
          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Pembayaran Dikumpulkan</span>
                </div>
                <span className="text-sm font-bold text-green-600">{formatMillions(data.month.payment_collected)}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Spacer */}
      <div className="h-4" />
    </div>
  );
}
