import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  User, Building2, Mail, Phone, MapPin, Lock, Bell, Loader2,
  Banknote, ShieldCheck, Truck, HandCoins, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/services/api';
import { toast } from 'sonner';

interface PaymentMethodInfo {
  id: string;
  label: string;
  desc: string;
  icon: React.ElementType;
  agentOnly: boolean;
}

const PAYMENT_METHOD_DEFS: PaymentMethodInfo[] = [
  { id: 'bank_transfer', label: 'Transfer Bank', desc: 'Transfer ke rekening distributor', icon: Banknote, agentOnly: false },
  { id: 'cod', label: 'COD — Bayar di Tempat', desc: 'Bayar tunai saat barang diterima', icon: Truck, agentOnly: false },
  { id: 'consignment', label: 'Konsinyasi', desc: 'Bayar setelah barang terjual', icon: HandCoins, agentOnly: true },
  { id: 'top_14', label: 'TOP 14 Hari', desc: 'Term of Payment — bayar 14 hari setelah terima', icon: Clock, agentOnly: true },
  { id: 'top_30', label: 'TOP 30 Hari', desc: 'Term of Payment — bayar 30 hari setelah terima', icon: Clock, agentOnly: true },
];

export default function Profile() {
  const { user, updateUser, store } = useAuth();
  const userTier = store?.tier || 'reseller';

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    company_name: user?.company_name || '',
    phone: user?.phone || '',
    address: user?.address || '',
  });

  const [pwForm, setPwForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [pwSaving, setPwSaving] = useState(false);


  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const res = await api.put('/auth/profile', {
        name: profileForm.name,
        company_name: profileForm.company_name,
        phone: profileForm.phone,
        address: profileForm.address,
      });
      updateUser(res.data.user);
      toast.success('Profil berhasil disimpan');
      setIsEditing(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan profil');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setProfileForm({
      name: user?.name || '',
      company_name: user?.company_name || '',
      phone: user?.phone || '',
      address: user?.address || '',
    });
    setIsEditing(false);
  };

  const handleChangePassword = async () => {
    if (pwForm.new_password !== pwForm.confirm_password) {
      toast.error('Konfirmasi password tidak cocok');
      return;
    }
    if (pwForm.new_password.length < 6) {
      toast.error('Password baru minimal 6 karakter');
      return;
    }
    setPwSaving(true);
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
      setPwSaving(false);
    }
  };

  // Metode pembayaran yang diizinkan untuk tier ini
  const allowedMethods = store?.allowed_payment_methods || ['bank_transfer', 'cod'];
  const visibleMethods = userTier === 'agent'
    ? PAYMENT_METHOD_DEFS
    : PAYMENT_METHOD_DEFS.filter(m => !m.agentOnly);

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Profil Saya</h1>
        <p className="text-muted-foreground">Kelola informasi akun dan pengaturan toko</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto">
          <TabsTrigger value="profile">
            <User className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Profil</span>
          </TabsTrigger>
          <TabsTrigger value="payment">
            <Banknote className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Pembayaran</span>
          </TabsTrigger>
          <TabsTrigger value="security">
            <Lock className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Keamanan</span>
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Notifikasi</span>
          </TabsTrigger>
        </TabsList>

        {/* ── TAB PROFIL ── */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Informasi Perusahaan</CardTitle>
                  <CardDescription>Detail bisnis dan kontak Anda</CardDescription>
                </div>
                {!isEditing && (
                  <Button variant="outline" onClick={() => setIsEditing(true)}>Edit</Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-lg">{user?.company_name || user?.name}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  {store?.tier && (
                    <span className={cn(
                      'inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold',
                      store.tier === 'agent'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                    )}>
                      {store.tier === 'agent' ? '⭐ Agent' : 'Reseller'}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      <User className="inline h-4 w-4 mr-1" />Nama Kontak
                    </Label>
                    <Input
                      id="name"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm(p => ({ ...p, name: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">
                      <Building2 className="inline h-4 w-4 mr-1" />Nama Perusahaan
                    </Label>
                    <Input
                      id="company"
                      value={profileForm.company_name}
                      onChange={(e) => setProfileForm(p => ({ ...p, company_name: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">
                    <Mail className="inline h-4 w-4 mr-1" />Email
                  </Label>
                  <Input id="email" type="email" value={user?.email || ''} disabled />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">
                      <Phone className="inline h-4 w-4 mr-1" />No. Telepon
                    </Label>
                    <Input
                      id="phone"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">
                      <MapPin className="inline h-4 w-4 mr-1" />Alamat
                    </Label>
                    <Input
                      id="address"
                      value={profileForm.address}
                      onChange={(e) => setProfileForm(p => ({ ...p, address: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
              </div>

              {isEditing && (
                <div className="flex gap-2">
                  <Button onClick={handleSaveProfile} disabled={isSaving}>
                    {isSaving
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</>
                      : 'Simpan Perubahan'}
                  </Button>
                  <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>Batal</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB PEMBAYARAN ── */}
        <TabsContent value="payment" className="space-y-6">

          {/* Metode Pembayaran Tersedia */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Metode Pembayaran
              </CardTitle>
              <CardDescription>
                Metode pembayaran yang bisa Anda gunakan saat checkout.
                {userTier === 'reseller' && (
                  <span className="block mt-1 text-amber-600 dark:text-amber-400">
                    Upgrade ke Agent untuk mengakses Konsinyasi & Term of Payment.
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {visibleMethods.map((method) => {
                  const Icon = method.icon;
                  const isEnabled = allowedMethods.includes(method.id);
                  const isAgentFeature = method.agentOnly;

                  return (
                    <div
                      key={method.id}
                      className={cn(
                        'flex items-center gap-3 p-3.5 rounded-xl border',
                        isEnabled
                          ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800'
                          : 'border-border bg-muted/30 opacity-60'
                      )}
                    >
                      <Icon className={cn(
                        'h-5 w-5 flex-shrink-0',
                        isEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={cn(
                            'font-medium text-sm',
                            isEnabled ? 'text-emerald-800 dark:text-emerald-300' : 'text-muted-foreground'
                          )}>
                            {method.label}
                          </p>
                          {isAgentFeature && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400">
                              Agent
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{method.desc}</p>
                      </div>
                      <div className={cn(
                        'flex-shrink-0 text-xs font-semibold px-2 py-1 rounded-full',
                        isEnabled
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {isEnabled ? 'Aktif' : 'Tidak Aktif'}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground mt-4">
                Metode pembayaran diatur oleh admin. Hubungi admin jika ingin mengubah akses metode pembayaran.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB KEAMANAN ── */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ganti Password</CardTitle>
              <CardDescription>Perbarui password untuk keamanan akun Anda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current">Password Saat Ini</Label>
                <Input
                  id="current"
                  type="password"
                  value={pwForm.current_password}
                  onChange={(e) => setPwForm(p => ({ ...p, current_password: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new">Password Baru</Label>
                <Input
                  id="new"
                  type="password"
                  value={pwForm.new_password}
                  onChange={(e) => setPwForm(p => ({ ...p, new_password: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Konfirmasi Password Baru</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={pwForm.confirm_password}
                  onChange={(e) => setPwForm(p => ({ ...p, confirm_password: e.target.value }))}
                />
              </div>
              <Button onClick={handleChangePassword} disabled={pwSaving}>
                {pwSaving
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Mengubah...</>
                  : 'Update Password'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB NOTIFIKASI ── */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Preferensi Notifikasi</CardTitle>
              <CardDescription>Pilih notifikasi yang ingin Anda terima</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'Update Status Pesanan', desc: 'Notifikasi saat status pesanan berubah' },
                { label: 'Konfirmasi Pembayaran', desc: 'Notifikasi saat pembayaran diverifikasi' },
                { label: 'Email Promosi', desc: 'Terima penawaran dan promo menarik' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                  <Button variant="ghost" size="sm">Aktif</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
