"use client";

import { KpiCard } from "@/components/dashboard/kpi-card";
import { DollarSign, ShoppingCart, Users } from "lucide-react";
import * as React from "react";
import { useFirestore } from "@/firebase/provider";
import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import { startOfDay, endOfDay } from "date-fns";

export default function DashboardPage() {
  const firestore = useFirestore();
  const [revenueToday, setRevenueToday] = React.useState(0);
  const [ordersToday, setOrdersToday] = React.useState(0);
  const [occupancy, setOccupancy] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const start = Timestamp.fromDate(startOfDay(new Date()));
        const end = Timestamp.fromDate(endOfDay(new Date()));

        // Orders today
        const ordersRef = collection(firestore, "orders");
        const q = query(ordersRef, where("createdAt", ">=", start), orderBy("createdAt", "asc"));
        const snap = await getDocs(q);
        const todayOrders = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((o) => (o.createdAt?.toDate?.() || new Date()).getTime() <= end.toMillis());

        const count = todayOrders.length;
        const revenue = todayOrders
          .filter((o) => (o.status || "") === "Completed")
          .reduce((s, o) => s + Number(o.total || 0), 0);

        if (!cancelled) {
          setOrdersToday(count);
          setRevenueToday(revenue);
        }

        // Tables occupancy
        const tablesRef = collection(firestore, "tables");
        const tablesSnap = await getDocs(tablesRef);
        const totalTables = tablesSnap.size;
        const occupied = tablesSnap.docs.map(d => d.data() as any).filter(t => t.status === "Occupied");
        const occ = totalTables > 0 ? Math.round((occupied.length / totalTables) * 100) : null;
        if (!cancelled) {
          setOccupancy(occ);
        }
      } catch (e) {
        // Soft-fail: leave defaults
        console.error("Dashboard load error", e);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [firestore]);

  const currency = React.useMemo(
    () => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }),
    []
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Here's a quick overview of your restaurant's performance.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title="Total Revenue"
          value={currency.format(revenueToday)}
          change="Today"
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          title="Total Orders"
          value={String(ordersToday)}
          change="Today"
          icon={<ShoppingCart className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          title="Table Occupancy"
          value={occupancy === null ? "-" : `${occupancy}%`}
          change="Currently"
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Placeholder for future charts or tables */}
      </div>
    </div>
  );
}
