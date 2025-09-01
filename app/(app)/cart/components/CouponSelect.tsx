// app/(app)/cart/components/CouponSelect.tsx
"use client";

import { useState, useTransition } from "react";
import { chooseVendorCoupon } from "../server";

type Opt = {
  id: number;
  code: string;
  percent_off: number | null;
  amount_off: number | null;
  expires_at: string | null;
};

export default function CouponSelect({
  vendorId,
  coupons,
  selectedId,
}: {
  vendorId: number;
  coupons: Opt[];
  selectedId: number | null;
}) {
  const [value, setValue] = useState<number | "">(selectedId ?? "");
  const [isPending, startTransition] = useTransition();

  const onChange = (v: string) => {
    const next = v === "" ? null : Number(v);
    setValue(v === "" ? "" : Number(v));
    startTransition(async () => {
      try {
        await chooseVendorCoupon(vendorId, next);
      } catch (e) {
        alert((e as any)?.message || "Failed to set coupon");
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
          <label className="text-sm text-muted">Coupon</label>
      <select
        value={value === "" ? "" : String(value)}
        onChange={(e) => onChange(e.target.value)}
        disabled={isPending}
        className="
          text-sm rounded-lg border text-foreground
          border-border bg-background
          px-2 py-1
          focus:outline-none focus:ring-2 focus:ring-primary/30
        "
      >
        <option value="">None</option>
        {coupons.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code}
            {c.percent_off ? ` (${c.percent_off}% off)` : ""}
            {c.amount_off ? ` ($${Number(c.amount_off).toFixed(2)} off)` : ""}
            {c.expires_at ? " — exp" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
