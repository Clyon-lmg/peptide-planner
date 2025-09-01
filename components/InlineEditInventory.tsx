"use client";

import * as React from "react";
import { useFormState } from "react-dom";

type ActionState = { ok: boolean; message?: string };

export function InlineEditInventory({
  itemId,
  vials,
  mg_per_vial,
  bac_ml,
  action,
  className,
}: {
  itemId: number;
  vials: number;
  mg_per_vial: number;
  bac_ml: number;
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  className?: string;
}) {
  const [state, formAction] = useFormState(action, { ok: false } as ActionState);

  return (
      <form action={formAction} className={`grid grid-cols-1 sm:grid-cols-3 gap-2 ${className ?? ""}`}>
      <input type="hidden" name="id" value={itemId} />

      <label className="text-sm">
        Vials
        <input
          name="vials"
          type="number"
          min={0}
          defaultValue={vials}
                  className="mt-1 w-full rounded-lg border px-2 py-1 text-foreground"
        />
      </label>

      <label className="text-sm">
        mg per vial
        <input
          name="mg_per_vial"
          type="number"
          step="0.01"
          min={0}
          defaultValue={mg_per_vial}
                  className="mt-1 w-full rounded-lg border px-2 py-1 text-foreground"
        />
      </label>

      <label className="text-sm">
        BAC (mL)
        <input
          name="bac_ml"
          type="number"
          step="0.01"
          min={0}
          defaultValue={bac_ml}
                  className="mt-1 w-full rounded-lg border px-2 py-1 text-foreground"
        />
      </label>

      <div className="col-span-3">
        <button className="rounded-xl border px-3 py-2">Save</button>
              {state.message && <span className="ml-2 text-sm text-destructive">{state.message}</span>}
              {state.ok && <span className="ml-2 text-sm text-success">Saved.</span>}
          </div>
    </form>
  );
}
