// app/(app)/inventory/actions.ts
"use server";

import { cookies } from "next/headers";
import { createServerActionClient } from "@supabase/auth-helpers-nextjs";
import { revalidatePath } from "next/cache";

type ActionResult = { ok: boolean; message?: string };

async function getAuthed() {
  const supabase = createServerActionClient({ cookies });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Not authenticated");
  return { supabase, userId: data.user.id as string };
}

/* -------------------------------------------
   Known lists (filtered by vendor_products.kind)
-------------------------------------------- */

export type KnownItem = { id: number; canonical_name: string };

export async function getKnownListsFiltered(): Promise<{
  peptidesForVials: KnownItem[];
  peptidesForCapsules: KnownItem[];
}> {
  const supabase = createServerActionClient({ cookies });

  // peptide ids with VIAL offers
  const { data: vialProd } = await supabase
    .from("vendor_products")
    .select("peptide_id")
    .eq("kind", "vial")
    .limit(10000);

  const vialIds = Array.from(new Set((vialProd ?? []).map((r) => r.peptide_id)));

  const { data: vialPeps } = await supabase
    .from("peptides")
    .select("id, canonical_name")
    .in("id", vialIds.length ? vialIds : [0]);

  // peptide ids with CAPSULE offers
  const { data: capProd } = await supabase
    .from("vendor_products")
    .select("peptide_id")
    .eq("kind", "capsule")
    .limit(10000);

  const capIds = Array.from(new Set((capProd ?? []).map((r) => r.peptide_id)));

  const { data: capPeps } = await supabase
    .from("peptides")
    .select("id, canonical_name")
    .in("id", capIds.length ? capIds : [0]);

  const peptidesForVials = (vialPeps ?? []).sort((a, b) =>
    a.canonical_name.localeCompare(b.canonical_name),
  );
  const peptidesForCapsules = (capPeps ?? []).sort((a, b) =>
    a.canonical_name.localeCompare(b.canonical_name),
  );

  return { peptidesForVials, peptidesForCapsules };
}

/* -------------------------------------------
   Inventory queries
-------------------------------------------- */

export type VialRow = {
  id: number;
  peptide_id: number;
  vials: number;
  mg_per_vial: number;
  bac_ml: number;
  half_life_hours: number;
  name: string;
};

export type CapsRow = {
  id: number;
  peptide_id: number;
  bottles: number;
  caps_per_bottle: number;
  mg_per_cap: number;
  half_life_hours: number;
  name: string;
};

export type SaveVialPayload = {
  id: number;
  vials?: number;
  mg_per_vial?: number;
  bac_ml?: number;
  half_life_hours?: number;
};

export type SaveCapsPayload = {
  id: number;
  bottles?: number;
  caps_per_bottle?: number;
  mg_per_cap?: number;
  half_life_hours?: number;
};

export async function getVialInventory(): Promise<VialRow[]> {
  const { supabase, userId } = await getAuthed();
  const { data } = await supabase
    .from("inventory_items")
        .select(
      "id, peptide_id, vials, mg_per_vial, bac_ml, half_life_hours, peptides(canonical_name)"
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  return (
    data?.map((r: any) => ({
      id: r.id,
      peptide_id: r.peptide_id,
      vials: Number(r.vials ?? 0),
      mg_per_vial: Number(r.mg_per_vial ?? 0),
      bac_ml: Number(r.bac_ml ?? 0),
      half_life_hours: Number(r.half_life_hours ?? 0),
      name: r.peptides?.canonical_name ?? "Peptide",
    })) ?? []
  );
}

export async function getCapsInventory(): Promise<CapsRow[]> {
  const { supabase, userId } = await getAuthed();
  const { data } = await supabase
    .from("inventory_capsules")
    .select(
      "id, peptide_id, bottles, caps_per_bottle, mg_per_cap, half_life_hours, peptides(canonical_name)",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  return (
    data?.map((r: any) => ({
      id: r.id,
      peptide_id: r.peptide_id,
      bottles: Number(r.bottles ?? 0),
      caps_per_bottle: Number(r.caps_per_bottle ?? 0),
      mg_per_cap: Number(r.mg_per_cap ?? 0),
      half_life_hours: Number(r.half_life_hours ?? 0),
      name: r.peptides?.canonical_name ?? "Capsule",
    })) ?? []
  );
}

/* -------------------------------------------
   Offers (top 3 per peptide/kind)
-------------------------------------------- */

export type OfferVial = {
  id: number;
  peptide_id: number;
  vendor_id: number;
  vendor_name: string;
  price: number;
  price_currency: string | null;
  bac_ml: number | null; // shown as "mL per vial"
};

export type OfferCaps = {
  id: number;
  peptide_id: number;
  vendor_id: number;
  vendor_name: string;
  price: number;
  price_currency: string | null;
  mg_per_cap: number | null;
  caps_per_bottle: number | null;
};

export async function getOffersForVials(peptideIds: number[]) {
  const supabase = createServerActionClient({ cookies });
  if (peptideIds.length === 0) return new Map<number, OfferVial[]>();

  const { data } = await supabase
    .from("vendor_products")
    .select("id, peptide_id, vendor_id, price, price_currency, bac_ml, vendors!inner(name)")
    .in("peptide_id", peptideIds)
    .eq("kind", "vial");

  const byPeptide = new Map<number, OfferVial[]>();
  (data ?? [])
    .sort((a: any, b: any) => Number(a.price) - Number(b.price))
    .forEach((o: any) => {
      const arr = byPeptide.get(o.peptide_id) ?? [];
      arr.push({
        id: o.id,
        peptide_id: o.peptide_id,
        vendor_id: o.vendor_id,
        vendor_name: o.vendors?.name ?? "Vendor",
        price: Number(o.price ?? 0),
        price_currency: o.price_currency ?? "USD",
        bac_ml: o.bac_ml != null ? Number(o.bac_ml) : null,
      });
      byPeptide.set(o.peptide_id, arr);
    });

  for (const k of byPeptide.keys()) {
    byPeptide.set(k, (byPeptide.get(k) ?? []).slice(0, 3));
  }
  return byPeptide;
}

export async function getOffersForCaps(peptideIds: number[]) {
  const supabase = createServerActionClient({ cookies });
  if (peptideIds.length === 0) return new Map<number, OfferCaps[]>();

  const { data } = await supabase
    .from("vendor_products")
    .select(
      "id, peptide_id, vendor_id, price, price_currency, mg_per_cap, caps_per_bottle, vendors!inner(name)",
    )
    .in("peptide_id", peptideIds)
    .eq("kind", "capsule");

  const byPeptide = new Map<number, OfferCaps[]>();
  (data ?? [])
    .sort((a: any, b: any) => Number(a.price) - Number(b.price))
    .forEach((o: any) => {
      const arr = byPeptide.get(o.peptide_id) ?? [];
      arr.push({
        id: o.id,
        peptide_id: o.peptide_id,
        vendor_id: o.vendor_id,
        vendor_name: o.vendors?.name ?? "Vendor",
        price: Number(o.price ?? 0),
        price_currency: o.price_currency ?? "USD",
        mg_per_cap: o.mg_per_cap != null ? Number(o.mg_per_cap) : null,
        caps_per_bottle:
          o.caps_per_bottle != null ? Number(o.caps_per_bottle) : null,
      });
      byPeptide.set(o.peptide_id, arr);
    });

  for (const k of byPeptide.keys()) {
    byPeptide.set(k, (byPeptide.get(k) ?? []).slice(0, 3));
  }
  return byPeptide;
}

/* -------------------------------------------
   Mutations: add/update/delete & cart
-------------------------------------------- */

export async function addPeptideByIdAction(formData: FormData): Promise<ActionResult> {
  "use server";
  const { supabase, userId } = await getAuthed();
  const peptideId = Number(formData.get("peptide_id"));
  if (!peptideId) return { ok: false, message: "Choose a peptide" };

  const { error } = await supabase
    .from("inventory_items")
    .upsert(
            {
        user_id: userId,
        peptide_id: peptideId,
        vials: 0,
        mg_per_vial: 0,
        bac_ml: 0,
        half_life_hours: 0,
      },
      { onConflict: "user_id,peptide_id" }
    );

  if (error) return { ok: false, message: error.message };
  revalidatePath("/inventory");
  return { ok: true };
}

export async function addCapsuleByIdAction(formData: FormData): Promise<ActionResult> {
  "use server";
  const { supabase, userId } = await getAuthed();
  const peptideId = Number(formData.get("peptide_id"));
  if (!peptideId) return { ok: false, message: "Choose a capsule item" };

  const { error } = await supabase
    .from("inventory_capsules")
    .upsert(
           {
        user_id: userId,
        peptide_id: peptideId,
        bottles: 0,
        caps_per_bottle: 0,
        mg_per_cap: 0,
        half_life_hours: 0,
      },
      { onConflict: "user_id,peptide_id" }
    );

  if (error) return { ok: false, message: error.message };
  revalidatePath("/inventory");
  return { ok: true };
}

/** Add Custom by name + kind (radio) */
export async function addCustomAction(formData: FormData): Promise<ActionResult> {
  "use server";
  const { supabase, userId } = await getAuthed();
  const name = String(formData.get("name") ?? "").trim();
  const kind =
    (String(formData.get("kind") ?? "peptide") === "capsule"
      ? "capsule"
      : "peptide") as "peptide" | "capsule";
  if (!name) return { ok: false, message: "Enter a name" };

  const normalized_key = name.toLowerCase().replace(/[^a-z0-9]+/g, "");

  // ensure peptide exists
  const { data: pep, error: pepErr } = await supabase
    .from("peptides")
    .upsert(
      { canonical_name: name, normalized_key, aliases: [] },
      { onConflict: "normalized_key" },
    )
    .select("id")
    .single();

  if (pepErr) return { ok: false, message: pepErr.message };

  if (kind === "peptide") {
    const { error } = await supabase.from("inventory_items").upsert(
      {
        user_id: userId,
        peptide_id: pep.id,
        vials: 0,
        mg_per_vial: 0,
        bac_ml: 0,
        half_life_hours: 0,
      },
      { onConflict: "user_id,peptide_id" },
    );
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await supabase.from("inventory_capsules").upsert(
      {
        user_id: userId,
        peptide_id: pep.id,
        bottles: 0,
        caps_per_bottle: 0,
        mg_per_cap: 0,
        half_life_hours: 0,
      },
      { onConflict: "user_id,peptide_id" },
    );
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath("/inventory");
  return { ok: true };
}

export async function updateVialItemAction(formData: FormData): Promise<ActionResult> {
  "use server";
  const { supabase, userId } = await getAuthed();
  const id = Number(formData.get("id"));
  const vials = Number(formData.get("vials") ?? 0);
  const mg_per_vial = Number(formData.get("mg_per_vial") ?? 0);
  const bac_ml = Number(formData.get("bac_ml") ?? 0);
  const half_life_hours = Number(formData.get("half_life_hours") ?? 0);
  if (!id) return { ok: false, message: "Missing id" };

  const { error } = await supabase
    .from("inventory_items")
    .update({
      vials,
      mg_per_vial,
      bac_ml,
      half_life_hours,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/inventory");
  return { ok: true };
}

export async function updateCapsuleItemAction(formData: FormData): Promise<ActionResult> {
  "use server";
  const { supabase, userId } = await getAuthed();
  const id = Number(formData.get("id"));
  const bottles = Number(formData.get("bottles") ?? 0);
  const caps_per_bottle = Number(formData.get("caps_per_bottle") ?? 0);
  const mg_per_cap = Number(formData.get("mg_per_cap") ?? 0);
  const half_life_hours = Number(formData.get("half_life_hours") ?? 0);
  if (!id) return { ok: false, message: "Missing id" };

  const { error } = await supabase
    .from("inventory_capsules")
    .update({
      bottles,
      caps_per_bottle,
      mg_per_cap,
      half_life_hours,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/inventory");
  return { ok: true };
}

export async function deleteVialItemAction(formData: FormData): Promise<ActionResult> {
  "use server";
  const { supabase, userId } = await getAuthed();
  const id = Number(formData.get("id"));
  if (!id) return { ok: false, message: "Missing id" };

  const { error } = await supabase
    .from("inventory_items")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/inventory");
  return { ok: true };
}

export async function deleteCapsuleItemAction(formData: FormData): Promise<ActionResult> {
  "use server";
  const { supabase, userId } = await getAuthed();
  const id = Number(formData.get("id"));
  if (!id) return { ok: false, message: "Missing id" };

  const { error } = await supabase
    .from("inventory_capsules")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/inventory");
  return { ok: true };
}

export async function addOfferToCartAction(formData: FormData): Promise<ActionResult> {
  "use server";
  const { supabase, userId } = await getAuthed();

  const vendor_id = Number(formData.get("vendor_id"));
  const peptide_id = Number(formData.get("peptide_id"));
  const kind = String(formData.get("kind") || "vial") as "vial" | "capsule";
  const quantity = Math.max(1, Number(formData.get("quantity") ?? 1));

  if (!vendor_id || !peptide_id) return { ok: false, message: "Missing vendor or peptide" };

  const payload: any = { user_id: userId, vendor_id, peptide_id, kind };
  if (kind === "vial") payload.quantity_vials = quantity;
  else payload.quantity_units = quantity; // bottles for capsules

  const { error } = await supabase.from("cart_items").insert(payload);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/cart");
  return { ok: true };
}
