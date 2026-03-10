import { Outlet } from 'react-router-dom';
import { SupplierNavbar } from '@/components/SupplierNavbar';
import { SupplierBottomNav } from '@/components/SupplierBottomNav';

export default function SupplierLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SupplierNavbar />
      <main className="flex-1 pb-20 lg:pb-0">
        <Outlet />
      </main>
      <SupplierBottomNav />
    </div>
  );
}
