import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceService, AttendanceRecord } from '@/services/attendance';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Camera,
  MapPin,
  CheckCircle2,
  Loader2,
  RefreshCw,
  CalendarDays,
  LogIn,
  LogOut,
  AlertCircle,
} from 'lucide-react';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface GpsCoords {
  latitude: number;
  longitude: number;
  address?: string;
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────
const fmt = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};

const fmtDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short',
  });

const statusColor: Record<string, string> = {
  hadir: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  izin:  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  sakit: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  alpha: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

// ────────────────────────────────────────────────────────────────
// Hook: get GPS + reverse geocode
// ────────────────────────────────────────────────────────────────
function useGps() {
  const [coords, setCoords] = useState<GpsCoords | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(() => {
    if (!navigator.geolocation) {
      setError('GPS tidak didukung browser ini');
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let address: string | undefined;
        try {
          const r = await window.fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const j = await r.json();
          address = j.display_name?.split(',').slice(0, 3).join(', ');
        } catch {}
        setCoords({ latitude, longitude, address });
        setLoading(false);
      },
      (_err) => {
        setError('Akses GPS ditolak. Izinkan lokasi di browser.');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { coords, loading, error, refresh: fetch };
}

// ────────────────────────────────────────────────────────────────
// Component: Camera Capture
// ────────────────────────────────────────────────────────────────
function FaceCapture({
  onCapture,
  onCancel,
}: {
  onCapture: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      })
      .catch(() => setError('Kamera tidak bisa diakses. Izinkan kamera di browser.'));
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const shoot = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    streamRef.current?.getTracks().forEach(t => t.stop());
    onCapture(canvas.toDataURL('image/jpeg', 0.8));
  };

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={onCancel}>Kembali</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm text-muted-foreground">Posisikan wajah di tengah kamera</p>
      <div className="relative rounded-2xl overflow-hidden border-2 border-orange-400 w-full max-w-xs aspect-[3/4] bg-muted">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover scale-x-[-1]"
        />
        {/* overlay guide */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-40 h-52 rounded-full border-2 border-white/60 border-dashed" />
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <div className="flex gap-3 w-full max-w-xs">
        <Button variant="outline" className="flex-1" onClick={onCancel}>Batal</Button>
        <Button className="flex-1 bg-orange-500 hover:bg-orange-600" onClick={shoot} disabled={!ready}>
          <Camera className="mr-2 h-4 w-4" />
          Ambil Foto
        </Button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────────
type Step = 'idle' | 'camera' | 'confirm';

export default function Attendance() {
  const qc = useQueryClient();
  const { coords, loading: gpsLoading, error: gpsError, refresh: refreshGps } = useGps();

  const [action, setAction] = useState<'in' | 'out'>('in');
  const [step, setStep] = useState<Step>('idle');
  const [photo, setPhoto] = useState<string | null>(null);

  // ── Queries ────────────────────────────────────────────────
  const { data: todayData, isLoading: todayLoading } = useQuery({
    queryKey: ['attendance-today'],
    queryFn: attendanceService.getToday,
    refetchInterval: 30_000,
  });

  const { data: historyData } = useQuery({
    queryKey: ['attendance-history'],
    queryFn: attendanceService.getHistory,
  });

  const attendance: AttendanceRecord | null = todayData?.attendance ?? null;
  const history: AttendanceRecord[] = historyData?.history ?? [];

  // ── Mutations ──────────────────────────────────────────────
  const clockMutation = useMutation({
    mutationFn: async () => {
      if (!coords) throw new Error('GPS belum siap');
      const payload = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        address: coords.address,
        face_image_url: photo,   // in real app upload to cloudinary first; here pass base64 or null
      };
      if (action === 'in') return attendanceService.clockIn(payload);
      return attendanceService.clockOut(payload);
    },
    onSuccess: (res) => {
      toast.success(res.message ?? (action === 'in' ? 'Clock in berhasil!' : 'Clock out berhasil!'));
      qc.invalidateQueries({ queryKey: ['attendance-today'] });
      qc.invalidateQueries({ queryKey: ['attendance-history'] });
      setStep('idle');
      setPhoto(null);
    },
    onError: (e: any) => {
      toast.error(e.message ?? 'Gagal absen');
      setStep('idle');
    },
  });

  // ── Derived state ──────────────────────────────────────────
  const hasClockIn = !!attendance?.clock_in;
  const hasClockOut = !!attendance?.clock_out;

  const canClockIn  = !hasClockIn;
  const canClockOut = hasClockIn && !hasClockOut;

  const startAbsen = (a: 'in' | 'out') => {
    setAction(a);
    setStep('camera');
  };

  const onPhotoCaptured = (dataUrl: string) => {
    setPhoto(dataUrl);
    setStep('confirm');
  };

  const now = new Date();
  const today = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // ────────────────────────────────────────────────────────
  // Render: camera
  // ────────────────────────────────────────────────────────
  if (step === 'camera') {
    return (
      <div className="px-4 pt-4 pb-8 flex flex-col gap-4">
        <h2 className="text-base font-semibold">
          {action === 'in' ? '📸 Foto Selfie — Clock In' : '📸 Foto Selfie — Clock Out'}
        </h2>
        <FaceCapture onCapture={onPhotoCaptured} onCancel={() => setStep('idle')} />
      </div>
    );
  }

  // ────────────────────────────────────────────────────────
  // Render: confirm
  // ────────────────────────────────────────────────────────
  if (step === 'confirm') {
    return (
      <div className="px-4 pt-4 pb-8 flex flex-col gap-4">
        <h2 className="text-base font-semibold">
          {action === 'in' ? 'Konfirmasi Clock In' : 'Konfirmasi Clock Out'}
        </h2>

        {/* Photo preview */}
        {photo && (
          <div className="rounded-2xl overflow-hidden border w-full max-w-xs mx-auto aspect-[3/4]">
            <img src={photo} alt="selfie" className="w-full h-full object-cover scale-x-[-1]" />
          </div>
        )}

        {/* GPS info */}
        <Card>
          <CardContent className="p-3 flex items-start gap-3">
            <MapPin className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium">Lokasi GPS</p>
              {gpsLoading ? (
                <p className="text-xs text-muted-foreground">Mengambil lokasi...</p>
              ) : gpsError ? (
                <p className="text-xs text-destructive">{gpsError}</p>
              ) : coords ? (
                <>
                  <p className="text-xs text-muted-foreground">{coords.address ?? 'Lokasi terdeteksi'}</p>
                  <p className="text-[10px] text-muted-foreground/70">
                    {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}
                  </p>
                </>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setStep('camera')}>
            Ulangi Foto
          </Button>
          <Button
            className="flex-1 bg-orange-500 hover:bg-orange-600"
            onClick={() => clockMutation.mutate()}
            disabled={clockMutation.isPending || !coords}
          >
            {clockMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</>
            ) : (
              <><CheckCircle2 className="mr-2 h-4 w-4" /> Konfirmasi</>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────
  // Render: main
  // ────────────────────────────────────────────────────────
  return (
    <div className="pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white px-4 pt-4 pb-8">
        <p className="text-orange-100 text-sm capitalize">{today}</p>
        <h1 className="text-2xl font-bold mt-0.5">Absensi</h1>

        {/* Status today */}
        <div className="mt-4 bg-white/15 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-orange-100">Status Hari Ini</p>
            {todayLoading ? (
              <div className="h-5 w-24 bg-white/20 animate-pulse rounded mt-1" />
            ) : attendance ? (
              <p className="font-bold capitalize">{attendance.status}</p>
            ) : (
              <p className="font-bold text-orange-200">Belum Absen</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-orange-100">Clock In</p>
            <p className="font-semibold">{fmt(attendance?.clock_in ?? null)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-orange-100">Clock Out</p>
            <p className="font-semibold">{fmt(attendance?.clock_out ?? null)}</p>
          </div>
        </div>
      </div>

      <div className="-mt-5 px-4 space-y-4">

        {/* GPS status */}
        <Card className="shadow-sm">
          <CardContent className="p-3 flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${coords ? 'bg-green-500' : gpsLoading ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">
                {gpsLoading ? 'Mengambil lokasi GPS...' : gpsError ? 'GPS Error' : 'Lokasi Terdeteksi'}
              </p>
              {coords && (
                <p className="text-[10px] text-muted-foreground truncate">
                  {coords.address ?? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`}
                </p>
              )}
              {gpsError && <p className="text-[10px] text-destructive">{gpsError}</p>}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={refreshGps}>
              <RefreshCw className={`h-3.5 w-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
            </Button>
          </CardContent>
        </Card>

        {/* Clock In / Out buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => canClockIn && startAbsen('in')}
            disabled={!canClockIn || !coords}
            className={`rounded-2xl p-4 flex flex-col items-center gap-2 border transition-all
              ${hasClockIn
                ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
                : canClockIn && coords
                  ? 'bg-orange-50 border-orange-300 dark:bg-orange-950/30 dark:border-orange-700 active:scale-95 cursor-pointer'
                  : 'opacity-40 cursor-not-allowed border-muted'
              }`}
          >
            {hasClockIn
              ? <CheckCircle2 className="h-8 w-8 text-green-500" />
              : <LogIn className="h-8 w-8 text-orange-500" />
            }
            <p className="text-sm font-semibold">{hasClockIn ? 'Sudah Clock In' : 'Clock In'}</p>
            {hasClockIn && (
              <p className="text-xs text-green-600 font-medium">{fmt(attendance?.clock_in ?? null)}</p>
            )}
            {!hasClockIn && !coords && (
              <p className="text-[10px] text-muted-foreground">Tunggu GPS...</p>
            )}
          </button>

          <button
            onClick={() => canClockOut && startAbsen('out')}
            disabled={!canClockOut || !coords}
            className={`rounded-2xl p-4 flex flex-col items-center gap-2 border transition-all
              ${hasClockOut
                ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800'
                : canClockOut && coords
                  ? 'bg-orange-50 border-orange-300 dark:bg-orange-950/30 dark:border-orange-700 active:scale-95 cursor-pointer'
                  : 'opacity-40 cursor-not-allowed border-muted'
              }`}
          >
            {hasClockOut
              ? <CheckCircle2 className="h-8 w-8 text-blue-500" />
              : <LogOut className="h-8 w-8 text-orange-500" />
            }
            <p className="text-sm font-semibold">{hasClockOut ? 'Sudah Clock Out' : 'Clock Out'}</p>
            {hasClockOut && (
              <p className="text-xs text-blue-600 font-medium">{fmt(attendance?.clock_out ?? null)}</p>
            )}
            {!hasClockOut && !hasClockIn && (
              <p className="text-[10px] text-muted-foreground">Clock in dulu</p>
            )}
          </button>
        </div>

        {/* Photo previews if already clocked */}
        {(attendance?.clock_in_photo || attendance?.clock_out_photo) && (
          <div className="grid grid-cols-2 gap-3">
            {attendance.clock_in_photo && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground font-medium">Foto Clock In</p>
                <div className="rounded-xl overflow-hidden aspect-[3/4] border">
                  <img src={attendance.clock_in_photo} alt="clock in" className="w-full h-full object-cover" />
                </div>
              </div>
            )}
            {attendance.clock_out_photo && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground font-medium">Foto Clock Out</p>
                <div className="rounded-xl overflow-hidden aspect-[3/4] border">
                  <img src={attendance.clock_out_photo} alt="clock out" className="w-full h-full object-cover" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* History */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Riwayat 30 Hari</h2>
          </div>
          <div className="space-y-2">
            {history.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Belum ada riwayat absen</p>
            )}
            {history.map((h) => (
              <Card key={h.id} className="shadow-sm">
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{fmtDate(h.date)}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmt(h.clock_in)} → {fmt(h.clock_out)}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${statusColor[h.status] ?? 'bg-muted text-muted-foreground'}`}>
                    {h.status}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
