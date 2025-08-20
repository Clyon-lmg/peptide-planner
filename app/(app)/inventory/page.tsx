// app/(app)/inventory/page.tsx
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";

import AddRow from "./ui/AddRow";
import InventoryList from "./ui/InventoryList";
import AddOfferButton from "./AddOfferButton";

import {
  getVialInventory,
  getCapsInventory,
  getOffersForVials,
  getOffersForCaps,
  updateVialItemAction,
  updateCapsuleItemAction,
  deleteVialItemAction,
  deleteCapsuleItemAction,
  addOfferToCartAction,
  type VialRow,
  type CapsRow,
  type OfferVial,
  type OfferCaps,
} from "./actions";

export const dynamic = "force-dynamic";

async function getUser() {
  const supabase = createServerComponentClient({ cookies });
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data?.user ?? null };
}

export default async function InventoryPage() {
  const { user } = await getUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-xl border p-6">
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="mt-2 text-sm">
            You’re not signed in.{" "}
            <Link href="/sign-in" className="underline">
              Sign in
            </Link>{" "}
            to manage inventory.
          </p>
        </div>
      </div>
    );
  }

  // Load inventory rows
  const [vialRows, capsRows] = await Promise.all([getVialInventory(), getCapsInventory()]);

  // Preload top 3 offers per peptide (vials & capsules)
  const vialOfferMap = await getOffersForVials(vialRows.map((r: VialRow) => r.peptide_id));
  const capsOfferMap = await getOffersForCaps(capsRows.map((r: CapsRow) => r.peptide_id));

  // ---- Inline server action wrappers (must return Promise<void>) ----
  const saveVial = async (p: { id: number; vials: number; mg_per_vial: number; bac_ml: number }) => {
    "use server";
    const fd = new FormData();
    fd.set("id", String(p.id));
    fd.set("vials", String(p.vials));
    fd.set("mg_per_vial", String(p.mg_per_vial));
    fd.set("bac_ml", String(p.bac_ml));
    await updateVialItemAction(fd);
  };

  const saveCapsule = async (p: {
    id: number;
    bottles: number;
    caps_per_bottle: number;
    mg_per_cap: number;
  }) => {
    "use server";
    const fd = new FormData();
    fd.set("id", String(p.id));
    fd.set("bottles", String(p.bottles));
    fd.set("caps_per_bottle", String(p.caps_per_bottle));
    fd.set("mg_per_cap", String(p.mg_per_cap));
    await updateCapsuleItemAction(fd);
  };

  const deleteVial = async (id: number) => {
    "use server";
    const fd = new FormData();
    fd.set("id", String(id));
    await deleteVialItemAction(fd);
  };

  const deleteCapsule = async (id: number) => {
    "use server";
    const fd = new FormData();
    fd.set("id", String(id));
    await deleteCapsuleItemAction(fd);
  };
  // -------------------------------------------------------------------

  // Prepare data for the InventoryList props
  const vialItems = vialRows.map((r) => ({
    id: r.id,
    peptide_id: r.peptide_id,
    canonical_name: r.name,
    vials: r.vials,
    mg_per_vial: r.mg_per_vial,
    bac_ml: r.bac_ml,
  }));

  const capItems = capsRows.map((r) => ({
    id: r.id,
    peptide_id: r.peptide_id,
    canonical_name: r.name,
    bottles: r.bottles,
    caps_per_bottle: r.caps_per_bottle,
    mg_per_cap: r.mg_per_cap,
  }));

  // Render helpers for 3‑across offers inside each card
  const renderVialOffers = (peptideId: number) => {
    const offers = (vialOfferMap.get(peptideId) ?? []) as OfferVial[];
    if (!offers.length) return null;
    return offers.map((o) => (
      <div key={o.id} className="rounded-md border p-2 text-xs space-y-1">
        <div className="font-semibold truncate">{o.vendor_name}</div>
        <div>Price: ${o.price.toFixed(2)}</div>
        <div>mL per vial: {o.bac_ml ?? "—"}</div>
        <AddOfferButton
          action={addOfferToCartAction}
          payload={{
            vendor_id: o.vendor_id,
            peptide_id: peptideId,
            kind: "vial",
            quantity: 1,
          }}
          label="Add"
          className="w-full rounded px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white"
        />
      </div>
    ));
  };

  const renderCapsuleOffers = (peptideId: number) => {
    const offers = (capsOfferMap.get(peptideId) ?? []) as OfferCaps[];
    if (!offers.length) return null;
    return offers.map((o) => (
      <div key={o.id} className="rounded-md border p-2 text-xs space-y-1">
        <div className="font-semibold truncate">{o.vendor_name}</div>
        <div>Price: ${o.price.toFixed(2)}</div>
        <div>mg / cap: {o.mg_per_cap ?? "—"}</div>
        <div>caps / bottle: {o.caps_per_bottle ?? "—"}</div>
        <AddOfferButton
          action={addOfferToCartAction}
          payload={{
            vendor_id: o.vendor_id,
            peptide_id: peptideId,
            kind: "capsule",
            quantity: 1,
          }}
          label="Add"
          className="w-full rounded px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white"
        />
      </div>
    ));
  };

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <Link href="/cart" className="text-sm underline">
          Go to Cart
        </Link>
      </header>

      {/* Adders row (server component) */}
      <AddRow />

      {/* Inventory cards (client component) */}
      <InventoryList
        vials={vialItems}
        capsules={capItems}
        onSaveVial={saveVial}
        onSaveCapsule={saveCapsule}
        onDeleteVial={deleteVial}
        onDeleteCapsule={deleteCapsule}
        renderVialOffers={renderVialOffers}
        renderCapsuleOffers={renderCapsuleOffers}
      />
    </div>
  );
}
