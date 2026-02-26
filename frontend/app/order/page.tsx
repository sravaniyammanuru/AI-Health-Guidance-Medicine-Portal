/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navigation } from '@/components/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';

export default function OrderPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShop, setSelectedShop] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const hasAddedMedicine = useRef(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else {
        loadShops();
      }
    }
  }, [user, authLoading, router]);

  // Separate effect to handle adding medicine from URL params
  useEffect(() => {
    const addMedicineParam = searchParams.get('addMedicine');
    if (addMedicineParam && user && !hasAddedMedicine.current) {
      hasAddedMedicine.current = true;
      try {
        const medicine = JSON.parse(decodeURIComponent(addMedicineParam));
        // Add to cart using functional update to avoid dependency on cart
        setCart(prevCart => {
          const existing = prevCart.find(m => m.id === medicine.id);
          if (existing) {
            return prevCart.map(m => m.id === medicine.id ? { ...m, quantity: m.quantity + 1 } : m);
          } else {
            return [...prevCart, { ...medicine, quantity: 1 }];
          }
        });
        toast.success(`${medicine.name} added to cart`);
        // Remove param from URL after adding
        router.replace('/order');
      } catch (error) {
        console.error('Error parsing medicine data:', error);
      }
    }
  }, [searchParams, user, router]);

  const loadShops = async () => {
    try {
      const response = await api.getNearbyShops();
      setShops(response.shops || []);
      if (response.shops?.length > 0) {
        setSelectedShop(response.shops[0].id.toString());
      }
    } catch {
      toast.error('Failed to load shops');
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setIsSearching(true);
    try {
      const response = await api.searchMedicines(searchTerm, 10);
      setSearchResults(response.medicines || []);
      if (response.medicines?.length === 0) {
        toast.info('No medicines found');
      }
    } catch {
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const addToCart = (medicine: any) => {
    const existing = cart.find(m => m.id === medicine.id);
    if (existing) {
      setCart(cart.map(m => m.id === medicine.id ? { ...m, quantity: m.quantity + 1 } : m));
    } else {
      setCart([...cart, { ...medicine, quantity: 1 }]);
    }
    toast.success(`${medicine.name} added`);
  };

  const updateQuantity = (id: number, qty: number) => {
    if (qty < 1) {
      setCart(cart.filter(m => m.id !== id));
      return;
    }
    setCart(cart.map(m => m.id === id ? { ...m, quantity: qty } : m));
  };

  const total = cart.reduce((sum, m) => sum + (m.price * m.quantity), 0);

  const handlePlaceOrder = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    if (!address || !phone) {
      toast.error('Fill all fields');
      return;
    }
    setShowDialog(true);
  };

  const confirmOrder = async () => {
    if (!user) {
      toast.error('User not logged in');
      return;
    }
    try {
      const shopData = shops.find(s => s.id.toString() === selectedShop);
      const response = await api.createOrder({
        userId: user.id,
        medicines: cart,
        shop: shopData,
        address,
        phone,
        total,
        symptoms
      });

      if (response.success) {
        toast.success('Order placed successfully!');
        setShowDialog(false);
        setCart([]);
        router.push('/consultations');
      }
    } catch {
      toast.error('Order failed');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <Navigation />
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-foreground mb-1">Order Medicine</h1>
          <p className="text-sm text-muted-foreground">Order from nearby pharmacies</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Search & Cart */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Search Medicine</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search medicine..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button onClick={handleSearch} disabled={isSearching}>
                    {isSearching ? 'Searching...' : 'Search'}
                  </Button>
                </div>
                {searchResults.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {searchResults.map((med) => (
                      <div key={med.id} className="p-2 border rounded hover:bg-muted cursor-pointer flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium">{med.name}</p>
                          <p className="text-xs text-muted-foreground">₹{med.price}</p>
                        </div>
                        <Button size="sm" onClick={() => addToCart(med)}>Add</Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cart ({cart.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {cart.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Cart is empty</p>
                ) : (
                  <>
                    {cart.map((item) => (
                      <div key={item.id} className="flex justify-between items-center p-2 border rounded">
                        <div>
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">₹{item.price} each</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button size="sm" variant="outline" onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</Button>
                        </div>
                      </div>
                    ))}
                    <div className="pt-3 border-t">
                      <div className="flex justify-between font-semibold">
                        <span>Total:</span>
                        <span>₹{total}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Delivery Details */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Select Shop</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={selectedShop} onValueChange={setSelectedShop}>
                  {shops.map((shop) => (
                    <div key={shop.id} className="flex items-center space-x-2 p-3 border rounded">
                      <RadioGroupItem value={shop.id.toString()} id={`shop-${shop.id}`} />
                      <Label htmlFor={`shop-${shop.id}`} className="flex-1 cursor-pointer">
                        <div>
                          <p className="font-medium text-sm">{shop.name}</p>
                          <p className="text-xs text-muted-foreground">{shop.distance} • {shop.deliveryTime}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">⭐ {shop.rating}</Badge>
                            {shop.openNow && <Badge variant="default" className="text-xs">Open</Badge>}
                          </div>
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Delivery Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Address</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Delivery address" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
                </div>
                <div>
                  <Label>Symptoms (Optional)</Label>
                  <Textarea value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="Describe symptoms for consultation..." />
                </div>
                <Button className="w-full" onClick={handlePlaceOrder} disabled={cart.length === 0}>
                  Place Order - ₹{total}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Order</DialogTitle>
              <DialogDescription>
                Your order will be reviewed by a doctor before processing.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <p className="text-sm"><strong>Items:</strong> {cart.length}</p>
              <p className="text-sm"><strong>Total:</strong> ₹{total}</p>
              <p className="text-sm"><strong>Shop:</strong> {shops.find(s => s.id.toString() === selectedShop)?.name}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button onClick={confirmOrder}>Confirm Order</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
