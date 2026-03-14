import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Upload, Store, FileText, Camera, Loader2, ChevronRight, ChevronLeft, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/services/api';
const STEPS = [
  { id: 1, title: 'Info Toko', icon: Store },
  { id: 2, title: 'Dokumen', icon: FileText },
  { id: 3, title: 'Review', icon: CheckCircle },
];

const STORE_TYPES = [
  { value: 'warung', label: 'Warung Kelontong' },
  { value: 'minimarket', label: 'Minimarket' },
  { value: 'supermarket', label: 'Supermarket' },
  { value: 'reseller_online', label: 'Reseller Online' },
  { value: 'distributor', label: 'Sub-Distributor' },
  { value: 'cafe_resto', label: 'Kafe / Restoran' },
  { value: 'other', label: 'Lainnya' },
];

const GMV_OPTIONS = [
  { value: 'lt_5jt', label: '< Rp 5 juta / bulan' },
  { value: '5_20jt', label: 'Rp 5–20 juta / bulan' },
  { value: '20_50jt', label: 'Rp 20–50 juta / bulan' },
  { value: 'gt_50jt', label: '> Rp 50 juta / bulan' },
];

export default function Onboarding() {
  const { store, refreshStore } = useAuth() as any;

  // Jika sudah approved, tidak perlu onboarding — arahkan ke dashboard
  if (store?.status === 'approved') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Akun Sudah Aktif</h2>
            <p className="text-muted-foreground mb-6">
              Toko kamu sudah diverifikasi dan bisa langsung belanja.
            </p>
            <a href="/supplier/dashboard">
              <Button className="w-full">Ke Dashboard</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }
  const [step, setStep] = useState(store?.ktp_photo_url ? 3 : store?.store_name ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [storeInfo, setStoreInfo] = useState({
    store_name: store?.store_name || '',
    store_type: store?.store_type || 'warung',
    owner_name: store?.owner_name || '',
    phone_store: store?.phone_store || '',
    whatsapp: store?.whatsapp || '',
    address_line: store?.address_line || '',
    postal_code: store?.postal_code || '',
    monthly_gmv_estimate: store?.monthly_gmv_estimate || '',
  });

  const [docs, setDocs] = useState({ ktp_number: store?.ktp_number || '', npwp_number: store?.npwp_number || '', nib_number: store?.nib_number || '' });
  const [files, setFiles] = useState<Record<string, File | null>>({ ktp_photo: null, store_photo: null, selfie_ktp: null, npwp_photo: null });

  const handleSaveStoreInfo = async () => {
    setError(''); setLoading(true);
    try {
      await api.put('/store/profile', storeInfo);
      setStep(2);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Gagal menyimpan info toko');
    } finally { setLoading(false); }
  };

  const handleUploadDocs = async () => {
    setError(''); setLoading(true);
    try {
      const formData = new FormData();
      if (docs.ktp_number) formData.append('ktp_number', docs.ktp_number);
      if (docs.npwp_number) formData.append('npwp_number', docs.npwp_number);
      if (docs.nib_number) formData.append('nib_number', docs.nib_number);
      if (files.ktp_photo) formData.append('ktp_photo', files.ktp_photo);
      if (files.store_photo) formData.append('store_photo', files.store_photo);
      if (files.selfie_ktp) formData.append('selfie_ktp', files.selfie_ktp);
      if (files.npwp_photo) formData.append('npwp_photo', files.npwp_photo);
      await api.post('/store/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setStep(3);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Gagal upload dokumen');
    } finally { setLoading(false); }
  };

  const handleSubmitReview = async () => {
    setError(''); setLoading(true);
    try {
      await api.post('/store/submit-review', {});
      setSuccess('Dokumen berhasil dikirim! Tim kami akan mereview dalam 1x24 jam kerja.');
      if (refreshStore) await refreshStore();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Gagal submit review');
    } finally { setLoading(false); }
  };

  // If already submitted
  if (store?.status === 'pending_review' || success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Menunggu Verifikasi</h2>
            <p className="text-muted-foreground mb-6">
              Dokumen toko kamu sedang direview oleh tim SnackHub. Proses verifikasi biasanya memakan waktu 1x24 jam kerja.
            </p>
            <Badge variant="secondary" className="bg-amber-100 text-amber-800">Status: Menunggu Review</Badge>
            <p className="text-xs text-muted-foreground mt-4">Kamu akan mendapat notifikasi WhatsApp & email saat status berubah.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Verifikasi Toko</h1>
          <p className="text-muted-foreground">Lengkapi data toko kamu untuk mulai belanja</p>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center mb-8 gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={cn("flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                step === s.id ? "bg-primary text-primary-foreground" :
                step > s.id ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
              )}>
                {step > s.id ? <CheckCircle className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                {s.title}
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}

        {/* Step 1: Info Toko */}
        {step === 1 && (
          <Card>
            <CardHeader><CardTitle>Info Toko</CardTitle><CardDescription>Data dasar toko atau bisnis kamu</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Nama Toko *</Label>
                  <Input value={storeInfo.store_name} onChange={e => setStoreInfo(p => ({ ...p, store_name: e.target.value }))} placeholder="Toko Berkah Jaya" />
                </div>
                <div className="space-y-2">
                  <Label>Jenis Usaha *</Label>
                  <Select value={storeInfo.store_type} onValueChange={v => setStoreInfo(p => ({ ...p, store_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STORE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nama Pemilik *</Label>
                  <Input value={storeInfo.owner_name} onChange={e => setStoreInfo(p => ({ ...p, owner_name: e.target.value }))} placeholder="Budi Santoso" />
                </div>
                <div className="space-y-2">
                  <Label>No. WhatsApp *</Label>
                  <Input value={storeInfo.whatsapp} onChange={e => setStoreInfo(p => ({ ...p, whatsapp: e.target.value }))} placeholder="08123456789" />
                </div>
                <div className="space-y-2">
                  <Label>No. Telepon Toko</Label>
                  <Input value={storeInfo.phone_store} onChange={e => setStoreInfo(p => ({ ...p, phone_store: e.target.value }))} placeholder="02112345678" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Alamat Toko *</Label>
                  <Input value={storeInfo.address_line} onChange={e => setStoreInfo(p => ({ ...p, address_line: e.target.value }))} placeholder="Jl. Merdeka No. 12, RT 03/RW 05" />
                </div>
                <div className="space-y-2">
                  <Label>Kode Pos</Label>
                  <Input value={storeInfo.postal_code} onChange={e => setStoreInfo(p => ({ ...p, postal_code: e.target.value }))} placeholder="10110" />
                </div>
                <div className="space-y-2">
                  <Label>Estimasi Omzet / Bulan</Label>
                  <Select value={storeInfo.monthly_gmv_estimate} onValueChange={v => setStoreInfo(p => ({ ...p, monthly_gmv_estimate: v }))}>
                    <SelectTrigger><SelectValue placeholder="Pilih range" /></SelectTrigger>
                    <SelectContent>{GMV_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="w-full" onClick={handleSaveStoreInfo} disabled={loading || !storeInfo.store_name || !storeInfo.owner_name || !storeInfo.whatsapp || !storeInfo.address_line}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Lanjut ke Upload Dokumen <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Dokumen */}
        {step === 2 && (
          <Card>
            <CardHeader><CardTitle>Upload Dokumen</CardTitle><CardDescription>Dokumen diperlukan untuk verifikasi identitas dan keabsahan usaha</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              {/* KTP */}
              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center gap-2 font-medium">
                  <FileText className="h-4 w-4 text-primary" />
                  KTP Pemilik <Badge variant="destructive" className="text-xs">Wajib</Badge>
                </div>
                <Input value={docs.ktp_number} onChange={e => setDocs(p => ({ ...p, ktp_number: e.target.value }))} placeholder="Nomor KTP (16 digit)" />
                <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50" onClick={() => document.getElementById('ktp_photo')?.click()}>
                  {files.ktp_photo ? <p className="text-sm text-emerald-600">✓ {files.ktp_photo.name}</p> : <><Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Upload foto KTP</p></>}
                </div>
                <input id="ktp_photo" type="file" accept="image/*" hidden onChange={e => setFiles(p => ({ ...p, ktp_photo: e.target.files?.[0] || null }))} />
              </div>

              {/* Foto Toko */}
              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center gap-2 font-medium">
                  <Camera className="h-4 w-4 text-primary" />
                  Foto Toko <Badge variant="destructive" className="text-xs">Wajib</Badge>
                </div>
                <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50" onClick={() => document.getElementById('store_photo')?.click()}>
                  {files.store_photo ? <p className="text-sm text-emerald-600">✓ {files.store_photo.name}</p> : <><Camera className="h-6 w-6 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Upload foto tampak depan toko</p></>}
                </div>
                <input id="store_photo" type="file" accept="image/*" hidden onChange={e => setFiles(p => ({ ...p, store_photo: e.target.files?.[0] || null }))} />
              </div>

              {/* NPWP (opsional) */}
              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center gap-2 font-medium">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  NPWP <Badge variant="secondary" className="text-xs">Opsional</Badge>
                </div>
                <Input value={docs.npwp_number} onChange={e => setDocs(p => ({ ...p, npwp_number: e.target.value }))} placeholder="Nomor NPWP (15 digit)" />
                <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50" onClick={() => document.getElementById('npwp_photo')?.click()}>
                  {files.npwp_photo ? <p className="text-sm text-emerald-600">✓ {files.npwp_photo.name}</p> : <><Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Upload foto NPWP (opsional)</p></>}
                </div>
                <input id="npwp_photo" type="file" accept="image/*" hidden onChange={e => setFiles(p => ({ ...p, npwp_photo: e.target.files?.[0] || null }))} />
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1"><ChevronLeft className="mr-2 h-4 w-4" /> Kembali</Button>
                <Button className="flex-1" onClick={handleUploadDocs} disabled={loading || !files.ktp_photo || !files.store_photo}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Lanjut <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Review & Submit */}
        {step === 3 && (
          <Card>
            <CardHeader><CardTitle>Review & Submit</CardTitle><CardDescription>Periksa kembali data sebelum dikirim</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm">
                {[
                  { label: 'Nama Toko', value: storeInfo.store_name || store?.store_name },
                  { label: 'Pemilik', value: storeInfo.owner_name || store?.owner_name },
                  { label: 'WhatsApp', value: storeInfo.whatsapp || store?.whatsapp },
                  { label: 'Alamat', value: storeInfo.address_line || store?.address_line },
                  { label: 'Foto KTP', value: files.ktp_photo?.name || (store?.ktp_photo_url ? '✓ Sudah diupload' : null) },
                  { label: 'Foto Toko', value: files.store_photo?.name || (store?.store_photo_url ? '✓ Sudah diupload' : null) },
                ].map(item => item.value && (
                  <div key={item.label} className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium">{item.value}</span>
                  </div>
                ))}
              </div>

              <Alert>
                <AlertDescription className="text-xs">
                  Dengan mengirim dokumen ini, kamu menyatakan bahwa semua informasi yang diberikan adalah benar dan dapat dipertanggungjawabkan.
                </AlertDescription>
              </Alert>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1"><ChevronLeft className="mr-2 h-4 w-4" /> Kembali</Button>
                <Button className="flex-1" onClick={handleSubmitReview} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                  Kirim untuk Diverifikasi
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
