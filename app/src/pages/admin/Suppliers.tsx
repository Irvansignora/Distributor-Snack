import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { supplierService } from '@/services/suppliers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Users,
  Eye,
  Plus,
  Building2,
  Mail,
  Phone
} from 'lucide-react';
import type { User } from '@/types';

export default function Suppliers() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: supplierService.getSuppliers,
  });

  const filteredSuppliers = data?.suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  const formatCurrency = (value: number | null | undefined) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value || 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground">
            Kelola data toko & reseller
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Supplier
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari toko..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div>Loading...</div>
        ) : filteredSuppliers?.length === 0 ? (
          <Card className="col-span-full p-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No suppliers found</h3>
          </Card>
        ) : (
          filteredSuppliers?.map((supplier) => (
            <SupplierCard
              key={supplier.id}
              supplier={supplier}
              formatCurrency={formatCurrency}
            />
          ))
        )}
      </div>
    </div>
  );
}

function SupplierCard({
  supplier,
  formatCurrency
}: {
  supplier: User;
  formatCurrency: (value: number) => string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">{supplier.company_name || supplier.name}</h3>
              <p className="text-sm text-muted-foreground">{supplier.name}</p>
            </div>
          </div>
          <Badge variant={supplier.status === 'active' ? 'default' : 'secondary'}>
            {supplier.status}
          </Badge>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4" />
            {supplier.email}
          </div>
          {supplier.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              {supplier.phone}
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Credit Limit</p>
            <p className="font-medium">{formatCurrency(supplier.credit_limit || 0)}</p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <NavLink to={`/admin/suppliers/${supplier.id}`}>
              <Eye className="mr-2 h-4 w-4" />
              View
            </NavLink>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
