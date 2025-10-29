"use client";

import * as React from "react";

export function ReceiptPrint({
  restaurantName = "My Restaurant",
  addressLine1 = "123 Main St",
  addressLine2 = "City, Country",
  phone = "(000) 000-0000",
  order,
  tableNumber,
}: {
  restaurantName?: string;
  addressLine1?: string;
  addressLine2?: string;
  phone?: string;
  order: {
    id: string;
    createdAt?: Date | null;
    items: Array<{ name: string; quantity: number; price: number; size?: string; addOns?: string[] }>;
    total: number;
    type?: string;
  };
  tableNumber?: number | string;
}) {
  const currency = React.useMemo(
    () => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }),
    []
  );

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
        <div>{addressLine1}</div>
        <div>{addressLine2}</div>
        <div>Phone: {phone}</div>
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

      <div className="space-y-2">
        {order.items.map((it, idx) => (
          <div key={idx}>
            <div className="flex justify-between">
              <div className="font-medium">{it.name} x{it.quantity}</div>
              <div>{currency.format(it.price * it.quantity)}</div>
            </div>
            {(it.size || (it.addOns && it.addOns.length)) && (
              <div className="text-xs text-neutral-600">
                {it.size ? `Size: ${it.size}` : ""}
                {it.size && it.addOns?.length ? " • " : ""}
                {it.addOns?.length ? `Add-ons: ${it.addOns.join(", ")}` : ""}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-dashed my-2" />
      <div className="flex justify-between text-base">
        <div className="font-semibold">Total</div>
        <div className="font-bold">{currency.format(order.total)}</div>
      </div>

      <div className="border-t border-dashed my-2" />
      <div className="text-center text-xs py-2">Thank you for dining with us!</div>
    </div>
  );
}
