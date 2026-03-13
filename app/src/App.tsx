import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TaxProvider } from '@/contexts/TaxContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ErrorBoundary } from '@/components/ErrorBoundary';

import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import AdminLayout from '@/layouts/AdminLayout';
import AdminDashboard from '@/pages/admin/Dashboard';
import Products from '@/pages/admin/Products';
import ProductForm from '@/pages/admin/ProductForm';
import Categories from '@/pages/admin/Categories';
import Inventory from '@/pages/admin/Inventory';
import Orders from '@/pages/admin/Orders';
import OrderDetail from '@/pages/admin/OrderDetail';
import StoreManagement from '@/pages/admin/StoreManagement';
import Payments from '@/pages/admin/Payments';
import Reports from '@/pages/admin/Reports';
import Settings from '@/pages/admin/Settings';
import LandingSettings from '@/pages/admin/LandingSettings';
import Suppliers from '@/pages/admin/Suppliers';
import SupplierDetail from '@/pages/admin/SupplierDetail';

import SupplierLayout from '@/layouts/SupplierLayout';
import SupplierDashboard from '@/pages/supplier/Dashboard';
import Onboarding from '@/pages/supplier/Onboarding';
import Catalog from '@/pages/supplier/Catalog';
import ProductDetail from '@/pages/supplier/ProductDetail';
import Cart from '@/pages/supplier/Cart';
import Checkout from '@/pages/supplier/Checkout';
import MyOrders from '@/pages/supplier/MyOrders';
import SupplierOrderDetail from '@/pages/supplier/OrderDetail';
import Invoices from '@/pages/supplier/Invoices';
import Profile from '@/pages/supplier/Profile';
import LandingPage from '@/pages/LandingPage';
import SalesmanLayout from '@/layouts/SalesmanLayout';
import SalesmanDashboard from '@/pages/salesman/Dashboard';
import SalesmanStores from '@/pages/salesman/Stores';
import SalesmanStoreDetail from '@/pages/salesman/StoreDetail';
import SalesmanOrders from '@/pages/salesman/Orders';
import SalesmanNewOrder from '@/pages/salesman/NewOrder';
import VehicleStock from '@/pages/salesman/VehicleStock';
import SalesmanPerformance from '@/pages/salesman/Performance';
import AdminSalesmen from '@/pages/admin/Salesmen';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } } });

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TaxProvider>
        <Router>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Admin */}
              <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin','staff']}><ErrorBoundary><AdminLayout /></ErrorBoundary></ProtectedRoute>}>
                <Route index element={<AdminDashboard />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="products" element={<Products />} />
                <Route path="products/new" element={<ProductForm />} />
                <Route path="products/edit/:id" element={<ProductForm />} />
                <Route path="categories" element={<Categories />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="orders" element={<Orders />} />
                <Route path="orders/:id" element={<OrderDetail />} />
                <Route path="stores" element={<StoreManagement />} />
                <Route path="payments" element={<Payments />} />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<Settings />} />
                <Route path="landing" element={<LandingSettings />} />
                <Route path="salesmen" element={<AdminSalesmen />} />
                <Route path="suppliers" element={<Suppliers />} />
                <Route path="suppliers/:id" element={<SupplierDetail />} />
              </Route>

              {/* Customer (formerly supplier) */}
              <Route path="/supplier" element={<ProtectedRoute allowedRoles={['customer']}><SupplierLayout /></ProtectedRoute>}>
                <Route index element={<SupplierDashboard />} />
                <Route path="dashboard" element={<SupplierDashboard />} />
                <Route path="onboarding" element={<Onboarding />} />
                <Route path="catalog" element={<Catalog />} />
                <Route path="catalog/:id" element={<ProductDetail />} />
                <Route path="cart" element={<Cart />} />
                <Route path="checkout" element={<Checkout />} />
                <Route path="orders" element={<MyOrders />} />
                <Route path="orders/:id" element={<SupplierOrderDetail />} />
                <Route path="invoices" element={<Invoices />} />
                <Route path="profile" element={<Profile />} />
              </Route>

              {/* Salesman */}
              <Route path="/salesman" element={<ProtectedRoute allowedRoles={['salesman']}><SalesmanLayout /></ProtectedRoute>}>
                <Route index element={<SalesmanDashboard />} />
                <Route path="dashboard" element={<SalesmanDashboard />} />
                <Route path="stores" element={<SalesmanStores />} />
                <Route path="stores/:id" element={<SalesmanStoreDetail />} />
                <Route path="orders" element={<SalesmanOrders />} />
                <Route path="orders/new" element={<SalesmanNewOrder />} />
                <Route path="vehicle" element={<VehicleStock />} />
                <Route path="performance" element={<SalesmanPerformance />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
          <Toaster position="top-right" richColors />
        </Router>
        </TaxProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
