import { useState } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { productService } from '@/services/products';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Package, ShoppingCart, Plus, Minus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function SupplierProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productService.getProduct(id!),
    enabled: !!id,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleAddToCart = () => {
    if (!data?.product) return;
    
    if (quantity > data.product.stock_quantity) {
      toast.error(`Only ${data.product.stock_quantity} items available`);
      return;
    }
    
    addToCart(data.product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
    toast.success('Added to cart');
  };

  if (isLoading) {
    return <div className="p-4">Loading...</div>;
  }

  const product = data?.product;
  if (!product) {
    return <div className="p-4">Product not found</div>;
  }

  const isOutOfStock = product.stock_quantity === 0;
  const isLowStock = product.stock_quantity <= product.reorder_level;

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <NavLink to="/supplier/catalog">
            <ArrowLeft className="h-4 w-4" />
          </NavLink>
        </Button>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{product.name}</h1>
          <p className="text-muted-foreground">{product.sku}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-0">
            <div className="aspect-square bg-muted">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-24 w-24 text-muted-foreground" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              {product.category && (
                <Badge variant="secondary">{product.category.name}</Badge>
              )}
              {isOutOfStock ? (
                <Badge variant="destructive">Out of Stock</Badge>
              ) : isLowStock ? (
                <Badge variant="secondary">Low Stock</Badge>
              ) : (
                <Badge variant="default" className="bg-emerald-500/10 text-emerald-500">In Stock</Badge>
              )}
            </div>
            <p className="text-muted-foreground">{product.description || 'No description available'}</p>
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Wholesale Price</p>
              <p className="text-3xl font-bold">{formatCurrency(product.wholesale_price || product.price)}</p>
              {product.wholesale_price && product.wholesale_price < product.price && (
                <p className="text-sm text-muted-foreground line-through">
                  Retail: {formatCurrency(product.price)}
                </p>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Available Stock</p>
                <p className={cn(
                  "font-medium",
                  isOutOfStock ? "text-destructive" :
                  isLowStock ? "text-amber-500" : "text-emerald-500"
                )}>
                  {product.stock_quantity} {product.unit}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unit</p>
                <p className="font-medium">{product.unit}</p>
              </div>
              {product.weight && (
                <div>
                  <p className="text-sm text-muted-foreground">Weight</p>
                  <p className="font-medium">{product.weight} kg</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {!isOutOfStock && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">Quantity:</span>
                <div className="flex items-center border rounded-lg">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center font-medium">{quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-4">
                <Button 
                  size="lg" 
                  className="flex-1"
                  onClick={handleAddToCart}
                  disabled={added}
                >
                  {added ? (
                    <>
                      <Check className="mr-2 h-5 w-5" />
                      Added
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="mr-2 h-5 w-5" />
                      Add to Cart
                    </>
                  )}
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <NavLink to="/supplier/cart">View Cart</NavLink>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
