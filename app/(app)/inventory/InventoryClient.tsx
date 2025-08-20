// app/(app)/inventory/InventoryClient.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";

/**
 * Generic client action button to call a server action with a FormData payload.
 * Shows success/error toasts automatically.
 *
 * Usage:
 *   <InventoryActionButton
 *     action={addPeptideByIdAction}        // a server action imported where you use the button
 *     payload={{ peptide_id: 123 }}
 *     label="Add"
 *     className="rounded px-3 py-2 bg-green-600 hover:bg-green-700 text-white"
 *   />
 *
 * NOTE: This file intentionally does NOT import any actions.
 * Import your server action in the component/page where you render this button
 * and pass it in via the `action` prop to avoid type/import drift.
 */
export function InventoryActionButton({
  action,
  payload,
  label = "Save",
  className = "rounded px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white",
  successMessage = "Done",
  errorMessage = "Action failed",
}: {
  action: (formData: FormData) => Promise<any>;
  payload: Record<string, string | number | boolean | null | undefined>;
  label?: string;
  className?: string;
  successMessage?: string;
  errorMessage?: string;
}) {
  const [pending, startTransition] = React.useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() => {
        startTransition(async () => {
          const fd = new FormData();
          for (const [k, v] of Object.entries(payload)) {
            if (v !== undefined && v !== null) fd.set(k, String(v));
          }
          try {
            const res = await action(fd);
            if (res?.ok === false) {
              toast.error(res?.message || errorMessage);
            } else {
              toast.success(successMessage);
            }
          } catch (e: any) {
            toast.error(e?.message || errorMessage);
          }
        });
      }}
      aria-busy={pending}
    >
      {pending ? "Working…" : label}
    </button>
  );
}

/**
 * Optional specialized variant for "Add to cart" actions.
 * Same mechanics, just a different default label/styling.
 */
export function AddToCartButton(props: Omit<React.ComponentProps<typeof InventoryActionButton>, "label" | "className" | "successMessage" | "errorMessage">) {
  return (
    <InventoryActionButton
      label="Add"
      className="w-full rounded px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white"
      successMessage="Added to cart"
      errorMessage="Could not add to cart"
      {...props}
    />
  );
}

/**
 * Harmless default export in case something imports this file as a component.
 */
export default function InventoryClient() {
  return null;
}
