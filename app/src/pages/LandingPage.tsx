import { NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  ShoppingCart,
  Truck,
  Shield,
  Star,
  Menu,
  X,
  Moon,
  Sun,
  Package,
  Zap,
  HeartHandshake,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

const categories = [
  { name: 'Keripik & Chips', emoji: '🥔', count: '120+ produk' },
  { name: 'Coklat & Permen', emoji: '🍫', count: '80+ produk' },
  { name: 'Biskuit & Wafer', emoji: '🍪', count: '95+ produk' },
  { name: 'Kacang & Biji', emoji: '🥜', count: '60+ produk' },
  { name: 'Minuman Ringan', emoji: '🧃', count: '70+ produk' },
  { name: 'Snack Sehat', emoji: '🌾', count: '45+ produk' },
];

const featuredProducts = [
  { name: 'Keripik Singkong Original', price: 'Rp 12.500', originalPrice: 'Rp 15.000', badge: 'Terlaris', emoji: '🥔', rating: 4.8, sold: '2.4rb terjual' },
  { name: 'Choco Wafer Crispy', price: 'Rp 8.000', originalPrice: null, badge: 'Baru', emoji: '🍫', rating: 4.6, sold: '890 terjual' },
  { name: 'Kacang Mete Panggang', price: 'Rp 35.000', originalPrice: 'Rp 42.000', badge: 'Diskon 17%', emoji: '🥜', rating: 4.9, sold: '1.2rb terjual' },
  { name: 'Biskuit Kelapa Susu', price: 'Rp 9.500', originalPrice: null, badge: null, emoji: '🍪', rating: 4.5, sold: '560 terjual' },
];

const benefits = [
  { icon: Truck, title: 'Pengiriman Cepat', description: 'Estimasi 1-3 hari kerja ke seluruh Indonesia', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { icon: Shield, title: 'Produk Terjamin', description: 'Semua produk telah terdaftar BPOM & halal MUI', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { icon: Zap, title: 'Harga Distributor', description: 'Langsung dari distributor, harga lebih hemat', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { icon: HeartHandshake, title: 'Layanan Terpercaya', description: 'CS siap membantu 7 hari seminggu', color: 'text-rose-500', bg: 'bg-rose-500/10' },
];

const testimonials = [
  { name: 'Budi Santoso', role: 'Pemilik Warung', city: 'Surabaya', content: 'Udah 2 tahun belanja di sini, harga bersaing dan produknya lengkap banget. Pengiriman juga cepat!', rating: 5 },
  { name: 'Siti Rahayu', role: 'Reseller Online', city: 'Bandung', content: 'Stok selalu ready, packagingnya aman, dan kalau ada pertanyaan CS-nya responsif. Highly recommended!', rating: 5 },
  { name: 'Agus Firmansyah', role: 'Pemilik Minimarket', city: 'Semarang', content: 'Harga grosirnya kompetitif dan bisa pesan dalam jumlah besar. Jadi langganan tetap!', rating: 5 },
];

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled ? "bg-background/95 backdrop-blur-md border-b shadow-sm" : "bg-transparent"
      )}>
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <NavLink to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Package className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <span className="font-bold text-lg leading-none">SnackHub</span>
                <p className="text-xs text-muted-foreground leading-none">Distributor Snack</p>
              </div>
            </NavLink>

            <nav className="hidden md:flex items-center gap-6">
              <a href="#kategori" className="text-sm font-medium hover:text-primary transition-colors">Kategori</a>
              <a href="#produk" className="text-sm font-medium hover:text-primary transition-colors">Produk</a>
              <a href="#tentang" className="text-sm font-medium hover:text-primary transition-colors">Tentang Kami</a>
              <a href="#kontak" className="text-sm font-medium hover:text-primary transition-colors">Kontak</a>
            </nav>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
                {resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
              <Button variant="ghost" asChild className="hidden sm:flex">
                <NavLink to="/login">Masuk</NavLink>
              </Button>
              <Button asChild className="hidden sm:flex">
                <NavLink to="/register">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Daftar & Belanja
                </NavLink>
              </Button>
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          {mobileMenuOpen && (
            <nav className="md:hidden py-4 border-t">
              <div className="flex flex-col gap-2">
                <a href="#kategori" className="px-4 py-2 hover:bg-muted rounded-lg" onClick={() => setMobileMenuOpen(false)}>Kategori</a>
                <a href="#produk" className="px-4 py-2 hover:bg-muted rounded-lg" onClick={() => setMobileMenuOpen(false)}>Produk</a>
                <a href="#tentang" className="px-4 py-2 hover:bg-muted rounded-lg" onClick={() => setMobileMenuOpen(false)}>Tentang Kami</a>
                <a href="#kontak" className="px-4 py-2 hover:bg-muted rounded-lg" onClick={() => setMobileMenuOpen(false)}>Kontak</a>
                <div className="flex gap-2 px-4 pt-2">
                  <Button variant="outline" asChild className="flex-1"><NavLink to="/login">Masuk</NavLink></Button>
                  <Button asChild className="flex-1"><NavLink to="/register">Daftar</NavLink></Button>
                </div>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="pt-28 pb-20 px-4 bg-gradient-to-br from-primary/5 via-background to-amber-50/30 dark:to-amber-950/10">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge variant="secondary" className="text-sm bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                🎉 Promo Akhir Bulan — Diskon hingga 25%!
              </Badge>
              <h1 className="text-4xl lg:text-5xl font-bold leading-tight">
                Snack Lezat,{' '}
                <span className="text-primary">Harga Distributor</span>{' '}
                Langsung ke Tangan Anda
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg">
                Ribuan pilihan snack berkualitas dari distributor terpercaya. Cocok untuk warung, toko, reseller, maupun konsumsi pribadi.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" asChild>
                  <NavLink to="/register">
                    Mulai Belanja Sekarang
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </NavLink>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <NavLink to="/login">Sudah Punya Akun?</NavLink>
                </Button>
              </div>
              <div className="flex items-center gap-6 pt-2">
                <div className="text-center">
                  <p className="text-2xl font-bold">500+</p>
                  <p className="text-xs text-muted-foreground">Jenis Produk</p>
                </div>
                <div className="w-px h-10 bg-border" />
                <div className="text-center">
                  <p className="text-2xl font-bold">10rb+</p>
                  <p className="text-xs text-muted-foreground">Pelanggan Aktif</p>
                </div>
                <div className="w-px h-10 bg-border" />
                <div className="text-center">
                  <p className="text-2xl font-bold">4.9⭐</p>
                  <p className="text-xs text-muted-foreground">Rating Toko</p>
                </div>
              </div>
            </div>
            <div className="relative hidden lg:block">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-amber-400/20 rounded-3xl blur-3xl" />
              <div className="relative grid grid-cols-2 gap-4">
                {featuredProducts.map((p, i) => (
                  <Card key={i} className={cn("overflow-hidden border hover:shadow-lg transition-all", i === 1 && "mt-8")}>
                    <div className="aspect-square bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950/30 dark:to-orange-950/30 flex items-center justify-center text-5xl">
                      {p.emoji}
                    </div>
                    <CardContent className="p-3">
                      <p className="text-xs font-medium line-clamp-1">{p.name}</p>
                      <p className="text-sm font-bold text-primary">{p.price}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Strip */}
      <section className="py-12 border-y bg-muted/30">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", b.bg)}>
                  <b.icon className={cn("h-5 w-5", b.color)} />
                </div>
                <div>
                  <p className="text-sm font-semibold">{b.title}</p>
                  <p className="text-xs text-muted-foreground hidden sm:block">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section id="kategori" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-4">Kategori Produk</Badge>
            <h2 className="text-3xl lg:text-4xl font-bold mb-3">Temukan Snack Favoritmu</h2>
            <p className="text-muted-foreground">Ratusan pilihan dari berbagai kategori snack terlengkap</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((cat, i) => (
              <NavLink to="/register" key={i}>
                <Card className="group cursor-pointer hover:shadow-md hover:border-primary/50 transition-all text-center">
                  <CardContent className="p-4">
                    <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">{cat.emoji}</div>
                    <p className="text-sm font-semibold leading-tight">{cat.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{cat.count}</p>
                  </CardContent>
                </Card>
              </NavLink>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section id="produk" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-center justify-between mb-12">
            <div>
              <Badge variant="secondary" className="mb-2">Produk Unggulan</Badge>
              <h2 className="text-3xl lg:text-4xl font-bold">Paling Banyak Dipesan</h2>
            </div>
            <Button variant="outline" asChild>
              <NavLink to="/register">Lihat Semua <ChevronRight className="ml-1 h-4 w-4" /></NavLink>
            </Button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredProducts.map((product, i) => (
              <Card key={i} className="overflow-hidden group hover:shadow-lg transition-all">
                <div className="aspect-square bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950/30 dark:to-orange-950/30 relative flex items-center justify-center text-6xl group-hover:scale-105 transition-transform">
                  {product.emoji}
                  {product.badge && (
                    <div className="absolute top-2 left-2">
                      <Badge className={cn("text-xs",
                        product.badge === 'Terlaris' && 'bg-rose-500 hover:bg-rose-500',
                        product.badge === 'Baru' && 'bg-blue-500 hover:bg-blue-500',
                        product.badge?.includes('Diskon') && 'bg-emerald-500 hover:bg-emerald-500',
                      )}>{product.badge}</Badge>
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-medium text-sm line-clamp-2 mb-1">{product.name}</h3>
                  <div className="flex items-center gap-1 mb-2">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span className="text-xs text-muted-foreground">{product.rating} • {product.sold}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-primary">{product.price}</p>
                      {product.originalPrice && <p className="text-xs text-muted-foreground line-through">{product.originalPrice}</p>}
                    </div>
                    <Button size="sm" asChild>
                      <NavLink to="/register"><ShoppingCart className="h-3 w-3" /></NavLink>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* About Banner */}
      <section id="tentang" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <Card className="border-0 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground overflow-hidden relative">
            <div className="absolute right-0 top-0 bottom-0 w-64 opacity-10 text-[12rem] leading-none flex items-center justify-end pr-8">🍿</div>
            <CardContent className="p-10 lg:p-16 relative">
              <div className="max-w-2xl">
                <Badge variant="secondary" className="mb-4 bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30">Kenapa Pilih Kami?</Badge>
                <h2 className="text-3xl lg:text-4xl font-bold mb-4">Distributor Snack Terpercaya sejak 2015</h2>
                <p className="text-primary-foreground/80 mb-8 text-lg">Kami menyuplai lebih dari 10.000 toko, warung, dan reseller di seluruh Indonesia dengan harga terbaik langsung dari produsen.</p>
                <div className="grid grid-cols-3 gap-6 mb-8">
                  <div><p className="text-3xl font-bold">9 Thn</p><p className="text-sm text-primary-foreground/70">Pengalaman</p></div>
                  <div><p className="text-3xl font-bold">50+</p><p className="text-sm text-primary-foreground/70">Brand Partner</p></div>
                  <div><p className="text-3xl font-bold">34</p><p className="text-sm text-primary-foreground/70">Provinsi</p></div>
                </div>
                <Button size="lg" variant="secondary" asChild>
                  <NavLink to="/register">Bergabung Sekarang <ChevronRight className="ml-2 h-4 w-4" /></NavLink>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-4">Testimoni Pelanggan</Badge>
            <h2 className="text-3xl lg:text-4xl font-bold mb-3">Apa Kata Mereka?</h2>
            <p className="text-muted-foreground">Ribuan pelanggan puas berbelanja bersama kami</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">{Array.from({ length: t.rating }).map((_, j) => (<Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />))}</div>
                  <p className="text-muted-foreground mb-6 italic">"{t.content}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="font-semibold text-primary">{t.name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-sm text-muted-foreground">{t.role} • {t.city}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="kontak" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-4">Hubungi Kami</Badge>
            <h2 className="text-3xl font-bold mb-3">Ada Pertanyaan?</h2>
            <p className="text-muted-foreground">Tim kami siap membantu Anda</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Phone, title: 'Telepon / WhatsApp', value: '+62 812-3456-7890', sub: 'Senin–Sabtu, 08.00–17.00' },
              { icon: Mail, title: 'Email', value: 'cs@snackhub.id', sub: 'Balasan dalam 1x24 jam' },
              { icon: MapPin, title: 'Alamat Gudang', value: 'Jl. Raya Industri No. 88', sub: 'Jakarta Timur, DKI Jakarta' },
            ].map((item, i) => (
              <Card key={i}>
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <item.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="font-medium">{item.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{item.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 px-4 bg-primary/5">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold mb-4">Siap Mulai Belanja?</h2>
          <p className="text-muted-foreground mb-8">Daftar gratis dan nikmati ribuan pilihan snack dengan harga distributor terbaik.</p>
          <Button size="lg" asChild>
            <NavLink to="/register">Buat Akun Gratis <ChevronRight className="ml-2 h-4 w-4" /></NavLink>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <span className="font-bold text-lg leading-none">SnackHub</span>
                  <p className="text-xs text-muted-foreground">Distributor Snack</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Distributor snack terpercaya untuk warung, toko, dan reseller di seluruh Indonesia.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Belanja</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#kategori" className="hover:text-primary">Semua Kategori</a></li>
                <li><a href="#produk" className="hover:text-primary">Produk Terlaris</a></li>
                <li><NavLink to="/register" className="hover:text-primary">Promo & Diskon</NavLink></li>
                <li><NavLink to="/register" className="hover:text-primary">Produk Baru</NavLink></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Informasi</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#tentang" className="hover:text-primary">Tentang Kami</a></li>
                <li><a href="#kontak" className="hover:text-primary">Kontak</a></li>
                <li><a href="#" className="hover:text-primary">Cara Pemesanan</a></li>
                <li><a href="#" className="hover:text-primary">Kebijakan Pengiriman</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Akun</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><NavLink to="/login" className="hover:text-primary">Masuk</NavLink></li>
                <li><NavLink to="/register" className="hover:text-primary">Daftar</NavLink></li>
                <li><a href="#" className="hover:text-primary">Kebijakan Privasi</a></li>
                <li><a href="#" className="hover:text-primary">Syarat & Ketentuan</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t text-center text-sm text-muted-foreground">
            <p>© 2024 SnackHub Distributor. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
