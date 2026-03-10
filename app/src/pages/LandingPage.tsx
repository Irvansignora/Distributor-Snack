import { NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Package,
  ShoppingCart,
  BarChart3,
  Users,
  CreditCard,
  Truck,
  CheckCircle,
  ArrowRight,
  Star,
  Menu,
  X,
  Moon,
  Sun
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: Package,
    title: 'Smart Inventory',
    description: 'Real-time stock tracking with AI-powered demand forecasting',
  },
  {
    icon: ShoppingCart,
    title: 'Order Management',
    description: 'Streamlined order workflow from receipt to fulfillment',
  },
  {
    icon: Users,
    title: 'Supplier Portal',
    description: 'Self-service portal for suppliers to manage orders and payments',
  },
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    description: 'Deep insights into sales patterns and business performance',
  },
  {
    icon: CreditCard,
    title: 'Payment System',
    description: 'Secure payment processing with multiple payment methods',
  },
  {
    icon: Truck,
    title: 'Delivery Tracking',
    description: 'Track shipments and manage delivery schedules',
  },
];

const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'Operations Director',
    company: 'FreshSnack Co.',
    content: 'SnackTrack transformed our inventory management. We\'ve reduced waste by 35% and never miss a reorder.',
    rating: 5,
  },
  {
    name: 'Marcus Johnson',
    role: 'CEO',
    company: 'QuickBite Distribution',
    content: 'The analytics dashboard alone is worth the investment. We finally understand our business patterns.',
    rating: 5,
  },
  {
    name: 'Elena Rodriguez',
    role: 'Warehouse Manager',
    company: 'LatinSnacks',
    content: 'Our team learned the system in a day. The mobile app keeps everyone connected and informed.',
    rating: 5,
  },
];

const pricingPlans = [
  {
    name: 'Starter',
    price: 49,
    description: 'Perfect for small distributors',
    features: [
      'Up to 500 products',
      '3 warehouse locations',
      'Basic analytics',
      'Email support',
    ],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    name: 'Professional',
    price: 99,
    description: 'For growing businesses',
    features: [
      'Unlimited products',
      '10 warehouse locations',
      'Advanced analytics',
      'Priority support',
      'Supplier portal',
      'API access',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: null,
    description: 'For large operations',
    features: [
      'Everything in Pro',
      'Unlimited warehouses',
      'Custom integrations',
      'Dedicated account manager',
      'SLA guarantee',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
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
              <span className="font-bold text-xl">SnackTrack</span>
            </NavLink>

            <nav className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm font-medium hover:text-primary transition-colors">Features</a>
              <a href="#pricing" className="text-sm font-medium hover:text-primary transition-colors">Pricing</a>
              <a href="#testimonials" className="text-sm font-medium hover:text-primary transition-colors">Testimonials</a>
            </nav>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              >
                {resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
              <Button variant="ghost" asChild className="hidden sm:flex">
                <NavLink to="/login">Sign In</NavLink>
              </Button>
              <Button asChild className="hidden sm:flex">
                <NavLink to="/register">Get Started</NavLink>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          {mobileMenuOpen && (
            <nav className="md:hidden py-4 border-t">
              <div className="flex flex-col gap-2">
                <a href="#features" className="px-4 py-2 hover:bg-muted rounded-lg" onClick={() => setMobileMenuOpen(false)}>Features</a>
                <a href="#pricing" className="px-4 py-2 hover:bg-muted rounded-lg" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
                <a href="#testimonials" className="px-4 py-2 hover:bg-muted rounded-lg" onClick={() => setMobileMenuOpen(false)}>Testimonials</a>
                <div className="flex gap-2 px-4 pt-2">
                  <Button variant="outline" asChild className="flex-1">
                    <NavLink to="/login">Sign In</NavLink>
                  </Button>
                  <Button asChild className="flex-1">
                    <NavLink to="/register">Get Started</NavLink>
                  </Button>
                </div>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge variant="secondary" className="text-sm">
                New: AI-Powered Inventory Forecasting
              </Badge>
              <h1 className="text-4xl lg:text-6xl font-bold leading-tight">
                Smart Snack Distribution for the{' '}
                <span className="text-primary">Modern Era</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg">
                Streamline your inventory, orders, and supplier relationships with our intelligent platform. 
                Built for distributors who demand excellence.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" asChild>
                  <NavLink to="/register">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </NavLink>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <NavLink to="/login">Watch Demo</NavLink>
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Trusted by 500+ distributors worldwide
              </p>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-3xl blur-3xl" />
              <Card className="relative border-0 shadow-2xl">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Today's Sales</p>
                        <p className="text-2xl font-bold">$12,450</p>
                      </div>
                      <div className="p-3 bg-emerald-500/10 rounded-lg">
                        <BarChart3 className="h-6 w-6 text-emerald-500" />
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full w-3/4 bg-primary rounded-full" />
                    </div>
                    <div className="grid grid-cols-3 gap-4 pt-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold">156</p>
                        <p className="text-xs text-muted-foreground">Orders</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">89</p>
                        <p className="text-xs text-muted-foreground">Products</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">42</p>
                        <p className="text-xs text-muted-foreground">Suppliers</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/50">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">Powerful Features</Badge>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Everything You Need to Succeed</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Comprehensive tools designed specifically for snack distribution businesses
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="group hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">Customer Stories</Badge>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Loved by Distributors</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              See what our customers have to say about SnackTrack
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-6">"{testimonial.content}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="font-semibold text-primary">
                        {testimonial.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {testimonial.role}, {testimonial.company}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-muted/50">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">Pricing</Badge>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that fits your business
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {pricingPlans.map((plan, index) => (
              <Card key={index} className={cn(
                "relative",
                plan.popular && "border-primary shadow-lg scale-105"
              )}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge>Most Popular</Badge>
                  </div>
                )}
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>
                  <div className="mb-6">
                    {plan.price ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold">${plan.price}</span>
                        <span className="text-muted-foreground">/month</span>
                      </div>
                    ) : (
                      <span className="text-4xl font-bold">Custom</span>
                    )}
                  </div>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full" 
                    variant={plan.popular ? 'default' : 'outline'}
                    asChild
                  >
                    <NavLink to="/register">{plan.cta}</NavLink>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <Card className="border-0 bg-primary text-primary-foreground">
            <CardContent className="p-12 text-center">
              <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                Ready to Transform Your Distribution Business?
              </h2>
              <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
                Join 500+ distributors already using SnackTrack to streamline their operations
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" variant="secondary" asChild>
                  <NavLink to="/register">
                    Start Your Free Trial
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </NavLink>
                </Button>
                <Button size="lg" variant="outline" className="border-primary-foreground/20 hover:bg-primary-foreground/10" asChild>
                  <NavLink to="/login">Schedule a Demo</NavLink>
                </Button>
              </div>
              <p className="text-sm text-primary-foreground/60 mt-6">
                No credit card required • 14-day free trial
              </p>
            </CardContent>
          </Card>
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
                <span className="font-bold text-xl">SnackTrack</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Smart distribution for modern businesses
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-primary">Features</a></li>
                <li><a href="#pricing" className="hover:text-primary">Pricing</a></li>
                <li><a href="#" className="hover:text-primary">Integrations</a></li>
                <li><a href="#" className="hover:text-primary">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary">About</a></li>
                <li><a href="#" className="hover:text-primary">Blog</a></li>
                <li><a href="#" className="hover:text-primary">Careers</a></li>
                <li><a href="#" className="hover:text-primary">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary">Privacy</a></li>
                <li><a href="#" className="hover:text-primary">Terms</a></li>
                <li><a href="#" className="hover:text-primary">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t text-center text-sm text-muted-foreground">
            <p>© 2024 SnackTrack. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
