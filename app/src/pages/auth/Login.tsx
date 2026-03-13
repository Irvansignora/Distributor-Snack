import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Package, Eye, EyeOff, Loader2, AlertCircle, Info } from 'lucide-react';
import api from '@/services/api';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  // FIX-06: isLoading dikelola hanya di sini, bukan double dengan AuthContext
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState(0);

  // Reset password mode
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState('');
  const [resetError, setResetError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setErrorCode(0);

    // FIX-07: validasi dasar sebelum hit API
    if (!email.trim()) {
      setError('Email wajib diisi');
      return;
    }
    if (!password) {
      setError('Password wajib diisi');
      return;
    }

    setIsLoading(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
      // Navigasi ditangani di AuthContext.login(), tidak perlu di sini
    } catch (err: any) {
      // FIX-08: handle berbagai bentuk error response
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Gagal login, coba lagi';
      const code = err?.response?.status || 0;
      setError(msg);
      setErrorCode(code);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetMsg('');
    if (!resetEmail.trim()) {
      setResetError('Email wajib diisi');
      return;
    }
    if (newPassword.length < 6) {
      setResetError('Password minimal 6 karakter');
      return;
    }
    setResetLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email: resetEmail.trim().toLowerCase(),
        new_password: newPassword,
      });
      setResetMsg('Password berhasil diubah! Silakan login.');
      setEmail(resetEmail.trim().toLowerCase());
      setPassword('');
      setTimeout(() => {
        setShowReset(false);
        setResetMsg('');
      }, 2000);
    } catch (err: any) {
      setResetError(
        err?.response?.data?.error || err?.message || 'Gagal reset password'
      );
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <NavLink to="/" className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
              <Package className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">SnackHub</h1>
              <p className="text-xs text-muted-foreground">Distributor Snack Terpercaya</p>
            </div>
          </NavLink>
        </div>

        {!showReset ? (
          <Card className="border-0 shadow-2xl">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center">Selamat Datang</CardTitle>
              <CardDescription className="text-center">
                Masuk ke akun SnackHub Anda
              </CardDescription>
            </CardHeader>

            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>
                    {errorCode === 401
                      ? 'Login Gagal'
                      : errorCode === 403
                      ? 'Akun Diblokir'
                      : errorCode === 500
                      ? 'Error Server'
                      : 'Error'}
                  </AlertTitle>
                  <AlertDescription className="mt-1">
                    {error}
                    {errorCode === 401 && (
                      <button
                        type="button"
                        className="block mt-2 text-xs underline opacity-80 hover:opacity-100"
                        onClick={() => {
                          setShowReset(true);
                          setResetEmail(email);
                        }}
                      >
                        Lupa password? Ganti password di sini
                      </button>
                    )}
                    {errorCode === 500 && (
                      <p className="mt-1 text-xs opacity-80">
                        Coba lagi dalam beberapa detik. Jika masih gagal, hubungi admin.
                      </p>
                    )}
                    {/* FIX-09: tampilkan hint jika network error (no status code) */}
                    {errorCode === 0 && (
                      <p className="mt-1 text-xs opacity-80">
                        Periksa koneksi internet atau pastikan server sedang berjalan.
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      autoComplete="current-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    />
                    <Label htmlFor="remember" className="text-sm font-normal">
                      Ingat saya
                    </Label>
                  </div>
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                    onClick={() => {
                      setShowReset(true);
                      setResetEmail(email);
                    }}
                  >
                    Lupa password?
                  </button>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Masuk...
                    </>
                  ) : (
                    'Masuk'
                  )}
                </Button>
              </form>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                Belum punya akun?{' '}
                <NavLink to="/register" className="text-primary hover:underline font-medium">
                  Daftar sekarang
                </NavLink>
              </p>
            </CardFooter>
          </Card>
        ) : (
          /* Reset Password Form */
          <Card className="border-0 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-center">Ganti Password</CardTitle>
              <CardDescription className="text-center">
                Masukkan email dan password baru Anda
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resetMsg && (
                <Alert className="mb-4 border-green-500 text-green-700">
                  <Info className="h-4 w-4" />
                  <AlertDescription>{resetMsg}</AlertDescription>
                </Alert>
              )}
              {resetError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{resetError}</AlertDescription>
                </Alert>
              )}
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="email@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    disabled={resetLoading}
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Password Baru</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Minimal 6 karakter"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={resetLoading}
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={resetLoading}>
                  {resetLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan Password Baru'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setShowReset(false);
                    setResetError('');
                    setResetMsg('');
                  }}
                >
                  Kembali ke Login
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
