import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { productService } from '@/services/products';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Upload, Loader2, Package } from 'lucide-react';
import { toast } from 'sonner';

// Tier pricing row
interface TierPrice {
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  label: string;
  price_per_karton: string;
  price_per_pack: string;
  price_per_pcs: string;
  min_karton: string;
}

const defaultTiers: TierPrice[] = [
  { tier: 'bronze',   label: 'Bronze (Warung / Baru)',      price_per_karton: '', price_per_pack: '', price_per_pcs: '', min_karton: '1' },
  { tier: 'silver',   label: 'Silver (Minimarket Aktif)',   price_per_karton: '', price_per_pack: '', price_per_pcs: '', min_karton: '1' },
  { tier: 'gold',     label: 'Gold (Volume Tinggi)',         price_per_karton: '', price_per_pack: '', price_per_pcs: '', min_karton: '1' },
  { tier: 'platinum', label: 'Platinum (Sub-Distributor)',  price_per_karton: '', price_per_pack: '', price_per_pcs: '', min_karton: '1' },
];

export default function ProductForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    category_id: '',
    pcs_per_pack: '10',
    pack_per_karton: '12',
    stock_karton: '',
    reorder_level: '10',
    unit_type: 'karton',
    weight_gram: '',
  });

  const [tiers, setTiers] = useState<TierPrice[]>(defaultTiers);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: productService.getCategories,
  });

  const { data: productData, isLoading: productLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productService.getProduct(id!),
    enabled: isEditing,
  });

  useEffect(() => {
    if (productData?.product) {
      const p = productData.product;
      setFormData({
        name: p.name || '',
        sku: p.sku || '',
        description: p.description || '',
        category_id: p.category_id || '',
        pcs_per_pack: p.pcs_per_pack?.toString() || '10',
        pack_per_karton: p.pack_per_karton?.toString() || '12',
        stock_karton: (p.stock_karton ?? p.stock_quantity ?? '').toString(),
        reorder_level: p.reorder_level?.toString() || '10',
        unit_type: p.unit_type || p.unit || 'karton',
        weight_gram: p.weight_gram?.toString() || p.weight?.toString() || '',
      });
      if (p.price_tiers?.length) {
        setTiers(prev => prev.map(t => {
          const found = p.price_tiers?.find((pt: any) => pt.tier === t.tier);
          return found ? {
            ...t,
            price_per_karton: found.price_per_karton?.toString() || '',
            price_per_pack:   found.price_per_pack?.toString()   || '',
            price_per_pcs:    found.price_per_pcs?.toString()    || '',
            min_karton:       found.min_karton?.toString()       || '1',
          } : t;
        }));
      } else if (p.price || p.wholesale_price) {
        // Legacy: map old price fields to bronze/silver
        setTiers(prev => prev.map(t => ({
          ...t,
          price_per_karton: t.tier === 'bronze' ? (p.price?.toString() || '') 
            : t.tier === 'silver' ? (p.wholesale_price?.toString() || '') : '',
        })));
      }
      if (p.image_url) setImagePreview(p.image_url);
    }
  }, [productData]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (isEditing) return productService.updateProduct(id, data);
      return productService.createProduct(data);
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Produk berhasil diperbarui' : 'Produk berhasil ditambahkan');
      navigate('/admin/products');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Gagal menyimpan produk');
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleTierChange = (idx: number, field: keyof TierPrice, value: string) => {
    setTiers(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi minimal 1 tier harga diisi
    const filledTiers = tiers.filter(t => t.price_per_karton);
    if (filledTiers.length === 0) {
      toast.error('Minimal isi harga untuk 1 tier (Bronze)');
      return;
    }

    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (value !== '') data.append(key, value);
    });


    // Kirim price_tiers sebagai JSON
    data.append('price_tiers', JSON.stringify(
      filledTiers.map(t => ({
        tier: t.tier,
        price_per_karton: parseFloat(t.price_per_karton) || 0,
        price_per_pack:   t.price_per_pack ? parseFloat(t.price_per_pack) : null,
        price_per_pcs:    t.price_per_pcs  ? parseFloat(t.price_per_pcs)  : null,
        min_karton:       parseInt(t.min_karton) || 1,
        is_active:        true,
      }))
    ));

    if (image) data.append('image', image);
    mutation.mutate(data);
  };

  if (isEditing && productLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/admin/products')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEditing ? 'Edit Produk' : 'Tambah Produk'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? 'Perbarui detail produk' : 'Tambahkan produk baru ke katalog'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">

            {/* Basic Info */}
            <Card>
              <CardHeader><CardTitle>Informasi Dasar</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nama Produk *</Label>
                    <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU *</Label>
                    <Input id="sku" name="sku" value={formData.sku} onChange={handleChange} required disabled={isEditing} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Deskripsi</Label>
                  <Textarea id="description" name="description" value={formData.description} onChange={handleChange} rows={4} />
                </div>
                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <Select value={formData.category_id} onValueChange={v => setFormData({ ...formData, category_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                    <SelectContent>
                      {categories?.categories?.map((cat: any) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Pricing per Tier */}
            <Card>
              <CardHeader>
                <CardTitle>Harga per Tier</CardTitle>
                <p className="text-sm text-muted-foreground">Isi minimal harga Bronze (Karton). Tier lain opsional.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {tiers.map((t, idx) => (
                  <div key={t.tier} className="space-y-2 p-3 rounded-lg border">
                    <Label className="font-semibold text-sm capitalize">{t.label}</Label>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Harga/Karton (Rp) {t.tier === 'bronze' ? '*' : ''}</Label>
                        <Input
                          type="number" min="0" placeholder="0"
                          value={t.price_per_karton}
                          onChange={e => handleTierChange(idx, 'price_per_karton', e.target.value)}
                          required={t.tier === 'bronze'}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Harga/Pack (Rp)</Label>
                        <Input
                          type="number" min="0" placeholder="Opsional"
                          value={t.price_per_pack}
                          onChange={e => handleTierChange(idx, 'price_per_pack', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Min. Karton</Label>
                        <Input
                          type="number" min="1" placeholder="1"
                          value={t.min_karton}
                          onChange={e => handleTierChange(idx, 'min_karton', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Inventory */}
            <Card>
              <CardHeader><CardTitle>Stok & Satuan</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pcs_per_pack">Pcs per Pack</Label>
                    <Input id="pcs_per_pack" name="pcs_per_pack" type="number" min="1" value={formData.pcs_per_pack} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pack_per_karton">Pack per Karton</Label>
                    <Input id="pack_per_karton" name="pack_per_karton" type="number" min="1" value={formData.pack_per_karton} onChange={handleChange} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stock_karton">Stok (Karton) *</Label>
                    <Input id="stock_karton" name="stock_karton" type="number" min="0" value={formData.stock_karton} onChange={handleChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reorder_level">Level Reorder</Label>
                    <Input id="reorder_level" name="reorder_level" type="number" min="0" value={formData.reorder_level} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight_gram">Berat Karton (gram)</Label>
                    <Input id="weight_gram" name="weight_gram" type="number" min="0" placeholder="0" value={formData.weight_gram} onChange={handleChange} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Image */}
            <Card>
              <CardHeader><CardTitle>Foto Produk</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center overflow-hidden bg-muted">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Package className="h-12 w-12 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Belum ada foto</p>
                    </>
                  )}
                </div>
                <Label htmlFor="image" className="cursor-pointer">
                  <div className="flex items-center justify-center w-full px-4 py-2 border rounded-lg hover:bg-muted transition-colors">
                    <Upload className="mr-2 h-4 w-4" />
                    {imagePreview ? 'Ganti Foto' : 'Upload Foto'}
                  </div>
                  <input id="image" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </Label>
                <p className="text-xs text-muted-foreground text-center">Rekomendasi: 500x500px, maks 5MB</p>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader><CardTitle>Aksi</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Button type="submit" className="w-full" disabled={mutation.isPending}>
                  {mutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</>
                  ) : isEditing ? 'Perbarui Produk' : 'Simpan Produk'}
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={() => navigate('/admin/products')}>
                  Batal
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
