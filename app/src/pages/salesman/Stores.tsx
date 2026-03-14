import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NavLink, useNavigate } from 'react-router-dom';
import { salesmanService } from '@/services/salesman';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Search,
  MapPin,
  CreditCard,
  Clock,
  AlertTriangle,
  CheckCircle2,
  LogIn,
  Loader2,
  Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { SalesmanStore } from '@/services/salesman';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

function getARColor(pct: number) {
  if (pct >= 90) return 'text-destructive';
  if (pct >= 70) return 'text-amber-500';
  return 'text-green-500';
}

function getVisitBadge(days: number | null | undefined) {
  if (days == null) return { label: 'Belum pernah', color: 'text-muted-foreground' };
  if (days === 0) return { label: 'Hari ini', color: 'text-green-500' };
  if (days === 1) return { label: 'Kemarin', color: 'text-blue-500' };
  if (days <= 7) return { label: `${days} hari lalu`, color: 'text-muted-foreground' };
  return { label: `${days} hari lalu`, color: 'text-amber-500' };
}

export default function SalesmanStores() {
  const [search, setSearch] = useState('');
  const [checkinStore, setCheckinStore] = useState<SalesmanStore | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['salesman-stores', search],
    queryFn: () => salesmanService.getStores({ search }),
    staleTime: 30_000,
  });

  const checkinMutation = useMutation({
    mutationFn: (payload: Parameters<typeof salesmanService.checkin>[0]) =>
      salesmanService.checkin(payload),
    onSuccess: (result) => {
      toast.success('Check-in berhasil!');
      setCheckinStore(null);
      queryClient.invalidateQueries({ queryKey: ['salesman-stores'] });
      queryClient.invalidateQueries({ queryKey: ['salesman-dashboard'] });
      // Navigate to store detail with visit ID
      navigate(`/salesman/stores/${checkinStore?.id}?visit=${result.visit.id}`);
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.error || 'Gagal check-in');
    },
  });

  const handleCheckin = () => {
    if (!checkinStore) return;
    setIsGettingLocation(true);

    const doCheckin = (lat?: number, lng?: number) => {
      checkinMutation.mutate({
        store_id: checkinStore.id,
        lat,
        lng,
      });
      setIsGettingLocation(false);
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => doCheckin(pos.coords.latitude, pos.coords.longitude),
        () => doCheckin(), // without GPS if denied
        { timeout: 5000 }
      );
    } else {
      doCheckin();
    }
  };

  const stores = data?.stores || [];

  return (
    <div className="space-y-4 px-4 pt-4">
      <div>
        <h1 className="text-xl font-bold">Daftar Toko</h1>
        <p className="text-xs text-muted-foreground">{stores.length} toko di rute kamu</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari nama toko..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-7 w-7 animate-spin text-orange-500" />
        </div>
      ) : stores.length === 0 ? (
        <div className="text-center py-16">
          <Store className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Belum ada toko di rute kamu</p>
          <p className="text-sm text-muted-foreground">Hubungi admin untuk assign toko</p>
        </div>
      ) : (
        <div className="space-y-3 pb-4">
          {stores.map((store, idx) => {
            const visitBadge = getVisitBadge(store.days_since_visit);
            return (
              <Card key={store.id} className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Route number */}
                    <div className="w-7 h-7 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-orange-500">{idx + 1}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <NavLink to={`/salesman/stores/${store.id}`}>
                            <h3 className="font-semibold text-sm leading-tight hover:text-orange-500 transition-colors">
                              {store.store_name}
                            </h3>
                          </NavLink>
                          <p className="text-xs text-muted-foreground">{store.owner_name}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] px-1.5 py-0 flex-shrink-0', {
                            'border-emerald-300 text-emerald-600 bg-emerald-50': store.tier === 'agent',
                            'border-amber-300 text-amber-600 bg-amber-50': store.tier === 'reseller',
                          })}
                        >
                          {store.tier}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1 mb-2">
                        <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <p className="text-xs text-muted-foreground truncate">{store.address_line}</p>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {/* AR */}
                          {store.credit_limit > 0 && (
                            <div className="flex items-center gap-1">
                              <CreditCard className="h-3 w-3 text-muted-foreground" />
                              <span className={cn('text-xs font-medium', getARColor(store.ar_percentage))}>
                                AR {store.ar_percentage}%
                              </span>
                            </div>
                          )}
                          {/* Last visit */}
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className={cn('text-xs', visitBadge.color)}>{visitBadge.label}</span>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs px-2.5 bg-orange-500 hover:bg-orange-600"
                          onClick={() => setCheckinStore(store)}
                        >
                          <LogIn className="h-3 w-3 mr-1" />
                          Check-in
                        </Button>
                      </div>

                      {/* AR warning bar */}
                      {store.ar_percentage >= 70 && (
                        <div className="mt-2 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 rounded p-1.5">
                          <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
                          <span className="text-[10px] text-amber-700 dark:text-amber-300">
                            Hutang {formatCurrency(store.credit_used)} / limit {formatCurrency(store.credit_limit)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Check-in Confirmation Dialog */}
      <Dialog open={!!checkinStore} onOpenChange={(o) => !o && setCheckinStore(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check-in ke Toko</DialogTitle>
            <DialogDescription>
              Kamu akan check-in ke <strong>{checkinStore?.store_name}</strong>.
              Posisi GPS kamu akan dicatat.
            </DialogDescription>
          </DialogHeader>
          {checkinStore?.ar_percentage && checkinStore.ar_percentage >= 70 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Peringatan Piutang</p>
                <p className="text-xs text-amber-600 dark:text-amber-300 mt-0.5">
                  Toko ini punya hutang {formatCurrency(checkinStore.credit_used)} dari limit {formatCurrency(checkinStore.credit_limit)}.
                  Coba tagih dulu sebelum ambil order baru.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckinStore(null)}>Batal</Button>
            <Button
              onClick={handleCheckin}
              disabled={checkinMutation.isPending || isGettingLocation}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {(checkinMutation.isPending || isGettingLocation) ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Proses...</>
              ) : (
                <><CheckCircle2 className="mr-2 h-4 w-4" />Ya, Check-in</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
