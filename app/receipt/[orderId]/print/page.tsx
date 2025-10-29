"use client";

import * as React from "react";
import { useMemo } from "react";
import { useFirestore } from "@/firebase/provider";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc } from "firebase/firestore";
import type { Order, Table } from "@/lib/types";
import { ReceiptPrint } from "@/components/receipt/receipt-print";

export default function ReceiptPrintPage({ params }: { params: { orderId: string } }) {
  const firestore = useFirestore();

  const orderRef = useMemo(() => doc(firestore, "orders", params.orderId), [firestore, params.orderId]);
  const { data: order, isLoading: orderLoading } = useDoc<Order>(orderRef);

  const tableRef = useMemo(() => {
    if (!order?.tableId) return null;
    return doc(firestore, "tables", order.tableId);
  }, [firestore, order?.tableId]);
  const { data: table, isLoading: tableLoading } = useDoc<Table>(tableRef as any);

  React.useEffect(() => {
    if (!order || (order?.tableId && tableLoading)) return;
    const t = setTimeout(() => {
      window.print();
    }, 300);
    const after = () => {
      setTimeout(() => window.close(), 300);
    };
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("afterprint", after);
      clearTimeout(t);
    };
  }, [order, tableLoading]);

  if (orderLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Preparing receipt…</div>;
  }

  if (!order) {
    return <div className="p-4 text-sm text-red-600">Order not found.</div>;
  }

  // Convert Firestore timestamp to Date if present
  let createdAt: Date | null = null;
  try {
    // @ts-ignore - createdAt is a Firestore Timestamp in our data model
    createdAt = order.createdAt?.toDate ? order.createdAt.toDate() : (order.createdAt ? new Date(order.createdAt) : null);
  } catch {}

  const printableOrder = { ...order, createdAt } as any;

  return (
    <div className="p-2">
      <ReceiptPrint order={printableOrder} tableNumber={table?.tableNumber} />
      <div className="no-print text-center mt-4">
        <button
          onClick={() => window.print()}
          className="px-3 py-1 text-sm border rounded-md"
        >
          Print
        </button>
      </div>
    </div>
  );
}
