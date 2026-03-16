import { NavLink } from 'react-router-dom';
import { Home, ShoppingBag, ClipboardList, User, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/supplier/dashboard', label: 'Home',    icon: Home },
  { to: '/supplier/catalog',   label: 'Catalog', icon: ShoppingBag },
  { to: '/supplier/orders',    label: 'Orders',  icon: ClipboardList },
  { to: '/supplier/returns',   label: 'Retur',   icon: RotateCcw },
  { to: '/supplier/profile',   label: 'Profile', icon: User },
];

export function SupplierBottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                  isActive 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
