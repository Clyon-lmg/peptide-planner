"use client";

import * as React from "react";
import { useTransition, useMemo } from "react";
import { useFormState } from "react-dom";
import { toast } from "sonner";
import {
  addPeptideByIdAction,
  addCapsuleByIdAction,
  addCustomByNameAction,
  updateInventoryItemAction,
  updateInventoryCapsuleAction,
  addToCartAction,
} from "./actions";

type Peptide = { id: number; canonical_name: string };
type VialItem = {
  id: number;
  peptide_id: number;
  vials: number;
  mg_per_vial: number;
  bac_ml: number;
  created_at: string;
  updated_at: string;
};
type CapItem = {
  id: number;
  peptide_id: number;
  bottles: number;
  caps_per_bottle: number;
  mg_per_cap: number;
  created_at: string;
  updated_at: string;
};
type Offer = {
  id: number;
  vendor_id: number;
  peptide_id: number;
  price: number;
  mg_per_vial: number | null;
  bac_ml: number | null;
  kind: "vial" | "capsule" | null;
  caps_per_bottle: number | null;
  mg_per_cap: number | null;
};

type Props = {
  userId: string;
  peptides: Peptide[];
  vialItems: VialItem[];
  capItems: CapItem[];
  offers: Offer[];
};

type ActionState = { ok: boolean; message?: string };

export default function InventoryClient({
  userId,
  peptides,
  vialItems,
  capItems,
  offers,
}: Props) {
  const [isPending, startTransition] = useTransition();

  // ---- Add Peptide (dropdown of known peptides) ----
  const [peptideAddState, addPeptideFormAction] = useFormState<ActionState, FormData>(
    async (_prev, fd) => addPeptideByIdAction(fd), 
    { ok: false }
  );

  // ---- Add Capsule (dropdown of known peptides) ----
  const [capsuleAddState, addCapsuleFormAction] = useFormState<ActionState, FormData>(
    async (_prev, fd) => addCapsuleByIdAction(fd), 
    { ok: false }
  );

  // ---- Add Custom (radio for peptide/capsule + free text name) ----
  const [customAddState, addCustomFormAction] = useFormState<ActionState, FormData>(
    async (_prev, fd) => addCustomByNameAction(fd), 
    { ok: false }
  );

  React.useEffect(() => {
    if (peptideAddState.ok) toast.success("Peptide added to inventory");
    if (!peptideAddState.ok && peptideAddState.message) toast.error(peptideAddState.message);

    if (capsuleAddState.ok) toast.success("Capsule added to inventory");
    if (!capsuleAddState.ok && capsuleAddState.message) toast.error(capsuleAddState.message);

    if (customAddState.ok) toast.success("Custom item added to inventory");
    if (!customAddState.ok && customAddState.message) toast.error(customAddState.message);
  }, [peptideAddState, capsuleAddState, customAddState]);

  // Offer layout helper: three across
  const offersByPeptide = useMemo(() => {
    const map: Record<number, Offer[]> = {};
    for (const o of offers) {
      if (!map[o.peptide_id]) map[o.peptide_id] = [];
      map[o.peptide_id].push(o);
    }
    return map;
  }, [offers]);

  const nameById = useMemo(() => {
    const m = new Map<number, string>();
    peptides.forEach(p => m.set(p.id, p.canonical_name));
    return (id: number) => m.get(id) || `#${id}`;
  }, [peptides]);

  return (
    <div className="container mx-auto px-4 py-6 space-y-8">
      {/* Add cards row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Add Peptide */}
        <form action={addPeptideFormAction} className="rounded-2xl border p-4 space-y-3">
          <h3 className="font-semibold">Add Peptide</h3>
          <input type="hidden" name="kind" value="peptide" />
          <label className="text-sm block">
            Select peptide
            <select name="peptide_id" className="mt-1 w-full rounded border p-2" required>
              <option value="">— choose —</option>
              {peptides.map(p => (
                <option key={p.id} value={p.id}>{p.canonical_name}</option>
              ))}
            </select>
          </label>
          <button
            className="w-full rounded bg-black text-white py-2 disabled:opacity-50"
            disabled={isPending}
          >
            Add
          </button>
        </form>

        {/* Add Capsule */}
        <form action={addCapsuleFormAction} className="rounded-2xl border p-4 space-y-3">
          <h3 className="font-semibold">Add Capsule</h3>
          <input type="hidden" name="kind" value="capsule" />
          <label className="text-sm block">
            Select product
            <select name="peptide_id" className="mt-1 w-full rounded border p-2" required>
              <option value="">— choose —</option>
              {peptides.map(p => (
                <option key={p.id} value={p.id}>{p.canonical_name}</option>
              ))}
            </select>
          </label>
          <button
            className="w-full rounded bg-black text-white py-2 disabled:opacity-50"
            disabled={isPending}
          >
            Add
          </button>
        </form>

        {/* Add Custom (radio peptide/capsule + name) */}
        <form action={addCustomFormAction} className="rounded-2xl border p-4 space-y-3">
          <h3 className="font-semibold">Add Custom</h3>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="custom_kind" value="peptide" defaultChecked /> Peptide
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="custom_kind" value="capsule" /> Capsule
            </label>
          </div>
          <label className="text-sm block">
            Name
            <input name="custom_name" className="mt-1 w-full rounded border p-2" required />
          </label>
          <button
            className="w-full rounded bg-black text-white py-2 disabled:opacity-50"
            disabled={isPending}
          >
            Add
          </button>
        </form>
      </div>

      {/* Existing Peptide (vial) inventory cards – editable fields */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Peptides (vials)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {vialItems.map((it) => (
            <EditVialCard
              key={it.id}
              item={it}
              peptideName={nameById(it.peptide_id)}
            />
          ))}
        </div>
      </section>

      {/* Existing Capsule inventory cards – editable fields */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Capsules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {capItems.map((it) => (
            <EditCapsuleCard
              key={it.id}
              item={it}
              peptideName={nameById(it.peptide_id)}
            />
          ))}
        </div>
      </section>

      {/* Offers row: three across per row; offer cards show ONLY price + mg per vial (no BAC on offers) */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Vendor Offers</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(offersByPeptide).map(([pid, list]) =>
            list.slice(0, 3).map((o) => (
              <OfferCard
                key={o.id}
                offer={o}
                peptideName={nameById(Number(pid))}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

/** ------- Subcomponents -------- */

function EditVialCard({
  item,
  peptideName,
}: {
  item: VialItem;
  peptideName: string;
}) {
  const [state, formAction] = useFormState<ActionState, FormData>(
    async (_p, fd) => updateInventoryItemAction(fd),
    { ok: false }
  );

  React.useEffect(() => {
    if (state.ok) {
      toast.success("Inventory saved");
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form action={formAction} className="rounded-2xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{peptideName}</h3>
        <span className="text-xs text-muted-foreground">ID #{item.id}</span>
      </div>
      <input type="hidden" name="id" value={item.id} />
      <div className="grid grid-cols-3 gap-3 text-sm">
        <label className="block">
          Vials
          <input
            name="vials"
            type="number"
            defaultValue={item.vials}
            className="mt-1 w-full rounded border p-2"
            min={0}
          />
        </label>
        <label className="block">
          mg / vial
          <input
            name="mg_per_vial"
            type="number"
            step="0.01"
            defaultValue={item.mg_per_vial}
            className="mt-1 w-full rounded border p-2"
            min={0}
          />
        </label>
        <label className="block">
          BAC (ml)
          <input
            name="bac_ml"
            type="number"
            step="0.01"
            defaultValue={item.bac_ml}
            className="mt-1 w-full rounded border p-2"
            min={0}
          />
        </label>
      </div>
      <button className="w-full rounded bg-black text-white py-2">
        Save
      </button>
    </form>
  );
}

function EditCapsuleCard({
  item,
  peptideName,
}: {
  item: CapItem;
  peptideName: string;
}) {
  const [state, formAction] = useFormState<ActionState, FormData>(
    async (_p, fd) => updateInventoryCapsuleAction(fd),
    { ok: false }
  );

  React.useEffect(() => {
    if (state.ok) toast.success("Capsule inventory saved");
    else if (state.message) toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} className="rounded-2xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{peptideName}</h3>
        <span className="text-xs text-muted-foreground">ID #{item.id}</span>
      </div>
      <input type="hidden" name="id" value={item.id} />
      <div className="grid grid-cols-3 gap-3 text-sm">
        <label className="block">
          Bottles
          <input
            name="bottles"
            type="number"
            defaultValue={item.bottles}
            className="mt-1 w-full rounded border p-2"
            min={0}
          />
        </label>
        <label className="block">
          Caps / bottle
          <input
            name="caps_per_bottle"
            type="number"
            defaultValue={item.caps_per_bottle}
            className="mt-1 w-full rounded border p-2"
            min={0}
          />
        </label>
        <label className="block">
          mg / cap
          <input
            name="mg_per_cap"
            type="number"
            step="0.01"
            defaultValue={item.mg_per_cap}
            className="mt-1 w-full rounded border p-2"
            min={0}
          />
        </label>
      </div>
      <button className="w-full rounded bg-black text-white py-2">
        Save
      </button>
    </form>
  );
}

function OfferCard({
  offer,
  peptideName,
}: {
  offer: Offer;
  peptideName: string;
}) {
  const [isPending, startTransition] = React.useTransition();

  const add = React.useCallback(() => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("peptide_id", String(offer.peptide_id));
      fd.set("vendor_id", String(offer.vendor_id));
      // For offers, only price & mg-per-vial are shown; quantity defaults to 1
      fd.set("quantity_vials", "1");
      const res = await addToCartAction(fd);
      if (res.ok) toast.success("Added to cart");
      else toast.error(res.message || "Could not add to cart");
    });
  }, [offer]);

  return (
    <div className="rounded-2xl border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">{peptideName}</h4>
        <span className="text-xs text-muted-foreground">
          Vendor #{offer.vendor_id}
        </span>
      </div>
      <div className="text-sm grid grid-cols-2 gap-2">
        <div>
          <div className="text-muted-foreground">Price</div>
          <div className="font-medium">${offer.price?.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">
            {offer.kind === "capsule" ? "mg / cap" : "mg / vial"}
          </div>
          <div className="font-medium">
            {offer.kind === "capsule"
              ? offer.mg_per_cap ?? "—"
              : offer.mg_per_vial ?? "—"}
          </div>
        </div>
      </div>
      <button
        onClick={add}
        disabled={isPending}
        className="w-full rounded bg-black text-white py-2 disabled:opacity-50"
      >
        {isPending ? "Adding…" : "Add to cart"}
      </button>
    </div>
  );
}
