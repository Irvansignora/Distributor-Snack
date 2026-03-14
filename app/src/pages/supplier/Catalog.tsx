import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { productService } from '@/services/products';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Package,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';
import type { Product } from '@/types';

export default function Catalog() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const { addToCart } = useCart();

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', search, category],
    queryFn: () => productService.getProducts({
      search: search || undefined,
      category: category === 'all' ? undefined : category,
      limit: 50,
    }),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: productService.getCategories,
  });

  const handleQuantityChange = (productId: string, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [productId]: Math.max(1, (prev[productId] || 1) + delta)
    }));
  };

  const handleAddToCart = (product: Product) => {
    const quantity = quantities[product.id] || 1;
    if (quantity > product.stock_quantity) {
      toast.error(`Stok tersedia hanya ${product.stock_quantity} item`);
      return;
    }
    addToCart(product, quantity);
    toast.success(`${product.name} ditambahkan ke keranjang`);
    setQuantities(prev => ({ ...prev, [product.id]: 1 }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-4 p-4 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Katalog Produk</h1>
          <p className="text-muted-foreground">
            Temukan snack favoritmu dengan harga terbaik
          </p>
        </div>
        <Button asChild>
          <NavLink to="/supplier/cart">
            <ShoppingCart className="mr-2 h-4 w-4" />
            View Cart
          </NavLink>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari produk..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {categoriesData?.categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Products Grid */}
      {isLoading ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="aspect-square bg-muted" />
              <CardContent className="p-4 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : productsData?.products.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Produk tidak ditemukan</h3>
          <p className="text-muted-foreground">Coba ubah kata kunci atau filter kategori</p>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {productsData?.products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              quantity={quantities[product.id] || 1}
              onQuantityChange={(delta) => handleQuantityChange(product.id, delta)}
              onAddToCart={() => handleAddToCart(product)}
              formatCurrency={formatCurrency}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({
  product,
  quantity,
  onQuantityChange,
  onAddToCart,
  formatCurrency
}: {
  product: Product;
  quantity: number;
  onQuantityChange: (delta: number) => void;
  onAddToCart: () => void;
  formatCurrency: (value: number) => string;
}) {
  const isOutOfStock = product.stock_quantity === 0;
  const isLowStock = product.stock_quantity <= product.reorder_level;

  return (
    <Card className="overflow-hidden flex flex-col">
      <NavLink to={`/supplier/catalog/${product.id}`}>
        <div className="aspect-square bg-muted relative">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-12 w-12 text-muted-foreground/50" />
            </div>
          )}
          {(isOutOfStock || isLowStock) && (
            <div className="absolute top-2 left-2">
              <Badge variant={isOutOfStock ? 'destructive' : 'secondary'}>
                {isOutOfStock ? 'Out of Stock' : 'Low Stock'}
              </Badge>
            </div>
          )}
        </div>
      </NavLink>
      <CardContent className="p-3 lg:p-4 flex flex-col flex-1">
        <NavLink to={`/supplier/catalog/${product.id}`}>
          <h3 className="font-medium text-sm lg:text-base line-clamp-2 hover:text-primary">
            {product.name}
          </h3>
        </NavLink>
        
        <div className="mt-auto pt-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              {product.price_hidden ? (
                <p className="text-sm text-muted-foreground italic">Login untuk lihat harga</p>
              ) : (
                <>
                  {/* Harga Reseller (harga utama besar) */}
                  <p className="text-lg font-bold text-primary">{formatCurrency(product.price || 0)}</p>
                  {/* Harga Agent (grosir, tampil jika berbeda) */}
                  {product.wholesale_price && product.wholesale_price !== product.price && (
                    <p className="text-xs text-muted-foreground">
                      Grosir: {formatCurrency(product.wholesale_price)}
                    </p>
                  )}
                </>
              )}
            </div>
            {isOutOfStock && (
              <span className="text-xs text-destructive font-medium">Habis</span>
            )}
          </div>

          {!isOutOfStock && (
            <div className="flex items-center gap-2">
              <div className="flex items-center border rounded-lg">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onQuantityChange(-1)}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-8 text-center text-sm">{quantity}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onQuantityChange(1)}
                  disabled={quantity >= product.stock_quantity}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <Button size="sm" className="flex-1" onClick={onAddToCart}>
                <ShoppingCart className="h-4 w-4 mr-1" />
                Tambah
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
