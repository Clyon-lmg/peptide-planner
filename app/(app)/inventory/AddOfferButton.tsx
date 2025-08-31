"use client";

import * as React from "react";
import { toast } from "sonner";

/**
 * Generic "Add" button that calls a server action and shows a toast.
 * Pass any primitive props in `payload` (they become FormData entries).
 */
export default function AddOfferButton({
  action,
  payload,
  label = "Add",
    className = "rounded px-3 py-1 text-xs bg-success hover:bg-success/90 text-white",
}: {
  action: (formData: FormData) => Promise<{ ok: boolean; message?: string } | any>;
  payload: Record<string, string | number | boolean | null | undefined>;
  label?: string;
  className?: string;
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
          Object.entries(payload).forEach(([k, v]) => {
            if (v !== undefined && v !== null) fd.set(k, String(v));
          });
          try {
            const res = await action(fd);
            if (!res || res.ok === false) {
              toast.error(res?.message || "Could not add to cart");
            } else {
              toast.success("Added to cart");
            }
          } catch (e: any) {
            toast.error(e?.message || "Could not add to cart");
          }
        });
      }}
      aria-busy={pending}
    >
      {pending ? "Adding…" : label}
    </button>
  );
}
