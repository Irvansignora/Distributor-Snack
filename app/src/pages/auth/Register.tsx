import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Package, Eye, EyeOff, Loader2, Building2, User, Phone, MapPin } from 'lucide-react';

export default function Register() {
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    company_name: '',
    phone: '',
    address: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!agreeTerms) {
      setError('Please agree to the terms and conditions');
      return;
    }

    setIsLoading(true);

    try {
      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: 'supplier',
        company_name: formData.company_name,
        phone: formData.phone,
        address: formData.address,
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4 py-8">
      <div className="w-full max-w-lg">
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

        <Card className="border-0 shadow-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Create an account</CardTitle>
            <CardDescription className="text-center">
              Daftar dan mulai belanja snack dengan harga distributor
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    <User className="inline h-4 w-4 mr-1" />
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@company.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_name">
                  <Building2 className="inline h-4 w-4 mr-1" />
                  Company Name
                </Label>
                <Input
                  id="company_name"
                  name="company_name"
                  placeholder="Your Company Ltd."
                  value={formData.company_name}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">
                    <Phone className="inline h-4 w-4 mr-1" />
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+1 234 567 890"
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">
                    <MapPin className="inline h-4 w-4 mr-1" />
                    Address
                  </Label>
                  <Input
                    id="address"
                    name="address"
                    placeholder="City, Country"
                    value={formData.address}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      disabled={isLoading}
                      minLength={6}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="terms"
                  checked={agreeTerms}
                  onCheckedChange={(checked) => setAgreeTerms(checked as boolean)}
                />
                <Label htmlFor="terms" className="text-sm font-normal leading-tight">
                  I agree to the{' '}
                  <NavLink to="/terms" className="text-primary hover:underline">
                    Terms of Service
                  </NavLink>{' '}
                  and{' '}
                  <NavLink to="/privacy" className="text-primary hover:underline">
                    Privacy Policy
                  </NavLink>
                </Label>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter>
            <p className="text-center text-sm text-muted-foreground w-full">
              Already have an account?{' '}
              <NavLink to="/login" className="text-primary hover:underline font-medium">
                Sign in
              </NavLink>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
