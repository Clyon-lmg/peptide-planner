// app/(app)/inventory/page.tsx
import { cookies } from "next/headers";
import { createServerComponentClient, createServerActionClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";

import AddRow from "./ui/AddRow";
import InventoryList from "./ui/InventoryList";

import {
  getVialInventory,
  getCapsInventory,
  getOffersForVials,
  getOffersForCaps,
  // keep using your existing actions for add/delete/offer
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

/**
 * Compute dose frequency /wk for a given schedule.
 */
function baseFreqPerWeek(schedule: string, customDays?: number[] | null, every_n_days?: number | null) {
  switch (schedule) {
    case "EVERYDAY":
      return 7;
    case "WEEKDAYS_5_2":
      return 5;
    case "EVERY_N_DAYS":
      return every_n_days ? 7 / every_n_days : 0;
    case "CUSTOM":
      return Array.isArray(customDays) ? customDays.length : 0;
    default:
      return 0;
  }
}

/** Apply cycles: effective freq = base * (on_weeks / (on_weeks+off_weeks)) */
function effectiveFreqPerWeek(base: number, onWeeks: number, offWeeks: number) {
  if (!onWeeks || !offWeeks) return base;
  const total = onWeeks + offWeeks;
  return total > 0 ? base * (onWeeks / total) : base;
}

/**
 * Compute remaining doses & reorder date for a peptide given inventory and active protocol item (if any).
 */
function computeForecast(
  isCapsule: boolean,
  inv: {
    vials?: number;
    mg_per_vial?: number;
    bac_ml?: number;
    bottles?: number;
    caps_per_bottle?: number;
    mg_per_cap?: number;
  },
  protoItem:
    | {
        dose_mg_per_administration: number;
        schedule: string;
        custom_days: number[] | null;
        cycle_on_weeks: number;
        cycle_off_weeks: number;
        every_n_days: number | null;
      }
    | undefined
) {
  if (!protoItem) return { remainingDoses: null, reorderDateISO: null };

  const dose = Number(protoItem.dose_mg_per_administration || 0);
  if (dose <= 0) return { remainingDoses: null, reorderDateISO: null };

  let totalMg = 0;
  if (!isCapsule) {
    totalMg = Number(inv.vials || 0) * Number(inv.mg_per_vial || 0);
  } else {
    totalMg =
      Number(inv.bottles || 0) *
      Number(inv.caps_per_bottle || 0) *
      Number(inv.mg_per_cap || 0);
  }

  const remainingDoses = Math.max(0, Math.floor(totalMg / dose));

  const base = baseFreqPerWeek(protoItem.schedule, protoItem.custom_days, protoItem.every_n_days);
  const eff = effectiveFreqPerWeek(base, protoItem.cycle_on_weeks || 0, protoItem.cycle_off_weeks || 0);
  if (eff <= 0) {
    return { remainingDoses, reorderDateISO: null };
  }

  const weeksUntilEmpty = Math.ceil(remainingDoses / eff);
  const days = weeksUntilEmpty * 7;

  const now = new Date();
  const reorderDate = new Date(now);
  reorderDate.setDate(now.getDate() + days);

  const yyyy = reorderDate.getFullYear();
  const mm = String(reorderDate.getMonth() + 1).padStart(2, "0");
  const dd = String(reorderDate.getDate()).padStart(2, "0");
  const reorderDateISO = `${yyyy}-${mm}-${dd}`;

  return { remainingDoses, reorderDateISO };
}

export default async function InventoryPage() {
  const { supabase, user } = await getUser();
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

  // Get active protocol items for only the peptides we care about
  const peptideIds = [
    ...new Set([
      ...vialRows.map((r: VialRow) => r.peptide_id),
      ...capsRows.map((r: CapsRow) => r.peptide_id),
    ]),
  ];

  let protocolItemsByPeptide = new Map<
    number,
    {
      dose_mg_per_administration: number;
      schedule: string;
      custom_days: number[] | null;
      cycle_on_weeks: number;
      cycle_off_weeks: number;
      every_n_days: number | null;
          }
  >();

  if (peptideIds.length > 0) {
    // Query active protocol + items for this user
    const { data: activeProto } = await supabase
      .from("protocols")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (activeProto?.id) {
      const { data: protoItems } = await supabase
        .from("protocol_items")
        .select("peptide_id,dose_mg_per_administration,schedule,custom_days,cycle_on_weeks,cycle_off_weeks,every_n_days")
        .eq("protocol_id", activeProto.id)
        .in("peptide_id", peptideIds);

      if (protoItems) {
        for (const pi of protoItems) {
          protocolItemsByPeptide.set(pi.peptide_id, {
            dose_mg_per_administration: Number(pi.dose_mg_per_administration || 0),
            schedule: String(pi.schedule || ""),
            custom_days: (pi.custom_days as number[] | null) ?? null,
            cycle_on_weeks: Number(pi.cycle_on_weeks || 0),
            cycle_off_weeks: Number(pi.cycle_off_weeks || 0),
            every_n_days: (pi.every_n_days as number | null) ?? null,

          });
        }
      }
    }
  }

  // Preload top 3 offers per peptide (vials & capsules)
  const vialOfferMap = await getOffersForVials(vialRows.map((r: VialRow) => r.peptide_id));
  const capsOfferMap = await getOffersForCaps(capsRows.map((r: CapsRow) => r.peptide_id));

  // ---------- Partial update server actions (no overwriting!) ----------
  const saveVial = async (p: { id: number; vials?: number; mg_per_vial?: number; bac_ml?: number }) => {
    "use server";
    const sa = createServerActionClient({ cookies });
    const { data: auth } = await sa.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) throw new Error("Not signed in");

    const update: Record<string, number> = {};
    if (p.vials !== undefined) update.vials = Number(p.vials);
    if (p.mg_per_vial !== undefined) update.mg_per_vial = Number(p.mg_per_vial);
    if (p.bac_ml !== undefined) update.bac_ml = Number(p.bac_ml);

    if (Object.keys(update).length === 0) return;

    const { error } = await sa
      .from("inventory_items")
      .update(update)
      .eq("id", p.id)
      .eq("user_id", uid);

    if (error) throw error;
  };

  const saveCapsule = async (p: { id: number; bottles?: number; caps_per_bottle?: number; mg_per_cap?: number }) => {
    "use server";
    const sa = createServerActionClient({ cookies });
    const { data: auth } = await sa.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) throw new Error("Not signed in");

    const update: Record<string, number> = {};
    if (p.bottles !== undefined) update.bottles = Number(p.bottles);
    if (p.caps_per_bottle !== undefined) update.caps_per_bottle = Number(p.caps_per_bottle);
    if (p.mg_per_cap !== undefined) update.mg_per_cap = Number(p.mg_per_cap);

    if (Object.keys(update).length === 0) return;

    const { error } = await sa
      .from("inventory_capsules")
      .update(update)
      .eq("id", p.id)
      .eq("user_id", uid);

    if (error) throw error;
  };

  const deleteVial = async (id: number) => {
    "use server";
    // keep using your existing action
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
  // --------------------------------------------------------------------

  // Prepare serializable data for the client component, include forecasts
  const vialItems = vialRows
    .map((r) => {
      const proto = protocolItemsByPeptide.get(r.peptide_id);
      const { remainingDoses, reorderDateISO } = computeForecast(
        false,
        { vials: r.vials, mg_per_vial: r.mg_per_vial, bac_ml: r.bac_ml },
        proto
      );
      return {
        id: r.id,
        peptide_id: r.peptide_id,
        canonical_name: r.name,
        vials: r.vials,
        mg_per_vial: r.mg_per_vial,
        bac_ml: r.bac_ml,
        remainingDoses,
        reorderDateISO,
      };
    })
    .sort((a, b) => a.canonical_name.localeCompare(b.canonical_name));

  const capItems = capsRows
    .map((r) => {
      const proto = protocolItemsByPeptide.get(r.peptide_id);
      const { remainingDoses, reorderDateISO } = computeForecast(
        true,
        { bottles: r.bottles, caps_per_bottle: r.caps_per_bottle, mg_per_cap: r.mg_per_cap },
        proto
      );
      return {
        id: r.id,
        peptide_id: r.peptide_id,
        canonical_name: r.name,
        bottles: r.bottles,
        caps_per_bottle: r.caps_per_bottle,
        mg_per_cap: r.mg_per_cap,
        remainingDoses,
        reorderDateISO,
      };
    })
    .sort((a, b) => a.canonical_name.localeCompare(b.canonical_name));

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
        addOfferToCart={addOfferToCartAction}
      />
    </div>
  );
}
