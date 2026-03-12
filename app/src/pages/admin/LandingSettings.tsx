import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save, Globe, Phone, Info, Star } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';

interface SettingsMap { [key: string]: any; }

export default function LandingSettings() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-settings-landing'],
    queryFn: () => api.get('/settings').then(r => r.data.settings as SettingsMap),
  });

  const [form, setForm] = useState<SettingsMap>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  const saveKey = async (key: string, value: any) => {
    try {
      await api.patch(`/settings/${key}`, { value });
    } catch {
      throw new Error(`Gagal simpan ${key}`);
    }
  };

  const handleSave = async (keys: string[]) => {
    setSaving(true);
    try {
      await Promise.all(keys.map(k => saveKey(k, form[k] ?? '')));
      toast.success('Pengaturan berhasil disimpan');
      refetch();
    } catch (e: any) {
      toast.error(e.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  const SaveBtn = ({ keys }: { keys: string[] }) => (
    <Button onClick={() => handleSave(keys)} disabled={saving} className="mt-4">
      {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</> : <><Save className="mr-2 h-4 w-4" />Simpan</>}
    </Button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pengaturan Landing Page</h1>
        <p className="text-muted-foreground">Kelola konten yang tampil di halaman utama website</p>
      </div>

      <Tabs defaultValue="hero">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto">
          <TabsTrigger value="hero"><Globe className="mr-2 h-4 w-4" />Hero</TabsTrigger>
          <TabsTrigger value="about"><Info className="mr-2 h-4 w-4" />Tentang</TabsTrigger>
          <TabsTrigger value="contact"><Phone className="mr-2 h-4 w-4" />Kontak</TabsTrigger>
          <TabsTrigger value="stats"><Star className="mr-2 h-4 w-4" />Statistik</TabsTrigger>
        </TabsList>

        {/* HERO TAB */}
        <TabsContent value="hero" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bagian Hero (Atas)</CardTitle>
              <CardDescription>Teks utama yang pertama dilihat pengunjung</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Badge Promo (atas judul)</Label>
                <Input
                  value={form.landing_promo_badge ?? '🎉 Promo Akhir Bulan — Diskon hingga 25%!'}
                  onChange={e => set('landing_promo_badge', e.target.value)}
                  placeholder="🎉 Promo Akhir Bulan..."
                />
              </div>
              <div className="space-y-2">
                <Label>Judul Hero (baris 1)</Label>
                <Input
                  value={form.landing_hero_title ?? 'Snack Lezat, Harga Distributor'}
                  onChange={e => set('landing_hero_title', e.target.value)}
                  placeholder="Snack Lezat, Harga Distributor"
                />
              </div>
              <div className="space-y-2">
                <Label>Subtitle / Deskripsi</Label>
                <Textarea
                  rows={3}
                  value={form.landing_hero_subtitle ?? 'Ribuan pilihan snack berkualitas dari distributor terpercaya.'}
                  onChange={e => set('landing_hero_subtitle', e.target.value)}
                />
              </div>
              <SaveBtn keys={['landing_promo_badge', 'landing_hero_title', 'landing_hero_subtitle']} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABOUT TAB */}
        <TabsContent value="about" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tentang Perusahaan</CardTitle>
              <CardDescription>Informasi yang tampil di bagian "Kenapa Pilih Kami"</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nama Perusahaan / Toko</Label>
                <Input
                  value={form.app_name ?? 'SnackHub'}
                  onChange={e => set('app_name', e.target.value)}
                  placeholder="SnackHub"
                />
              </div>
              <div className="space-y-2">
                <Label>Judul Section Tentang</Label>
                <Input
                  value={form.landing_about_title ?? 'Distributor Snack Terpercaya sejak 2015'}
                  onChange={e => set('landing_about_title', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Deskripsi Perusahaan</Label>
                <Textarea
                  rows={3}
                  value={form.landing_about_desc ?? 'Kami menyuplai lebih dari 10.000 toko, warung, dan reseller di seluruh Indonesia.'}
                  onChange={e => set('landing_about_desc', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tahun Berdiri</Label>
                <Input
                  value={form.landing_about_year ?? '2015'}
                  onChange={e => set('landing_about_year', e.target.value)}
                  placeholder="2015"
                />
                <p className="text-xs text-muted-foreground">Digunakan untuk hitung "X Tahun Pengalaman" secara otomatis</p>
              </div>
              <SaveBtn keys={['app_name', 'landing_about_title', 'landing_about_desc', 'landing_about_year']} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTACT TAB */}
        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Informasi Kontak</CardTitle>
              <CardDescription>Ditampilkan di bagian Kontak dan Footer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nomor WhatsApp / Telepon</Label>
                <Input
                  value={form.landing_contact_phone ?? '+62 812-3456-7890'}
                  onChange={e => set('landing_contact_phone', e.target.value)}
                  placeholder="+62 812-3456-7890"
                />
              </div>
              <div className="space-y-2">
                <Label>Email CS</Label>
                <Input
                  type="email"
                  value={form.landing_contact_email ?? 'cs@snackhub.id'}
                  onChange={e => set('landing_contact_email', e.target.value)}
                  placeholder="cs@snackhub.id"
                />
              </div>
              <div className="space-y-2">
                <Label>Alamat Gudang / Kantor</Label>
                <Input
                  value={form.landing_contact_address ?? 'Jl. Raya Industri No. 88'}
                  onChange={e => set('landing_contact_address', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Kota</Label>
                <Input
                  value={form.landing_contact_city ?? 'Jakarta Timur, DKI Jakarta'}
                  onChange={e => set('landing_contact_city', e.target.value)}
                />
              </div>
              <SaveBtn keys={['landing_contact_phone', 'landing_contact_email', 'landing_contact_address', 'landing_contact_city']} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* STATS TAB */}
        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Statistik di Hero</CardTitle>
              <CardDescription>Angka yang tampil di bawah tombol hero (misal: 500+ Jenis Produk)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Jumlah Produk</Label>
                  <Input
                    value={form.landing_stats_products ?? '500+'}
                    onChange={e => set('landing_stats_products', e.target.value)}
                    placeholder="500+"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pelanggan Aktif</Label>
                  <Input
                    value={form.landing_stats_customers ?? '10rb+'}
                    onChange={e => set('landing_stats_customers', e.target.value)}
                    placeholder="10rb+"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rating Toko</Label>
                  <Input
                    value={form.landing_stats_rating ?? '4.9⭐'}
                    onChange={e => set('landing_stats_rating', e.target.value)}
                    placeholder="4.9⭐"
                  />
                </div>
              </div>
              <SaveBtn keys={['landing_stats_products', 'landing_stats_customers', 'landing_stats_rating']} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
