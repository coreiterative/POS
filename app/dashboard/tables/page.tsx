"use client";

import React, { useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, doc, updateDoc } from 'firebase/firestore';
import type { Table, Order, OrderItem, MenuItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '@/components/auth/auth-provider';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

type TableStatus = "Available" | "Occupied" | "Reserved";

const statusColors: Record<TableStatus, string> = {
  Available: "border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-900/50 dark:text-green-300",
  Occupied: "border-red-300 bg-red-100 text-red-800 dark:border-red-700 dark:bg-red-900/50 dark:text-red-300",
  Reserved: "border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
};

const newTableSchema = z.object({
  tableNumber: z.preprocess((a) => parseInt(z.string().parse(a)), z.number().positive("Table number must be positive")),
  capacity: z.preprocess((a) => parseInt(z.string().parse(a)), z.number().positive("Capacity must be positive")),
});
type NewTableForm = z.infer<typeof newTableSchema>;

function OrderDetailsDialog({ order, table, onClose, isAdmin }: { order: Order, table: Table & { name: string }, onClose: () => void, isAdmin: boolean }) {
  const firestore = useFirestore();
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customQty, setCustomQty] = useState("1");
  const [menuSearch, setMenuSearch] = useState("");
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<Set<string>>(new Set());

  // Load menu items to add
  const menuItemsQuery = useMemoFirebase(() => collection(firestore, 'menu_items'), [firestore]);
  const { data: menuItems } = useCollection<MenuItem>(menuItemsQuery);
  const filteredMenuItems = (menuItems || []).filter(mi =>
    mi.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
    (mi.category?.toLowerCase().includes(menuSearch.toLowerCase()))
  );

  const handleGenerateBill = async () => {
    const orderRef = doc(firestore, 'orders', order.id);
    const tableRef = doc(firestore, 'tables', table.id);

    // Ensure writes are saved before printing
    try {
      await updateDoc(orderRef, { status: 'Completed', completedAt: (await import('firebase/firestore')).serverTimestamp() });
      await updateDoc(tableRef, { status: 'Available' });
    } catch (e) {
      // If update fails, don't attempt to print
      console.error('Failed to finalize order before printing:', e);
      onClose();
      return;
    }

    // Open print-friendly receipt in a new tab/window
    try {
      window.open(`/receipt/${order.id}/print`, '_blank', 'noopener');
    } catch {}

    onClose();
  };

  const mergeItems = (items: OrderItem[], newItem: OrderItem): OrderItem[] => {
    const sameConfig = (a: OrderItem, b: OrderItem) => (
      a.menuItemId === b.menuItemId && a.size === b.size && JSON.stringify(a.addOns||[]) === JSON.stringify(b.addOns||[])
    );
    const existing = items.find(i => sameConfig(i, newItem));
    if (existing) {
      return items.map(i => sameConfig(i, newItem) ? { ...i, quantity: i.quantity + newItem.quantity } : i);
    }
    return [...items, newItem];
  };

  const openCustomize = (item: MenuItem) => {
    setCustomizingItem(item);
    if (item.sizes && item.sizes.length > 0) setSelectedSize(item.sizes[0].name); else setSelectedSize(null);
    setSelectedAddOns(new Set());
  };

  const addConfiguredToOrder = () => {
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

    const updatedItems = mergeItems(order.items, newItem);
    const newTotal = updatedItems.reduce((t, it) => t + it.price * it.quantity, 0);
    const orderRef = doc(firestore, 'orders', order.id);
    updateDocumentNonBlocking(orderRef, { items: updatedItems, total: newTotal });

    setCustomizingItem(null);
  };

  const addCustomItem = () => {
    const name = customName.trim();
    const price = parseFloat(customPrice);
    const qty = Math.max(1, parseInt(customQty || '1', 10));
    if (!name || isNaN(price) || price < 0) {
      return;
    }
    const newItem: OrderItem = {
      menuItemId: `custom:${name}:${price}`,
      name,
      price,
      quantity: qty,
    };
    const items = [...order.items];
    const idx = items.findIndex(i => i.menuItemId === newItem.menuItemId);
    if (idx >= 0) {
      items[idx] = { ...items[idx], quantity: items[idx].quantity + qty };
    } else {
      items.push(newItem);
    }
    const newTotal = items.reduce((t, it) => t + it.price * it.quantity, 0);
    const orderRef = doc(firestore, 'orders', order.id);
    updateDocumentNonBlocking(orderRef, { items, total: newTotal });

    setCustomName("");
    setCustomPrice("");
    setCustomQty("1");
  };


  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order for {table.name}</DialogTitle>
          <DialogDescription>
            Order placed at: {new Date(order.createdAt?.toDate()).toLocaleString()}
          </DialogDescription>
        </DialogHeader>
        <Separator />
  <ScrollArea className="h-[50vh]">
          <div className="pr-4 space-y-4">
            {order.items.map((item) => (
              <div key={item.menuItemId} className="flex items-center">
                <div className="flex-1">
                  <p className="font-medium text-sm">{item.name} <span className="text-muted-foreground">x{item.quantity}</span></p>
                  {(item.size || (item.addOns && item.addOns.length > 0)) && (
                    <p className="text-[11px] text-muted-foreground">
                      {item.size ? `${item.size}` : ''}
                      {item.size && item.addOns && item.addOns.length > 0 ? '; ' : ''}
                      {item.addOns && item.addOns.length > 0 ? `+ ${item.addOns.join(', + ')}` : ''}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">${item.price.toFixed(2)} each</p>
                </div>
                <p className="w-16 text-right font-semibold">${(item.price * item.quantity).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
        <Separator />
        <div className="w-full flex justify-between font-bold text-lg">
          <span>Total</span>
          <span>${order.total.toFixed(2)}</span>
        </div>
        {/* Add items from menu */}
        {isAdmin && order.status === 'Pending' && (
          <div className="mt-4 space-y-3 border rounded-md p-4">
            <div className="flex items-center justify-between">
              <div className="font-medium">Add from menu</div>
            </div>
            <div className="flex gap-2">
              <Input placeholder="Search by name or category" value={menuSearch} onChange={(e) => setMenuSearch(e.target.value)} />
              <div className="text-xs text-muted-foreground self-center">{filteredMenuItems.length} of {(menuItems||[]).length}</div>
            </div>
            <ScrollArea className="h-[40vh]">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pr-2">
                {filteredMenuItems.map((mi) => (
                  <Card key={mi.id} className="cursor-pointer hover:shadow-md" onClick={() => openCustomize(mi)}>
                    <CardHeader className="p-3"><CardTitle className="text-sm line-clamp-1">{mi.name}</CardTitle></CardHeader>
                    <CardContent className="p-3 pt-0 text-xs text-muted-foreground">
                      {mi.sizes && mi.sizes.length > 0 ? (
                        (() => { const min = Math.min(...mi.sizes!.map(s => s.price)); return <span>From ${min.toFixed(2)}</span>; })()
                      ) : (
                        <span>${mi.price.toFixed(2)}</span>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            {customizingItem && (
              <div className="space-y-4 border rounded-md p-4">
                <div className="font-medium">{customizingItem.name}</div>
                {customizingItem.sizes && customizingItem.sizes.length > 0 && (
                  <div className="space-y-2">
                    <Label className="mb-1 block">Choose a size</Label>
                    <div className="space-y-1">
                      {customizingItem.sizes.map(s => (
                        <label key={s.name} className="flex items-center gap-2 text-sm">
                          <input type="radio" name="size" checked={selectedSize === s.name} onChange={() => setSelectedSize(s.name)} />
                          <span>{s.name} - ${s.price.toFixed(2)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {customizingItem.addOns && customizingItem.addOns.length > 0 && (
                  <div className="space-y-2">
                    <Label className="mb-1 block">Add-ons</Label>
                    <div className="space-y-1">
                      {customizingItem.addOns.map(ao => (
                        <label key={ao.name} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={selectedAddOns.has(ao.name)} onChange={(e) => {
                            setSelectedAddOns(prev => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(ao.name); else next.delete(ao.name);
                              return next;
                            })
                          }} />
                          <span>{ao.name} (+${ao.price.toFixed(2)})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-end">
                  <Button onClick={addConfiguredToOrder}>Add to order</Button>
                </div>
              </div>
            )}
          </div>
        )}
        {/* Custom item entry for admins while pending */}
        {isAdmin && order.status === 'Pending' && (
          <div className="mt-4 space-y-3 border rounded-md p-4">
            <div className="font-medium">Add custom item (not in menu)</div>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center">
              <div className="md:col-span-3">
                <Label htmlFor="customName" className="mb-1 block">Item name</Label>
                <Input id="customName" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g., Extra Sauce" />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="customPrice" className="mb-1 block">Unit price</Label>
                <Input id="customPrice" type="number" step="0.01" min="0" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} placeholder="0.00" />
              </div>
              <div className="md:col-span-1">
                <Label htmlFor="customQty" className="mb-1 block">Qty</Label>
                <Input id="customQty" type="number" min="1" value={customQty} onChange={(e) => setCustomQty(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={addCustomItem}>Add custom item</Button>
            </div>
          </div>
        )}
        

        <DialogFooter>
          {order.status === 'Pending' && (
            <Button
              className="border border-input bg-background hover:bg-accent hover:text-accent-foreground"
              onClick={() => { try { window.open(`/receipt/${order.id}/kitchen`, '_blank', 'noopener'); } catch {} }}
            >
              Print Kitchen Ticket
            </Button>
          )}
          <Button className="border border-input bg-background hover:bg-accent hover:text-accent-foreground" onClick={onClose}>Close</Button>
          <Button onClick={handleGenerateBill}>Generate Bill &amp; Free Table</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TablesPage() {
  const { userProfile, user } = useAuth();
  const firestore = useFirestore();
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);
  const [deletingTable, setDeletingTable] = useState<Table | null>(null);
  const [viewingOrderForTable, setViewingOrderForTable] = useState<Table | null>(null);

  // Allow admin actions if user is admin OR if profile hasn't loaded yet
  const isAdmin = !!(userProfile?.role === 'Admin' || (user && !userProfile));
  
  const tablesQuery = useMemoFirebase(() => collection(firestore, 'tables'), [firestore]);
  const { data: tablesData, isLoading: isLoadingTables } = useCollection<Table>(tablesQuery);

  const ordersQuery = useMemoFirebase(() => collection(firestore, 'orders'), [firestore]);
  const { data: ordersData } = useCollection<Order>(ordersQuery);

  const tables = tablesData?.map(t => ({ ...t, name: `Table ${t.tableNumber}`})).sort((a,b) => a.tableNumber - b.tableNumber) || [];

  const form = useForm<any>({});

  const onAddTable = (data: any) => {
    const parsed: NewTableForm = {
      tableNumber: parseInt(String(data.tableNumber), 10),
      capacity: parseInt(String(data.capacity), 10),
    };
    addDocumentNonBlocking(collection(firestore, 'tables'), {
      ...parsed,
      status: 'Available'
    });
    setAddDialogOpen(false);
    form.reset();
  };

  const onDeleteTable = (tableId: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'tables', tableId));
    setDeletingTable(null);
  }
  
  const handleTableClick = (table: Table) => {
    if (table.status === 'Occupied') {
      setViewingOrderForTable(table);
    }
  }
  
  const currentOrderForTable = ordersData?.find(o => o.tableId === viewingOrderForTable?.id && o.status === 'Pending');

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold">Table Management</h1>
          <p className="text-muted-foreground">
            View and manage your restaurant's table statuses.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setAddDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Add Table</Button>
        )}
      </div>

      {isLoadingTables && <p>Loading tables...</p>}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {tables.map((table) => (
          <Card
            key={table.id}
            onClick={() => handleTableClick(table)}
            className={cn(
              "flex flex-col items-center justify-center aspect-square transition-all hover:scale-105",
              table.status === 'Occupied' ? 'cursor-pointer' : 'cursor-default',
              statusColors[table.status]
            )}
          >
            <CardHeader className="p-4 text-center relative w-full">
              <CardTitle className="font-bold text-lg">{table.name}</CardTitle>
          {isAdmin && (
            <Button className="absolute top-1 right-1 h-7 w-7 hover:bg-accent hover:text-accent-foreground" onClick={(e) => { e.stopPropagation(); setDeletingTable(table);}}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
            </CardHeader>
            <CardContent className="p-4 flex flex-col items-center gap-2">
        <Badge className={cn("text-xs font-semibold border border-input", statusColors[table.status])}>
                    {table.status}
                </Badge>
                <p className="text-xs text-muted-foreground">
                    Capacity: {table.capacity}
                </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Table Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <form onSubmit={form.handleSubmit(onAddTable)}>
            <DialogHeader>
              <DialogTitle>Add New Table</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="tableNumber" className="text-right">Table Number</Label>
                <Input id="tableNumber" type="number" {...form.register("tableNumber")} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="capacity" className="text-right">Capacity</Label>
                <Input id="capacity" type="number" {...form.register("capacity")} className="col-span-3" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Add Table</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Table Alert */}
      {deletingTable && (
         <AlertDialog open={!!deletingTable} onOpenChange={() => setDeletingTable(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete Table {deletingTable.tableNumber}. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletingTable(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDeleteTable(deletingTable.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      
      {/* Order Details Dialog */}
      {viewingOrderForTable && currentOrderForTable && (
        <OrderDetailsDialog 
          order={currentOrderForTable}
          table={{...viewingOrderForTable, name: `Table ${viewingOrderForTable.tableNumber}`}}
          onClose={() => setViewingOrderForTable(null)}
          isAdmin={!!(userProfile?.role === 'Admin' || (user && !userProfile))}
        />
      )}

    </div>
  );
}
