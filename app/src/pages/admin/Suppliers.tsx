import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { supplierService } from '@/services/suppliers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Search,
  Users,
  Eye,
  Plus,
  Building2,
  Mail,
  Phone,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { User } from '@/types';

export default function Suppliers() {
  const [search, setSearch] = useState('');
  // BUG-08 FIX: state dialog tambah supplier
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', company_name: '', phone: '' });

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: supplierService.getSuppliers,
  });

  // BUG-08 FIX: mutation untuk tambah supplier via admin
  const addMutation = useMutation({
    mutationFn: supplierService.createSupplier,
    onSuccess: () => {
      toast.success('Supplier berhasil ditambahkan');
      setAddDialogOpen(false);
      setForm({ name: '', email: '', password: '', company_name: '', phone: '' });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Gagal menambahkan supplier');
    },
  });

  const filteredSuppliers = data?.suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      toast.error('Nama, email, dan password wajib diisi');
      return;
    }
    addMutation.mutate(form);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pelanggan</h1>
          <p className="text-muted-foreground">Kelola data toko & reseller</p>
        </div>
        {/* BUG-08 FIX: tombol Add Supplier membuka dialog */}
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Pelanggan
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
          <div className="col-span-full flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredSuppliers?.length === 0 ? (
          <Card className="col-span-full p-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Belum ada pelanggan</h3>
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

      {/* BUG-08 FIX: Dialog form tambah supplier */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Supplier Baru</DialogTitle>
            <DialogDescription>
              Tambahkan akun customer/reseller baru ke sistem
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="sup-name">Nama Lengkap *</Label>
                <Input
                  id="sup-name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Nama pemilik toko"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sup-company">Nama Toko / Perusahaan</Label>
                <Input
                  id="sup-company"
                  value={form.company_name}
                  onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                  placeholder="Nama toko atau perusahaan"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sup-email">Email *</Label>
                <Input
                  id="sup-email"
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sup-phone">No. Telepon</Label>
                <Input
                  id="sup-phone"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="08xxxxxxxxxx"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sup-password">Password Awal *</Label>
                <Input
                  id="sup-password"
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Minimal 6 karakter"
                  required
                  minLength={6}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={addMutation.isPending}>
                {addMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</>
                ) : 'Tambah Supplier'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
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
            <p className="text-xs text-muted-foreground">Limit Kredit</p>
            <p className="font-medium">{formatCurrency(supplier.credit_limit || 0)}</p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <NavLink to={`/admin/suppliers/${supplier.id}`}>
              <Eye className="mr-2 h-4 w-4" />
              Lihat
            </NavLink>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
