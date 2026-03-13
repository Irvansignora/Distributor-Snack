import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { salesmanService } from '@/services/salesman';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  Target,
  Banknote,
  MapPin,
  ShoppingCart,
  Trophy,
  Star,
  Loader2,
  CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

const formatM = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}rb`;
  return String(v);
};

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function SalesmanPerformance() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data, isLoading } = useQuery({
    queryKey: ['salesman-performance', month, year],
    queryFn: () => salesmanService.getPerformance(month, year),
  });

  const ach = data?.achievement;
  const daily = data?.daily || [];
  const achievementPct = ach?.achievement_pct ?? 0;
  const isBonus = ach && ach.bonus_threshold > 0 && (ach.actual_revenue >= ach.bonus_threshold);

  // Chart data - last 30 days of the month or daily
  const chartData = daily.map(d => ({
    day: new Date(d.date).getDate(),
    revenue: d.revenue,
    visits: d.visits,
  }));

  return (
    <div className="px-4 pt-4 space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Performa Saya</h1>
          <p className="text-xs text-muted-foreground">Target & realisasi penjualan</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Select value={String(month)} onValueChange={v => setMonth(parseInt(v))}>
            <SelectTrigger className="h-8 text-xs w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)} className="text-xs">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
            <SelectTrigger className="h-8 text-xs w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map(y => (
                <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-7 w-7 animate-spin text-orange-500" />
        </div>
      ) : !ach ? (
        <div className="text-center py-16">
          <Target className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Belum ada target bulan ini</p>
          <p className="text-sm text-muted-foreground">Hubungi admin untuk set target</p>
        </div>
      ) : (
        <>
          {/* Achievement Hero */}
          <div className={cn(
            'rounded-2xl p-5 text-white',
            achievementPct >= 100
              ? 'bg-gradient-to-br from-green-500 to-emerald-600'
              : achievementPct >= 75
              ? 'bg-gradient-to-br from-blue-500 to-blue-600'
              : achievementPct >= 50
              ? 'bg-gradient-to-br from-orange-500 to-orange-600'
              : 'bg-gradient-to-br from-gray-500 to-gray-600'
          )}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm opacity-80">{MONTHS[month - 1]} {year}</p>
                <p className="text-3xl font-black">{achievementPct}%</p>
                <p className="text-sm opacity-80">pencapaian target</p>
              </div>
              <div className="text-right">
                {achievementPct >= 100 && <Trophy className="h-10 w-10 opacity-90 mb-1 ml-auto" />}
                {achievementPct >= 100
                  ? <Badge100 />
                  : achievementPct >= 75
                  ? <BadgeGood />
                  : null
                }
              </div>
            </div>
            <div className="h-2.5 bg-white/25 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(achievementPct, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs opacity-80">
              <span>Realisasi: {formatM(ach.actual_revenue)}</span>
              <span>Target: {formatM(ach.target_revenue)}</span>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-xs text-muted-foreground">Revenue</span>
                </div>
                <p className="text-base font-bold text-green-600">{formatM(ach.actual_revenue)}</p>
                <p className="text-[10px] text-muted-foreground">target {formatM(ach.target_revenue)}</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <MapPin className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Kunjungan</span>
                </div>
                <p className="text-base font-bold text-blue-600">{ach.actual_visits}</p>
                <p className="text-[10px] text-muted-foreground">target {ach.target_visits}</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <ShoppingCart className="h-3.5 w-3.5 text-orange-500" />
                  <span className="text-xs text-muted-foreground">Order Diambil</span>
                </div>
                <p className="text-base font-bold">{ach.actual_orders}</p>
                <p className="text-[10px] text-muted-foreground">{ach.active_days} hari aktif</p>
              </CardContent>
            </Card>

            <Card className={cn('shadow-sm', isBonus && 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20')}>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Banknote className={cn('h-3.5 w-3.5', isBonus ? 'text-yellow-500' : 'text-purple-500')} />
                  <span className="text-xs text-muted-foreground">
                    {isBonus ? '🎉 Komisi + Bonus' : 'Est. Komisi'}
                  </span>
                </div>
                <p className={cn('text-base font-bold', isBonus ? 'text-yellow-600' : 'text-purple-600')}>
                  {formatM(ach.estimated_commission + (isBonus ? ach.bonus_amount : 0))}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {(ach.commission_rate * 100).toFixed(1)}% × revenue
                  {isBonus && ` + ${formatM(ach.bonus_amount)} bonus`}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Bonus progress */}
          {ach.bonus_threshold > 0 && !isBonus && (
            <Card className="border-dashed border-yellow-300 shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium">Progress Bonus</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden mb-1">
                  <div
                    className="h-full bg-yellow-400 rounded-full"
                    style={{ width: `${Math.min((ach.actual_revenue / ach.bonus_threshold) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatM(ach.actual_revenue)}</span>
                  <span>Bonus {formatCurrency(ach.bonus_amount)} kalau capai {formatM(ach.bonus_threshold)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Daily Revenue Chart */}
          {chartData.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Revenue Harian
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={v => formatM(v)} tick={{ fontSize: 9 }} width={35} />
                    <Tooltip
                      formatter={(v: any) => [formatCurrency(v), 'Revenue']}
                      labelFormatter={(l) => `Tgl ${l}`}
                    />
                    <Bar dataKey="revenue" radius={[3, 3, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.revenue > 0 ? '#f97316' : '#e5e7eb'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Badge100() {
  return (
    <div className="bg-white/20 rounded-full px-2 py-0.5 text-xs font-bold">
      🏆 Target Tercapai!
    </div>
  );
}

function BadgeGood() {
  return (
    <div className="bg-white/20 rounded-full px-2 py-0.5 text-xs font-bold">
      💪 Hampir Sampai
    </div>
  );
}
