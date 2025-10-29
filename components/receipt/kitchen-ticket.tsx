"use client";

import * as React from "react";

export function KitchenTicket({
  restaurantName = "My Restaurant",
  order,
  tableNumber,
}: {
  restaurantName?: string;
  order: {
    id: string;
    createdAt?: Date | null;
    items: Array<{ name: string; quantity: number; size?: string; addOns?: string[] }>;
    type?: string;
  };
  tableNumber?: number | string;
}) {
  return (
    <div className="w-[80mm] mx-auto text-sm text-black">
      <style>{`
        @page { size: 80mm auto; margin: 0; }
        @media print {
          html, body { width: 80mm; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="text-center py-2">
        <div className="text-base font-bold">{restaurantName}</div>
        <div className="text-xs tracking-wider font-semibold mt-1">KITCHEN COPY</div>
      </div>
      <div className="border-t border-dashed my-2" />
      <div className="flex justify-between">
        <div>Date: {order.createdAt ? new Date(order.createdAt).toLocaleString() : ""}</div>
      </div>
      <div className="flex justify-between">
        <div>Type: {order.type || "-"}</div>
        {typeof tableNumber !== 'undefined' && tableNumber !== null && (
          <div>Table: {tableNumber}</div>
        )}
      </div>
      <div className="border-t border-dashed my-2" />

      <div className="space-y-3">
        {order.items.map((it, idx) => (
          <div key={idx} className="">
            <div className="flex justify-between">
              <div className="font-bold">{it.name}</div>
              <div className="font-bold">x{it.quantity}</div>
            </div>
            {(it.size || (it.addOns && it.addOns.length)) && (
              <div className="text-xs text-neutral-700">
                {it.size ? `Size: ${it.size}` : ""}
                {it.size && it.addOns?.length ? " • " : ""}
                {it.addOns?.length ? `Add-ons: ${it.addOns.join(", ")}` : ""}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-dashed my-2" />
      <div className="text-center text-[11px] py-2">Prepared promptly. No prices on kitchen copy.</div>
    </div>
  );
}
