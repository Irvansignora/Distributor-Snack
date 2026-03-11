import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { orderService } from '@/services/orders';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Package, MapPin, CreditCard, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, total, clearCart } = useCart();
  const { user } = useAuth();
  const [shippingAddress, setShippingAddress] = useState(user?.address || '');
  const notes = location.state?.notes || '';

  const createOrderMutation = useMutation({
    mutationFn: orderService.createOrder,
    onSuccess: () => {
      toast.success('Order placed successfully!');
      clearCart();
      navigate('/supplier/orders');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to place order');
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    createOrderMutation.mutate({
      items: items.map(item => ({
        product_id: item.product.id,
        qty_karton: item.quantity,
      })),
      payment_method: 'bank_transfer',
      notes,
      shipping_address: shippingAddress ? { address: shippingAddress } : undefined,
    });
  };

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
        <Package className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
        <Button onClick={() => navigate('/supplier/catalog')}>
          Browse Catalog
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/supplier/cart')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Checkout</h1>
          <p className="text-muted-foreground">Review and place your order</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Shipping Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Delivery Address *</Label>
                  <Textarea
                    id="address"
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    placeholder="Enter your complete delivery address"
                    required
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="font-medium">Bank Transfer</p>
                <p className="text-sm text-muted-foreground">
                  You will receive payment instructions after placing your order
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.map(({ product, quantity }) => (
                  <div key={product.id} className="flex items-center gap-4">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {quantity} x {formatCurrency(product.wholesale_price || product.price)}
                      </p>
                    </div>
                    <p className="font-bold">
                      {formatCurrency((product.wholesale_price || product.price) * quantity)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Ongkos kirim</span>
                  <span>Dihitung saat checkout</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Estimasi Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={createOrderMutation.isPending}
              >
                {createOrderMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Placing Order...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Place Order
                  </>
                )}
              </Button>

              <Button 
                type="button" 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/supplier/cart')}
              >
                Back to Cart
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
