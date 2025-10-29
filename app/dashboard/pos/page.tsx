"use client";

import React, { useState } from "react";
import Image from "next/image";
import { PlusCircle, MinusCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter as UIDialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { OrderItem, MenuItem, Table as TableType } from "@/lib/types";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCollection } from "@/firebase/firestore/use-collection";
import { useFirestore, useMemoFirebase } from "@/firebase/provider";
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { collection, doc, serverTimestamp, addDoc, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

export default function PosPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [lastCreatedOrderId, setLastCreatedOrderId] = useState<string | null>(null);
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<Set<string>>(new Set());
  const [orderType, setOrderType] = useState<string>("Dine-in");
  const [selectedTable, setSelectedTable] = useState<string | undefined>();
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const menuItemsQuery = useMemoFirebase(() => collection(firestore, 'menu_items'), [firestore]);
  const { data: menuItems, isLoading: isLoadingMenu } = useCollection<MenuItem>(menuItemsQuery);
  
  const tablesQuery = useMemoFirebase(() => collection(firestore, 'tables'), [firestore]);
  const { data: tables, isLoading: isLoadingTables } = useCollection<TableType>(tablesQuery);
  
  const categories = ["All", ...Array.from(new Set(menuItems?.map(item => item.category) || []))];
  const filteredMenuItems = activeCategory === 'All' ? menuItems : menuItems?.filter(item => item.category === activeCategory);

  const openCustomize = (item: MenuItem) => {
    setCustomizingItem(item);
    if (item.sizes && item.sizes.length > 0) {
      setSelectedSize(item.sizes[0].name);
    } else {
      setSelectedSize(null);
    }
    setSelectedAddOns(new Set());
  };

  const addConfiguredToCart = () => {
    if (!customizingItem) return;
    const basePrice = (customizingItem.sizes && customizingItem.sizes.length > 0)
      ? (customizingItem.sizes.find(s => s.name === selectedSize)?.price ?? customizingItem.price)
      : customizingItem.price;
    const addOnsTotal = customizingItem.addOns?.reduce((sum, ao) => sum + (selectedAddOns.has(ao.name) ? ao.price : 0), 0) || 0;
    const finalPrice = basePrice + addOnsTotal;

    const newItem: OrderItem = {
      menuItemId: customizingItem.id,
      name: customizingItem.name,
      price: finalPrice,
      quantity: 1,
      size: selectedSize || undefined,
      addOns: Array.from(selectedAddOns),
    };

    setCart(prev => {
      const keyMatches = (a: OrderItem, b: OrderItem) => (
        a.menuItemId === b.menuItemId && a.size === b.size && JSON.stringify(a.addOns||[]) === JSON.stringify(b.addOns||[])
      );
      const existing = prev.find(ci => keyMatches(ci, newItem));
      if (existing) {
        return prev.map(ci => keyMatches(ci, newItem) ? { ...ci, quantity: ci.quantity + 1 } : ci);
      }
      return [...prev, newItem];
    });

    setCustomizingItem(null);
  };
  
  const updateQuantity = (index: number, newQuantity: number) => {
    setCart(prevCart => {
      if (newQuantity <= 0) {
        return prevCart.filter((_, i) => i !== index);
      }
      return prevCart.map((item, i) => i === index ? { ...item, quantity: newQuantity } : item);
    });
  };

  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);

  // Print the customer receipt for the last created non-dine-in order,
  // then clear the cart and reset the tracking id.
  const printCustomerReceiptForLast = () => {
    if (!lastCreatedOrderId) return;
    const orderRef = doc(firestore, 'orders', lastCreatedOrderId);
    // Save completion first, then print
    updateDoc(orderRef, { status: 'Completed', completedAt: serverTimestamp() })
      .then(() => {
        try { window.open(`/receipt/${lastCreatedOrderId}/print`, '_blank', 'noopener'); } catch {}
        setCart([]);
        setLastCreatedOrderId(null);
      })
      .catch((e) => {
        console.error('Failed to finalize order before printing:', e);
      });
  };

  const placeOrderKitchen = async () => {
    if (cart.length === 0) return;
    if (orderType === 'Dine-in') {
      // Kitchen button is meant for Takeaway/Delivery only
      toast({ title: "Kitchen ticket is for Takeaway/Delivery", description: "Switch order type or use Place Order.", variant: "destructive"});
      return;
    }

    const orderData: any = {
      items: cart,
      total: cartTotal,
      status: 'Pending',
      type: orderType,
      createdAt: serverTimestamp(),
    };

    try {
      const ordersCol = collection(firestore, 'orders');
      const newDocRef = await addDoc(ordersCol, orderData);

      // Print kitchen ticket only
      if (newDocRef?.id) {
        try { window.open(`/receipt/${newDocRef.id}/kitchen`, '_blank', 'noopener'); } catch {}
        setLastCreatedOrderId(newDocRef.id);
      }

      toast({ title: "Order sent to kitchen!", description: "Kitchen ticket has been printed. You can now print the customer receipt or continue editing."});
    } catch (e: any) {
      console.error('Failed to place order for kitchen:', e);
      toast({ title: 'Failed to send to kitchen', description: e?.message || 'Please try again.', variant: 'destructive' });
    }
  }

  const placeOrder = async () => {
    if (cart.length === 0) return;
    if (orderType === 'Dine-in' && !selectedTable) {
        toast({ title: "Select a table", description: "Please select a table for the dine-in order.", variant: "destructive"});
        return;
    }

    // Build order payload without undefined fields (Firestore rejects undefined)
    const orderData: any = {
      items: cart,
      total: cartTotal,
      status: 'Pending',
      type: orderType,
      createdAt: serverTimestamp(),
    };
    if (orderType === 'Dine-in') {
      orderData.tableId = selectedTable; // guaranteed by validation above
    }

    try {
      // Save first
      const ordersCol = collection(firestore, 'orders');
      const newDocRef = await addDoc(ordersCol, orderData);

      if (orderType === 'Dine-in' && selectedTable) {
        const tableRef = doc(firestore, 'tables', selectedTable);
        await updateDoc(tableRef, { status: 'Occupied' });
      }

      // Print for non-dine-in orders immediately after save
      if (orderType !== 'Dine-in' && newDocRef?.id) {
        // Mark as completed, then print customer receipt
        const orderRef = doc(firestore, 'orders', newDocRef.id);
        await updateDoc(orderRef, { status: 'Completed', completedAt: serverTimestamp() });
        try { window.open(`/receipt/${newDocRef.id}/print`, '_blank', 'noopener'); } catch {}
        setLastCreatedOrderId(null);
      }

      toast({ title: "Order Placed!", description: "The order has been successfully saved."});

      setCart([]);
      setSelectedTable(undefined);
    } catch (e: any) {
      console.error('Failed to place order:', e);
      toast({ title: 'Failed to place order', description: e?.message || 'Please try again.', variant: 'destructive' });
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-10rem)]">
      {/* Menu Items */}
      <div className="lg:col-span-2">
        <div className="mb-4">
          <h1 className="text-3xl font-headline font-bold">Menu</h1>
          <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mt-2">
            <TabsList>
              {categories.map(category => (
                <TabsTrigger key={category} value={category}>{category}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <ScrollArea className="h-full pb-4">
          {isLoadingMenu ? <p>Loading menu...</p> : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pr-4">
              {filteredMenuItems?.map((item) => (
                <Card key={item.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openCustomize(item)}>
                  <CardContent className="p-0">
                    <Image
                      src={item.imageUrl || `https://picsum.photos/seed/${item.id}/300/200`}
                      alt={item.name}
                      width={300}
                      height={200}
                      className="object-cover rounded-t-lg aspect-[3/2]"
                      data-ai-hint={item.imageHint || 'food'}
                    />
                  </CardContent>
                  <CardFooter className="p-3 flex flex-col items-start">
                    <p className="font-semibold text-sm">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.sizes && item.sizes.length > 0
                        ? (() => { const min = Math.min(...item.sizes!.map(s => s.price)); return `From $${min.toFixed(2)}`; })()
                        : `$${item.price.toFixed(2)}`}
                    </p>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Order Summary */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="font-headline">Current Order</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-4">
          <Tabs value={orderType} onValueChange={setOrderType}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="Dine-in">Dine-in</TabsTrigger>
              <TabsTrigger value="Takeaway">Takeaway</TabsTrigger>
              <TabsTrigger value="Delivery">Delivery</TabsTrigger>
            </TabsList>
          </Tabs>

          {orderType === "Dine-in" && (
            <Select onValueChange={setSelectedTable} value={selectedTable} disabled={isLoadingTables}>
              <SelectTrigger>
                <SelectValue placeholder="Select a table" />
              </SelectTrigger>
              <SelectContent>
                {tables?.map((table) => (
                  <SelectItem key={table.id} value={table.id} disabled={table.status !== 'Available'}>
                    Table {table.tableNumber} ({table.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Separator />
          
          <ScrollArea className="flex-1 -mr-4">
            <div className="pr-4">
            {cart.length === 0 ? (
              <p className="text-muted-foreground text-center py-10">Your cart is empty.</p>
            ) : (
              <div className="space-y-4">
                {cart.map((item, idx) => (
                  <div key={`${item.menuItemId}-${item.size || 'base'}-${(item.addOns||[]).join(',')}-${idx}`} className="flex items-center">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.name} <span className="text-muted-foreground">x{item.quantity}</span></p>
                      {(item.size || (item.addOns && item.addOns.length > 0)) && (
                        <p className="text-[11px] text-muted-foreground">
                          {item.size ? `${item.size}` : ''}
                          {item.size && item.addOns && item.addOns.length > 0 ? '; ' : ''}
                          {item.addOns && item.addOns.length > 0 ? `+ ${item.addOns.join(', + ')}` : ''}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">${item.price.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                       <Button className="h-6 w-6 hover:bg-accent hover:text-accent-foreground" onClick={() => updateQuantity(idx, item.quantity - 1)}>
                        <MinusCircle className="h-4 w-4" />
                       </Button>
                       <span className="w-4 text-center">{item.quantity}</span>
                       <Button className="h-6 w-6 hover:bg-accent hover:text-accent-foreground" onClick={() => updateQuantity(idx, item.quantity + 1)}>
                        <PlusCircle className="h-4 w-4" />
                       </Button>
                    </div>
                    <p className="w-16 text-right font-semibold">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
            <Separator />
            <div className="w-full flex justify-between font-bold">
                <span>Total</span>
                <span>${cartTotal.toFixed(2)}</span>
            </div>
      {orderType !== 'Dine-in' && (
        <Button className="w-full h-11 rounded-md px-8" onClick={placeOrderKitchen} disabled={cart.length === 0}>
                Kitchen Receipt
        </Button>
      )}
      {orderType !== 'Dine-in' && lastCreatedOrderId && (
        <Button className="w-full h-11 rounded-md px-8" onClick={printCustomerReceiptForLast}>
                Customer Receipt
        </Button>
      )}
      <Button className="w-full h-11 rounded-md px-8" onClick={placeOrder} disabled={cart.length === 0}>
                Place Order
            </Button>
      <Button className="w-full h-11 rounded-md px-8 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => setCart([])} disabled={cart.length === 0}>
                <Trash2 className="mr-2 h-4 w-4"/> Clear Cart
            </Button>
        </CardFooter>
      </Card>

      {/* Customize item dialog */}
  <Dialog open={!!customizingItem} onOpenChange={(open: boolean) => { if (!open) setCustomizingItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{customizingItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {customizingItem?.sizes && customizingItem.sizes.length > 0 && (
              <div>
                <Label className="mb-2 block">Choose a size</Label>
                <RadioGroup value={selectedSize || undefined} onValueChange={setSelectedSize}>
                  {customizingItem.sizes.map((s) => (
                    <div key={s.name} className="flex items-center space-x-2">
                      <RadioGroupItem id={`size-${s.name}`} value={s.name} />
                      <Label htmlFor={`size-${s.name}`}>{s.name} - ${s.price.toFixed(2)}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            {customizingItem?.addOns && customizingItem.addOns.length > 0 && (
              <div>
                <Label className="mb-2 block">Add-ons</Label>
                <div className="space-y-2">
                  {customizingItem.addOns.map((ao) => {
                    const id = `addon-${ao.name}`;
                    const checked = selectedAddOns.has(ao.name);
                    return (
                      <div key={ao.name} className="flex items-center space-x-2">
                        <Checkbox id={id} checked={checked} onCheckedChange={(c: boolean) => {
                          setSelectedAddOns(prev => {
                            const next = new Set(prev);
                            if (c) next.add(ao.name); else next.delete(ao.name);
                            return next;
                          });
                        }} />
                        <Label htmlFor={id}>{ao.name} (+${ao.price.toFixed(2)})</Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <UIDialogFooter>
            <Button onClick={addConfiguredToCart}>Add to order</Button>
          </UIDialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
