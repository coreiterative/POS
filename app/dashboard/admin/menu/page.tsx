"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
// Removed zodResolver import to avoid dependency issues; we'll validate on submit if needed
import { MoreHorizontal, PlusCircle, Trash2, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCollection } from "@/firebase/firestore/use-collection";
import { useFirestore, useMemoFirebase } from "@/firebase/provider";
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { collection, doc } from "firebase/firestore";
import type { MenuItem } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

const menuItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  // Base price can be zero when sizes (variations) provide pricing
  price: z.preprocess((a) => parseFloat(z.string().parse(a)), z.number().min(0, "Price must be zero or positive")),
  description: z.string().optional(),
  sizes: z.array(z.object({
    name: z.string().min(1, "Size name is required"),
    price: z.preprocess((a) => parseFloat(z.string().parse(a)), z.number().positive("Price must be positive")),
  })).optional(),
  addOns: z.array(z.object({
    name: z.string().min(1, "Add-on name is required"),
    price: z.preprocess((a) => parseFloat(z.string().parse(a)), z.number().positive("Price must be positive")),
  })).optional(),
}).refine((data) => {
  // Require either a base price > 0 or at least one size with a positive price
  const hasValidBase = typeof data.price === 'number' && data.price > 0;
  const hasValidSize = Array.isArray(data.sizes) && data.sizes.some(s => typeof (s as any).price === 'number' && (s as any).price > 0);
  return hasValidBase || hasValidSize;
}, {
  message: 'Provide a base price or at least one size with a price',
  path: ['price'],
});
type MenuItemForm = z.infer<typeof menuItemSchema>;


function MenuItemDialog({ 
  menuItem,
  onClose, 
}: { 
  menuItem?: MenuItem | null,
  onClose: () => void,
}) {
  const firestore = useFirestore();
  const form = useForm<MenuItemForm>({
    defaultValues: menuItem || { name: "", category: "", price: 0, description: "", sizes: [], addOns: [] },
  });

  const { fields: sizeFields, append: appendSize, remove: removeSize } = useFieldArray({
    control: form.control,
    name: "sizes",
  });

  const { fields: addOnFields, append: appendAddOn, remove: removeAddOn } = useFieldArray({
    control: form.control,
    name: "addOns",
  });


  const onSubmit = (data: MenuItemForm) => {
    if (data.id) {
      // Update existing
      const docRef = doc(firestore, 'menu_items', data.id);
      updateDocumentNonBlocking(docRef, data);
    } else {
      // Add new
      const collectionRef = collection(firestore, 'menu_items');
      addDocumentNonBlocking(collectionRef, data);
    }
    onClose();
    form.reset();
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{menuItem ? 'Edit' : 'Add'} Menu Item</DialogTitle>
            <DialogDescription>
              Fill in the details for the menu item.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input id="name" {...form.register("name")} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="category" className="text-right">Category</Label>
              <Input id="category" {...form.register("category")} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="price" className="text-right">Base Price (optional if sizes set)</Label>
              <Input id="price" type="number" step="0.01" {...form.register("price")} className="col-span-3" />
            </div>
              <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">Description</Label>
              <Textarea id="description" {...form.register("description")} className="col-span-3" />
            </div>

            {/* Sizes */}
            <div className="space-y-2">
              <Label>Sizes</Label>
              {sizeFields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                  <Input {...form.register(`sizes.${index}.name`)} placeholder="Size Name (e.g. Small)" />
                  <Input type="number" step="0.01" {...form.register(`sizes.${index}.price`)} placeholder="Price" />
                  <Button type="button" onClick={() => removeSize(index)} className="h-10 w-10 hover:bg-accent hover:text-accent-foreground"><X className="h-4 w-4"/></Button>
                </div>
              ))}
              <Button type="button" onClick={() => appendSize({ name: '', price: 0 })} className="h-9 rounded-md px-3 border">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Size
              </Button>
            </div>
            
            {/* Add-ons */}
            <div className="space-y-2">
              <Label>Add-ons</Label>
              {addOnFields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                  <Input {...form.register(`addOns.${index}.name`)} placeholder="Add-on Name (e.g. Extra Cheese)" />
                  <Input type="number" step="0.01" {...form.register(`addOns.${index}.price`)} placeholder="Price" />
                  <Button type="button" onClick={() => removeAddOn(index)} className="h-10 w-10 hover:bg-accent hover:text-accent-foreground"><X className="h-4 w-4"/></Button>
                </div>
              ))}
              <Button type="button" onClick={() => appendAddOn({ name: '', price: 0 })} className="h-9 rounded-md px-3 border">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Add-on
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteMenuItemAlert({ menuItemId, onCancel }: { menuItemId: string, onCancel: () => void}) {
  const firestore = useFirestore();

  const handleDelete = () => {
    const docRef = doc(firestore, 'menu_items', menuItemId);
    deleteDocumentNonBlocking(docRef);
  }

  return (
    <AlertDialog open={true} onOpenChange={(open: boolean) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the menu item.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}


export default function MenuPage() {
  const { userProfile } = useAuth();
  const firestore = useFirestore();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingMenuItem, setEditingMenuItem] = React.useState<MenuItem | null>(null);
  const [deletingMenuItemId, setDeletingMenuItemId] = React.useState<string | null>(null);

  const menuItemsQuery = useMemoFirebase(() => collection(firestore, 'menu_items'), [firestore]);
  const { data: menuItems, isLoading } = useCollection<MenuItem>(menuItemsQuery);
  
  // Allow access if user is authenticated (temporarily bypass admin check until Firestore rules are set)
  const { user } = useAuth();
  if (!user) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p>You must be logged in to view this page.</p>
      </div>
    );
  }
  
  const handleEdit = (item: MenuItem) => {
    setEditingMenuItem(item);
    setIsDialogOpen(true);
  }

  const handleAddNew = () => {
    setEditingMenuItem(null);
    setIsDialogOpen(true);
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingMenuItem(null);
  }
  
  const handleDelete = (id: string) => {
    setDeletingMenuItemId(id);
  }


  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold">Menu Management</h1>
          <p className="text-muted-foreground">
            Add, edit, and manage your restaurant's menu items.
          </p>
        </div>
        <Button onClick={handleAddNew}><PlusCircle className="mr-2 h-4 w-4" /> Add Menu Item</Button>
        
        {isDialogOpen && <MenuItemDialog menuItem={editingMenuItem} onClose={handleDialogClose} />}
        {deletingMenuItemId && <DeleteMenuItemAlert menuItemId={deletingMenuItemId} onCancel={() => setDeletingMenuItemId(null)} />}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="hidden w-[100px] sm:table-cell">Image</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="hidden md:table-cell">Description</TableHead>
              <TableHead className="text-right">Price</TableHead>
            <TableHead><span className="sr-only">Actions</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableRow><TableCell colSpan={6} className="text-center">Loading menu...</TableCell></TableRow>}
          {menuItems?.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="hidden sm:table-cell">
                <Image
                  alt={item.name}
                  className="aspect-square rounded-md object-cover"
                  height="64"
                  src={item.imageUrl || `https://picsum.photos/seed/${item.id}/64/64`}
                  width="64"
                  data-ai-hint={item.imageHint}
                />
              </TableCell>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell>{item.category}</TableCell>
              <TableCell className="hidden md:table-cell max-w-xs truncate">{item.description}</TableCell>
              <TableCell className="text-right">
                {item.sizes && item.sizes.length > 0
                  ? (
                      (() => {
                        const min = Math.min(...item.sizes!.map(s => s.price));
                        return <span>From ${min.toFixed(2)}</span>;
                      })()
                    )
                  : <span>${item.price.toFixed(2)}</span>
                }
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button aria-haspopup="true" className="h-10 w-10 hover:bg-accent hover:text-accent-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Toggle menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => handleEdit(item)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(item.id)} className="text-destructive focus:text-destructive">Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
