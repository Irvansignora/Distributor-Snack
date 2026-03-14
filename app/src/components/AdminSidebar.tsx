import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  Globe,
  ChevronLeft,
  ChevronRight,
  Warehouse,
  Tags,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const navItems = [
  { path: '/admin/dashboard',  label: 'Dashboard',   icon: LayoutDashboard },
  { path: '/admin/products',   label: 'Produk',       icon: Package },
  { path: '/admin/categories', label: 'Kategori',     icon: Tags },
  { path: '/admin/inventory',  label: 'Stok',         icon: Warehouse },
  { path: '/admin/orders',     label: 'Pesanan',      icon: ClipboardList },
  // BUG FIX: gabungkan "Pelanggan" dan "Pelanggan Baru" jadi satu menu
  { path: '/admin/stores',     label: 'Pelanggan',    icon: Users },
  { path: '/admin/salesmen',   label: 'Salesman',     icon: TrendingUp },
  { path: '/admin/payments',   label: 'Pembayaran',   icon: CreditCard },
  { path: '/admin/reports',    label: 'Laporan',      icon: BarChart3 },
  { path: '/admin/settings',   label: 'Pengaturan',   icon: Settings },
  { path: '/admin/landing',    label: 'Landing Page', icon: Globe },
];

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  const sidebarContent = (
    <div className={cn(
      'flex flex-col h-full bg-card border-r transition-all duration-300',
      collapsed ? 'w-20' : 'w-64'
    )}>
      {/* Logo */}
      <div className="h-16 flex items-center justify-center border-b px-4">
        <NavLink to="/admin/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Package className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && <span className="font-bold text-lg">SnackHub</span>}
        </NavLink>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.path ||
              location.pathname.startsWith(`${item.path}/`);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  collapsed && 'justify-center'
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>
      </ScrollArea>

      {/* User Info */}
      <div className="border-t p-4">
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-semibold text-primary">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
          )}
        </div>
      </div>

      {/* Collapse Button (Desktop only) */}
      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full border bg-background shadow-sm"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </Button>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed left-0 top-0 h-screen z-40">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild className="lg:hidden">
          <Button variant="ghost" size="icon" className="fixed top-4 left-4 z-50">
            <LayoutDashboard className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          {sidebarContent}
        </SheetContent>
      </Sheet>
    </>
  );
}
