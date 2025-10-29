"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format, startOfDay, endOfDay } from "date-fns";
import { Calendar as CalendarIcon, Search } from "lucide-react";

// Local Firestore-based reporting (no AI dependency)
import { useFirestore } from "@/firebase/provider";
import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
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
// Note: This page renders only Sales Report; Order Report moved to its own route.
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Icons } from "@/components/icons";
import { useToast } from "@/hooks/use-toast";

const FormSchema = z.object({
  from: z.date({ required_error: "A start date is required." }),
  to: z.date({ required_error: "An end date is required." }),
  search: z.string().optional(),
});

type ItemAggregate = {
  name: string;
  totalQty: number;
  totalAmount: number;
  sizes: Record<string, { qty: number; amount: number }>;
};

export default function ReportsPage() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = React.useState(false);
  const [rows, setRows] = React.useState<ItemAggregate[]>([]);
  const [grandTotal, setGrandTotal] = React.useState(0);
  const { toast } = useToast();

  const today = React.useMemo(() => new Date(), []);
  const form = useForm<z.infer<typeof FormSchema>>({
    defaultValues: { from: today, to: today, search: "" },
  });

  // Order Report moved to /dashboard/admin/order-reports

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    if (!data.from || !data.to) return;
    setIsLoading(true);
    setRows([]);
    setGrandTotal(0);
    try {
      // Normalize to full day range
      const start = Timestamp.fromDate(startOfDay(data.from));
      const end = Timestamp.fromDate(endOfDay(data.to));

      // Query orders by createdAt >= start, then in-memory filter <= end to reduce index needs
      const ordersRef = collection(firestore, "orders");
      const q = query(ordersRef, where("createdAt", ">=", start), orderBy("createdAt", "asc"));
      const snapshot = await getDocs(q);
      const orders = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((o) => {
          // Only count completed sales; prefer completedAt within range, fallback to createdAt
          if (o.status !== 'Completed') return false;
          const ts = (o.completedAt?.toMillis?.() || o.createdAt?.toMillis?.());
          return ts && ts <= end.toMillis();
        });

      // Aggregate per item and size
      const map = new Map<string, ItemAggregate>();
      let total = 0;
      for (const o of orders) {
        for (const it of (o.items || [])) {
          const name: string = it.name || "Unknown";
          const size: string = it.size || "Regular";
          const qty: number = Number(it.quantity || 0);
          const amt: number = Number(it.price || 0) * qty;
          total += amt;

          if (!map.has(name)) {
            map.set(name, { name, totalQty: 0, totalAmount: 0, sizes: {} });
          }
          const entry = map.get(name)!;
          entry.totalQty += qty;
          entry.totalAmount += amt;
          entry.sizes[size] = entry.sizes[size] || { qty: 0, amount: 0 };
          entry.sizes[size].qty += qty;
          entry.sizes[size].amount += amt;
        }
      }

      // Filter by search (name or contains id if available in any size keys — we only have name here)
      const term = (data.search || "").trim().toLowerCase();
      let list = Array.from(map.values());
      if (term) {
        list = list.filter((it) => it.name.toLowerCase().includes(term));
      }

      // Sort by totalAmount desc for readability
      list.sort((a, b) => b.totalAmount - a.totalAmount);
      setRows(list);
      setGrandTotal(total);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error Generating Report",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Removed Order Report logic from this page

  // Allow access if user is authenticated (temporarily bypass admin check until Firestore rules are set)
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
        <h1 className="text-3xl font-headline font-bold">Sales Report</h1>
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
                            <Button
                              type="button"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "MM/dd/yyyy") : <span>Pick a date</span>}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
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
                            <Button
                              type="button"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "MM/dd/yyyy") : <span>Pick a date</span>}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="md:col-span-5">
                <FormField
                  control={form.control}
                  name="search"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Search Item (name or id)</FormLabel>
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Enter name or id" className="pl-8" {...field} />
                      </div>
                    </FormItem>
                  )}
                />
              </div>
              <div className="md:col-span-1">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full md:w-auto h-11 px-6 font-semibold shadow-sm bg-primary text-primary-foreground hover:bg-primary/90"
                >
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
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead className="w-40">Variation</TableHead>
                  <TableHead className="w-40 text-right">Quantity Sold</TableHead>
                  <TableHead className="w-40 text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No data yet. Choose a date range and click Run Report.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((item, idx) => (
                  <React.Fragment key={item.name}>
                    <TableRow>
                      <TableCell className="font-medium">{idx + 1}</TableCell>
                      <TableCell className="font-semibold">{item.name}</TableCell>
                      <TableCell>All</TableCell>
                      <TableCell className="text-right">{item.totalQty}</TableCell>
                      <TableCell className="text-right">{item.totalAmount.toFixed(2)}</TableCell>
                    </TableRow>
                    {Object.entries(item.sizes)
                      .sort((a, b) => b[1].qty - a[1].qty)
                      .map(([size, s]) => (
                        <TableRow key={item.name + size}>
                          <TableCell></TableCell>
                          <TableCell className="text-muted-foreground">
                            <span className="mr-2">└</span>
                            {item.name}
                          </TableCell>
                          <TableCell>{size}</TableCell>
                          <TableCell className="text-right">{s.qty}</TableCell>
                          <TableCell className="text-right">{s.amount.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                  </React.Fragment>
                ))}
                <TableRow>
                  <TableCell colSpan={4} className="font-semibold">
                    Grand Total
                  </TableCell>
                  <TableCell className="text-right font-bold">{grandTotal.toFixed(2)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Order Report moved to its own page */}
    </div>
  );
}
