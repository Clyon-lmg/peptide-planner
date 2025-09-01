// components/AddToCartButton.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { useFormState, useFormStatus } from "react-dom";

type AddState = { ok: boolean; message?: string };

// We accept the server action as a prop from a Server Component.
// Next 14 supports passing server actions to client components.
export function AddToCartButton({
  action,
  vendorId,
  peptideId,
  kind = "vial",
  defaultQty = 1,
  preferCouponId,
  className,
}: {
  action: (prev: AddState, formData: FormData) => Promise<AddState>;
  vendorId: number;
  peptideId: number;
  kind?: "vial" | "capsule" | "custom";
  defaultQty?: number;
  preferCouponId?: number | null;
  className?: string;
}) {
  const initialState: AddState = { ok: false };
  const [state, formAction] = useFormState(action, initialState);
  const [qty, setQty] = React.useState<number>(defaultQty);
  const { pending } = useFormStatus();

  React.useEffect(() => {
    if (state.ok) toast.success("Added to cart");
    else if (state.message) toast.error(state.message);
  }, [state.ok, state.message]);

  return (
    <form action={formAction} className={`flex items-center gap-2 ${className ?? ""}`}>
      <input type="hidden" name="vendor_id" value={vendorId} />
      <input type="hidden" name="peptide_id" value={peptideId} />
      <input type="hidden" name="kind" value={kind} />
      {preferCouponId ? (
        <input type="hidden" name="prefer_coupon_id" value={preferCouponId} />
      ) : null}

      <input
        name="qty"
        type="number"
        min={1}
        value={qty}
        onChange={(e) => setQty(Number(e.target.value))}
              className="w-20 rounded-lg border px-2 py-1 text-foreground"
        aria-label="Quantity"
      />

      <button type="submit" disabled={pending} className="rounded-xl border px-3 py-2">
        {pending ? "Adding…" : "Add to cart"}
      </button>
    </form>
  );
}
