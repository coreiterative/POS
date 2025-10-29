"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format, startOfDay, endOfDay } from "date-fns";
import { Calendar as CalendarIcon, Search, Eye, Trash2, Printer, ChefHat } from "lucide-react";

import { useFirestore } from "@/firebase/provider";
import { collection, getDocs, orderBy, query, Timestamp, where } from "firebase/firestore";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { doc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { Icons } from "@/components/icons";
import { useToast } from "@/hooks/use-toast";

const OrderFormSchema = z.object({
  from: z.date({ required_error: "A start date is required." }),
  to: z.date({ required_error: "An end date is required." }),
  status: z.string().optional(),
  search: z.string().optional(),
});

type OrderRow = {
  id: string;
  createdAt: Date;
  type?: string;
  tableLabel?: string;
  tableNumber?: number | string;
  itemsCount: number;
  total: number;
  status: string;
  order?: any;
};

export default function OrderReportsPage() {
  const { user, userProfile } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const today = React.useMemo(() => new Date(), []);
  const isAdmin = !!(userProfile?.role === "Admin" || (user && !userProfile));

  const form = useForm<z.infer<typeof OrderFormSchema>>({
    defaultValues: { from: today, to: today, status: "Completed", search: "" },
  });

  const [rows, setRows] = React.useState<OrderRow[]>([]);
  const [grandTotal, setGrandTotal] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [viewing, setViewing] = React.useState<OrderRow | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function onSubmit(data: z.infer<typeof OrderFormSchema>) {
    if (!data.from || !data.to) return;
    setIsLoading(true);
    setRows([]);
    setGrandTotal(0);
    try {
      // Build a tableId -> tableNumber map to resolve accurate table numbers
      const tablesSnapshot = await getDocs(collection(firestore, "tables"));
      const tableNumberById = new Map<string, number | string | undefined>();
      tablesSnapshot.docs.forEach((td) => {
        const t = td.data() as any;
        tableNumberById.set(td.id, t?.tableNumber);
      });

      const start = Timestamp.fromDate(startOfDay(data.from));
      const end = Timestamp.fromDate(endOfDay(data.to));
      const ordersRef = collection(firestore, "orders");
      const q = query(ordersRef, where("createdAt", ">=", start), orderBy("createdAt", "asc"));
      const snapshot = await getDocs(q);

      let list: OrderRow[] = snapshot.docs
        .map((d) => {
          const o = d.data() as any;
          const itemsCount = (o.items || []).reduce((s: number, it: any) => s + (it.quantity || 0), 0);
          const createdAtRaw: Date | undefined = o.createdAt?.toDate?.() || undefined;
          const completedAtRaw: Date | undefined = o.completedAt?.toDate?.() || undefined;
          const createdAt: Date = (completedAtRaw || createdAtRaw || new Date());
          const tableNumber = o.tableId ? tableNumberById.get(o.tableId) : undefined;
          return {
            id: d.id,
            createdAt,
            type: o.type,
            tableLabel: tableNumber !== undefined ? `Table ${tableNumber}` : undefined,
            tableNumber,
            itemsCount,
            total: Number(o.total || 0),
            status: o.status || "Unknown",
            order: o,
          } as OrderRow;
        })
  .filter((r) => r.createdAt.getTime() <= end.toMillis());

      if (data.status && data.status !== "All") {
        list = list.filter((r) => r.status === data.status);
      } else {
        // By default, show only Completed to align with business rule
        list = list.filter((r) => r.status === 'Completed');
      }

      const term = (data.search || "").trim().toLowerCase();
      if (term) {
        list = list.filter((r) => {
          const label = (r.tableLabel || '').toLowerCase();
          const num = r.tableNumber !== undefined ? String(r.tableNumber).toLowerCase() : '';
          return label.includes(term) || num.includes(term);
        });
      }

      list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setRows(list);
      setGrandTotal(list.reduce((s, r) => s + r.total, 0));
    } catch (error) {
      console.error(error);
      toast({
        title: "Error Generating Order Report",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (!user) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p>You must be logged in to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-bold">Order Report</h1>
        <p className="text-muted-foreground">View order history (receipts) for a selected date range.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 md:grid-cols-12 items-end">
              <div className="md:col-span-3">
                <FormField
                  control={form.control}
                  name="from"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>From</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button type="button" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "MM/dd/yyyy") : <span>Pick a date</span>}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="md:col-span-3">
                <FormField
                  control={form.control}
                  name="to"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>To</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button type="button" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "MM/dd/yyyy") : <span>Pick a date</span>}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="All">All</SelectItem>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                          <SelectItem value="Cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>
              <div className="md:col-span-3">
                <FormField
                  control={form.control}
                  name="search"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Search (table)</FormLabel>
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Enter table" className="pl-8" {...field} />
                      </div>
                    </FormItem>
                  )}
                />
              </div>
              <div className="md:col-span-1">
                <Button type="submit" disabled={isLoading} className="w-full md:w-auto h-11 px-6 font-semibold shadow-sm bg-primary text-primary-foreground hover:bg-primary/90">
                  {isLoading && <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />}
                  Run
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Table No.</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No orders found. Choose filters and run.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r, i) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{i + 1}</TableCell>
                    <TableCell>{format(r.createdAt, "MM/dd/yyyy HH:mm")}</TableCell>
                    <TableCell>{r.type || "-"}</TableCell>
                    <TableCell>{r.tableNumber ?? (r.tableLabel ? String(r.tableLabel).replace(/[^0-9]/g, "") : "-")}</TableCell>
                    <TableCell className="text-right">{r.itemsCount}</TableCell>
                    <TableCell className="text-right">{r.total.toFixed(2)}</TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        type="button"
                        onClick={() => {
                          try { window.open(`/receipt/${r.id}/kitchen`, '_blank', 'noopener'); } catch {}
                        }}
                        className="h-8 px-2 py-1 text-xs"
                        title="Print kitchen ticket"
                      >
                        <ChefHat className="h-4 w-4" />
                        <span className="sr-only">Kitchen</span>
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          try { window.open(`/receipt/${r.id}/print`, '_blank', 'noopener'); } catch {}
                        }}
                        className="h-8 px-2 py-1 text-xs"
                        title="Re-print receipt"
                      >
                        <Printer className="h-4 w-4" />
                        <span className="sr-only">Print</span>
                      </Button>
                      <Button type="button" onClick={() => setViewing(r)} className="h-8 px-2 py-1 text-xs">
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">View</span>
                      </Button>
                      {isAdmin && (
                        <Button
                          type="button"
                          onClick={() => setDeletingId(r.id)}
                          className="h-8 px-2 py-1 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={5} className="font-semibold">Grand Total</TableCell>
                  <TableCell className="text-right font-bold">{grandTotal.toFixed(2)}</TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {viewing && (
        <Dialog open={!!viewing} onOpenChange={(open: boolean) => !open && setViewing(null)}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Receipt</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Date</span>
                <span>{format(viewing.createdAt, "MM/dd/yyyy HH:mm")}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Type</span>
                <span>{viewing.type || "-"}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Table No.</span>
                <span>{viewing.tableNumber ?? (viewing.tableLabel ? String(viewing.tableLabel).replace(/[^0-9]/g, "") : "-")}</span>
              </div>
              <div className="pt-4">
                <div className="font-medium mb-2">Items</div>
                <div className="max-h-64 overflow-y-auto border rounded-md">
                  <div className="divide-y">
                    {(viewing.order?.items || []).map((it: any, idx: number) => (
                      <div key={idx} className="p-3 flex items-center justify-between text-sm">
                        <div>
                          <div className="font-medium">{it.name || it.menuItemId}</div>
                          <div className="text-muted-foreground">
                            {it.size ? `Size: ${it.size}` : null}
                            {it.addOns && it.addOns.length ? `  •  Add-ons: ${it.addOns.join(", ")}` : null}
                          </div>
                        </div>
                        <div className="text-right whitespace-nowrap">
                          <div>Qty: {it.quantity || 1}</div>
                          <div className="font-mono">{Number(it.price || 0).toFixed(2)}</div>
                        </div>
                      </div>
                    ))}
                    {(!viewing.order?.items || viewing.order.items.length === 0) && (
                      <div className="p-3 text-center text-muted-foreground">No items</div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-between pt-4 text-base">
                <span className="font-semibold">Total</span>
                <span className="font-bold">{viewing.total.toFixed(2)}</span>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => setViewing(null)} className="ml-auto">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {deletingId && (
        <AlertDialog open={!!deletingId} onOpenChange={(open: boolean) => !open && setDeletingId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Receipt?</AlertDialogTitle>
              <AlertDialogDescription>
                This action will permanently delete this receipt. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const id = deletingId;
                  setDeletingId(null);
                  if (!id) return;
                  deleteDocumentNonBlocking(doc(firestore, "orders", id));
                  setRows((prev) => {
                    const next = prev.filter((r) => r.id !== id);
                    setGrandTotal(next.reduce((s, r) => s + r.total, 0));
                    return next;
                  });
                  toast({ title: "Receipt deleted" });
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
