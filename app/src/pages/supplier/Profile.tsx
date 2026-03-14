import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Building2, Mail, Phone, MapPin, Lock, Bell, Loader2 } from 'lucide-react';
import api from '@/services/api';
import { toast } from 'sonner';

export default function Profile() {
  const { user, updateUser, store } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // BUG FIX: gunakan controlled state, bukan defaultValue (uncontrolled)
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    company_name: user?.company_name || '',
    phone: user?.phone || '',
    address: user?.address || '',
  });

  // BUG FIX: password form dengan state terkontrol
  const [pwForm, setPwForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [pwSaving, setPwSaving] = useState(false);

  // BUG FIX: Save Changes sekarang benar-benar memanggil API
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
    // Reset form ke nilai user saat ini saat cancel
    setProfileForm({
      name: user?.name || '',
      company_name: user?.company_name || '',
      phone: user?.phone || '',
      address: user?.address || '',
    });
    setIsEditing(false);
  };

  // BUG FIX: Change Password sekarang memanggil API
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

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground">Manage your account information</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto">
          <TabsTrigger value="profile">
            <User className="mr-2 h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security">
            <Lock className="mr-2 h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Company Information</CardTitle>
                  <CardDescription>Your business details</CardDescription>
                </div>
                {!isEditing && (
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    Edit
                  </Button>
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
                    <span className={`inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      store.tier === 'agent'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {store.tier === 'agent' ? '⭐ Agent' : 'Reseller'}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      <User className="inline h-4 w-4 mr-1" />
                      Contact Name
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
                      <Building2 className="inline h-4 w-4 mr-1" />
                      Company Name
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
                    <Mail className="inline h-4 w-4 mr-1" />
                    Email Address
                  </Label>
                  <Input id="email" type="email" value={user?.email || ''} disabled />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">
                      <Phone className="inline h-4 w-4 mr-1" />
                      Phone Number
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
                      <MapPin className="inline h-4 w-4 mr-1" />
                      Address
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
                    {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</> : 'Save Changes'}
                  </Button>
                  <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your password to keep your account secure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current">Current Password</Label>
                <Input
                  id="current"
                  type="password"
                  value={pwForm.current_password}
                  onChange={(e) => setPwForm(p => ({ ...p, current_password: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new">New Password</Label>
                <Input
                  id="new"
                  type="password"
                  value={pwForm.new_password}
                  onChange={(e) => setPwForm(p => ({ ...p, new_password: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm New Password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={pwForm.confirm_password}
                  onChange={(e) => setPwForm(p => ({ ...p, confirm_password: e.target.value }))}
                />
              </div>
              <Button onClick={handleChangePassword} disabled={pwSaving}>
                {pwSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Mengubah...</> : 'Update Password'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose what notifications you want to receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Order Updates</p>
                  <p className="text-sm text-muted-foreground">Get notified when your order status changes</p>
                </div>
                <Button variant="ghost" size="sm">Enabled</Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Payment Confirmations</p>
                  <p className="text-sm text-muted-foreground">Get notified about payment updates</p>
                </div>
                <Button variant="ghost" size="sm">Enabled</Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Promotional Emails</p>
                  <p className="text-sm text-muted-foreground">Receive offers and promotions</p>
                </div>
                <Button variant="ghost" size="sm">Disabled</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
