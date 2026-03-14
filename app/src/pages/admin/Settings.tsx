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
import { User, Bell, Shield, Store, Moon, Sun, Laptop, Loader2, Percent, TrendingUp, Banknote, Plus, Trash2, Star } from 'lucide-react';
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

  // --- Tab Tier Harga ---
  const [tierAgentMin, setTierAgentMin] = useState<string>('');
  const [tierSaving, setTierSaving] = useState(false);

  useEffect(() => {
    if (settingsData?.ppn_rate !== undefined) {
      setPpnValue(String(settingsData.ppn_rate));
    } else {
      setPpnValue(String(taxPercent));
    }
    if (settingsData?.tier_agent_min !== undefined) {
      setTierAgentMin(String(settingsData.tier_agent_min?.value ?? settingsData.tier_agent_min ?? ''));
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

  const handleSaveTier = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(tierAgentMin);
    if (isNaN(num) || num < 0) {
      toast.error('Min. pembelian Agent harus angka positif');
      return;
    }
    setTierSaving(true);
    try {
      await api.patch('/settings/tier_thresholds', { agent_min: num });
      toast.success('Threshold tier berhasil disimpan, tier toko diperbarui otomatis');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan threshold tier');
    } finally {
      setTierSaving(false);
    }
  };

  // --- Tab Pembayaran (Rekening Bank Distributor) ---
  interface BankAccount {
    bank_name: string;
    account_number: string;
    account_name: string;
    is_primary: boolean;
  }
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankSaving, setBankSaving] = useState(false);

  // Load rekening bank dari settings saat settingsData ada
  useEffect(() => {
    if (settingsData?.bank_accounts) {
      setBankAccounts(settingsData.bank_accounts as BankAccount[]);
    }
  }, [settingsData]);

  const addBankAccount = () => {
    setBankAccounts(prev => [...prev, { bank_name: '', account_number: '', account_name: '', is_primary: prev.length === 0 }]);
  };

  const removeBankAccount = (idx: number) => {
    setBankAccounts(prev => {
      const next = prev.filter((_, i) => i !== idx);
      // Jika yang dihapus adalah primary, set yang pertama jadi primary
      if (prev[idx].is_primary && next.length > 0) next[0].is_primary = true;
      return next;
    });
  };

  const setPrimaryBank = (idx: number) => {
    setBankAccounts(prev => prev.map((b, i) => ({ ...b, is_primary: i === idx })));
  };

  const updateBankField = (idx: number, field: keyof BankAccount, value: string | boolean) => {
    setBankAccounts(prev => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b));
  };

  const handleSaveBankAccounts = async () => {
    const invalid = bankAccounts.find(b => !b.bank_name || !b.account_number || !b.account_name);
    if (invalid) {
      toast.error('Lengkapi semua field rekening bank');
      return;
    }
    setBankSaving(true);
    try {
      await api.patch('/settings/bank_accounts', { accounts: bankAccounts });
      toast.success('Rekening bank distributor berhasil disimpan');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan rekening bank');
    } finally {
      setBankSaving(false);
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Kelola akun dan preferensi aplikasi</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-7' : 'grid-cols-4'} lg:w-auto`}>
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
          {isAdmin && (
            <TabsTrigger value="tier">
              <TrendingUp className="mr-2 h-4 w-4" />
              Tier Harga
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="payment">
              <Banknote className="mr-2 h-4 w-4" />
              Pembayaran
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
        {/* --- Tier Harga Tab (admin only) --- */}
        {isAdmin && (
          <TabsContent value="tier" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Pengaturan Tier Harga Otomatis</CardTitle>
                <CardDescription>
                  Tier pelanggan ditentukan otomatis berdasarkan total pembelian bulan berjalan.
                  Hanya ada 2 tier: <strong>Agent</strong> dan <strong>Reseller</strong>.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveTier} className="space-y-6 max-w-md">
                  <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span className="font-semibold">Agent</span>
                      <span className="text-xs text-muted-foreground ml-auto">Harga lebih murah</span>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="agent-min">Min. Pembelian Bulanan (Rp)</Label>
                      <Input
                        id="agent-min"
                        type="number"
                        min="0"
                        step="100000"
                        value={tierAgentMin}
                        onChange={e => setTierAgentMin(e.target.value)}
                        placeholder="Contoh: 5000000"
                      />
                      <p className="text-xs text-muted-foreground">
                        Pelanggan dengan total order bulan ini ≥ nilai ini → otomatis jadi Agent
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="font-semibold">Reseller</span>
                      <span className="text-xs text-muted-foreground ml-auto">Harga standar</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Semua pelanggan di bawah minimum Agent → otomatis Reseller.
                    </p>
                  </div>

                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3">
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      ⚠️ Setelah simpan, tier semua pelanggan akan dihitung ulang otomatis berdasarkan
                      order bulan ini. Tier juga diperbarui otomatis setiap kali order selesai.
                    </p>
                  </div>

                  <Button type="submit" disabled={tierSaving}>
                    {tierSaving
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan & menghitung ulang...</>
                      : 'Simpan & Terapkan'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* --- Tab Pembayaran --- */}
        {isAdmin && (
          <TabsContent value="payment" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="h-5 w-5" />
                  Rekening Bank Distributor
                </CardTitle>
                <CardDescription>
                  Rekening ini ditampilkan ke customer saat mereka memilih metode Transfer Bank saat checkout.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {bankAccounts.length === 0 && (
                  <div className="p-4 border border-dashed rounded-xl text-center text-muted-foreground text-sm">
                    Belum ada rekening bank. Klik tombol di bawah untuk menambahkan.
                  </div>
                )}

                <div className="space-y-3">
                  {bankAccounts.map((bank, idx) => (
                    <div key={idx} className={`p-4 rounded-xl border-2 space-y-3 ${bank.is_primary ? 'border-primary bg-primary/5' : 'border-border'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">Rekening #{idx + 1}</span>
                          {bank.is_primary && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                              UTAMA
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!bank.is_primary && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setPrimaryBank(idx)}
                              className="h-7 text-xs gap-1"
                            >
                              <Star className="h-3 w-3" />
                              Set Utama
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeBankAccount(idx)}
                            className="h-7 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">Nama Bank *</label>
                          <input
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            placeholder="BCA, Mandiri, BRI..."
                            value={bank.bank_name}
                            onChange={e => updateBankField(idx, 'bank_name', e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">Nomor Rekening *</label>
                          <input
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                            placeholder="1234567890"
                            value={bank.account_number}
                            onChange={e => updateBankField(idx, 'account_number', e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">Nama Pemilik *</label>
                          <input
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            placeholder="Nama sesuai rekening"
                            value={bank.account_name}
                            onChange={e => updateBankField(idx, 'account_name', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <Button type="button" variant="outline" onClick={addBankAccount} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Tambah Rekening
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSaveBankAccounts}
                    disabled={bankSaving || bankAccounts.length === 0}
                  >
                    {bankSaving
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</>
                      : <><Banknote className="mr-2 h-4 w-4" />Simpan Rekening Bank</>}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground border-t pt-3">
                  Rekening yang ditandai <strong>Utama</strong> akan ditampilkan paling atas saat customer checkout dengan Transfer Bank.
                  Anda bisa menambahkan beberapa rekening dari bank berbeda.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
