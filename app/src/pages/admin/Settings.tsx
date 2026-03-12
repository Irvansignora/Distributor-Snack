import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTax } from '@/contexts/TaxContext';
import api from '@/services/api';
import { User, Bell, Shield, Store, Moon, Sun, Laptop, Loader2, Percent } from 'lucide-react';
import { toast } from 'sonner';

// BUG-09 FIX: Settings.tsx terhubung ke API
export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { user, updateUser } = useAuth();
  const { taxPercent, refetchTax } = useTax();

  // --- Tab Profile ---
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    company_name: user?.company_name || '',
    phone: user?.phone || '',
  });
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    setProfileForm({
      name: user?.name || '',
      email: user?.email || '',
      company_name: user?.company_name || '',
      phone: user?.phone || '',
    });
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      const res = await api.put('/auth/profile', {
        name: profileForm.name,
        company_name: profileForm.company_name,
        phone: profileForm.phone,
      });
      updateUser(res.data.user);
      toast.success('Profil berhasil disimpan');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan profil');
    } finally {
      setProfileLoading(false);
    }
  };

  // --- Tab Security ---
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwLoading, setPwLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm_password) {
      toast.error('Konfirmasi password tidak cocok');
      return;
    }
    if (pwForm.new_password.length < 6) {
      toast.error('Password baru minimal 6 karakter');
      return;
    }
    setPwLoading(true);
    try {
      await api.put('/auth/change-password', {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      toast.success('Password berhasil diubah');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal mengubah password');
    } finally {
      setPwLoading(false);
    }
  };

  // --- Tab PPN (hanya admin) ---
  const { data: settingsData } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => api.get('/settings').then(r => r.data.settings),
    enabled: user?.role === 'admin',
  });

  const [ppnValue, setPpnValue] = useState<string>('');

  useEffect(() => {
    if (settingsData?.ppn_rate !== undefined) {
      setPpnValue(String(settingsData.ppn_rate));
    } else {
      setPpnValue(String(taxPercent));
    }
  }, [settingsData, taxPercent]);

  const savePpnMutation = useMutation({
    mutationFn: (value: number) => api.patch('/settings/ppn_rate', { value }),
    onSuccess: () => {
      toast.success(`Tarif PPN berhasil diubah menjadi ${ppnValue}%`);
      refetchTax();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Gagal menyimpan tarif PPN');
    },
  });

  const handleSavePpn = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(ppnValue);
    if (isNaN(num) || num < 0 || num > 100) {
      toast.error('Tarif PPN harus antara 0 dan 100');
      return;
    }
    savePpnMutation.mutate(num);
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Kelola akun dan preferensi aplikasi</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-5' : 'grid-cols-4'} lg:w-auto`}>
          <TabsTrigger value="profile">
            <User className="mr-2 h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Store className="mr-2 h-4 w-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="mr-2 h-4 w-4" />
            Security
          </TabsTrigger>
          {/* Tab PPN hanya muncul untuk admin */}
          {isAdmin && (
            <TabsTrigger value="tax">
              <Percent className="mr-2 h-4 w-4" />
              PPN
            </TabsTrigger>
          )}
        </TabsList>

        {/* --- Profile Tab --- */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informasi Profil</CardTitle>
              <CardDescription>Update informasi personal Anda</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nama Lengkap</Label>
                    <Input
                      id="name"
                      value={profileForm.name}
                      onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    {/* email tidak bisa diubah melalui profile */}
                    <Input id="email" type="email" value={profileForm.email} disabled className="bg-muted" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Nama Perusahaan</Label>
                  <Input
                    id="company"
                    value={profileForm.company_name}
                    onChange={e => setProfileForm(f => ({ ...f, company_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">No. Telepon</Label>
                  <Input
                    id="phone"
                    value={profileForm.phone}
                    onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <Button type="submit" disabled={profileLoading}>
                  {profileLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</> : 'Simpan Perubahan'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Appearance Tab --- */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tema</CardTitle>
              <CardDescription>Pilih tampilan yang Anda sukai</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sun className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Light</p>
                    <p className="text-sm text-muted-foreground">Latar belakang terang</p>
                  </div>
                </div>
                <Switch checked={theme === 'light'} onCheckedChange={() => setTheme('light')} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Moon className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Dark</p>
                    <p className="text-sm text-muted-foreground">Latar belakang gelap</p>
                  </div>
                </div>
                <Switch checked={theme === 'dark'} onCheckedChange={() => setTheme('dark')} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Laptop className="h-5 w-5" />
                  <div>
                    <p className="font-medium">System</p>
                    <p className="text-sm text-muted-foreground">Ikuti preferensi sistem</p>
                  </div>
                </div>
                <Switch checked={theme === 'system'} onCheckedChange={() => setTheme('system')} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Notifications Tab --- */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Preferensi Notifikasi</CardTitle>
              <CardDescription>Pilih notifikasi yang ingin Anda terima</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Pesanan Baru</p>
                  <p className="text-sm text-muted-foreground">Notifikasi saat ada pesanan masuk</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Stok Menipis</p>
                  <p className="text-sm text-muted-foreground">Alert saat produk hampir habis</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Konfirmasi Pembayaran</p>
                  <p className="text-sm text-muted-foreground">Update status pembayaran</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Security Tab --- */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ganti Password</CardTitle>
              <CardDescription>Update password untuk keamanan akun Anda</CardDescription>
            </CardHeader>
            <CardContent>
              {/* BUG-09 FIX: form password terhubung ke API */}
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current">Password Saat Ini</Label>
                  <Input
                    id="current"
                    type="password"
                    value={pwForm.current_password}
                    onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new">Password Baru</Label>
                  <Input
                    id="new"
                    type="password"
                    value={pwForm.new_password}
                    onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Konfirmasi Password Baru</Label>
                  <Input
                    id="confirm"
                    type="password"
                    value={pwForm.confirm_password}
                    onChange={e => setPwForm(f => ({ ...f, confirm_password: e.target.value }))}
                    required
                  />
                </div>
                <Button type="submit" disabled={pwLoading}>
                  {pwLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</> : 'Ubah Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- PPN Tab (admin only) --- */}
        {isAdmin && (
          <TabsContent value="tax" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Pengaturan PPN (Pajak)</CardTitle>
                <CardDescription>
                  Atur tarif Pajak Pertambahan Nilai yang diterapkan ke semua transaksi.
                  Tarif saat ini: <strong>{taxPercent}%</strong>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSavePpn} className="space-y-4 max-w-sm">
                  <div className="space-y-2">
                    <Label htmlFor="ppn">Tarif PPN (%)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="ppn"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={ppnValue}
                        onChange={e => setPpnValue(e.target.value)}
                        placeholder="Contoh: 11"
                        className="w-32"
                      />
                      <span className="text-muted-foreground font-medium">%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      PPN Indonesia saat ini 11%. Masukkan 0 untuk transaksi bebas pajak.
                    </p>
                  </div>
                  <Button type="submit" disabled={savePpnMutation.isPending}>
                    {savePpnMutation.isPending
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</>
                      : 'Simpan Tarif PPN'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
