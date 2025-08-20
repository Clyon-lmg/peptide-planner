// app/(app)/inventory/page.tsx
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";

import AddRow from "./ui/AddRow";
import InventoryList from "./ui/InventoryList";

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

  // Prepare serializable data for the client component
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

  // Flatten Maps into plain objects (Record<number, Offer[]>)
  const offerVials: Record<number, OfferVial[]> = {};
  vialRows.forEach((r) => {
    offerVials[r.peptide_id] = (vialOfferMap.get(r.peptide_id) ?? []) as OfferVial[];
  });

  const offerCaps: Record<number, OfferCaps[]> = {};
  capsRows.forEach((r) => {
    offerCaps[r.peptide_id] = (capsOfferMap.get(r.peptide_id) ?? []) as OfferCaps[];
  });

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
        offersVials={offerVials}
        offersCapsules={offerCaps}
        onSaveVial={saveVial}
        onSaveCapsule={saveCapsule}
        onDeleteVial={deleteVial}
        onDeleteCapsule={deleteCapsule}
        addOfferToCart={addOfferToCartAction} // passing a server action is allowed
      />
    </div>
  );
}
