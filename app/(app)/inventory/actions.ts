"use server";
// Updated: 2024-Inventory-Fix-v2

import { revalidatePath } from "next/cache";
import { createServerActionSupabase } from "@/lib/supabaseServer";

type ActionResult = { ok: boolean; message?: string; item?: any };

async function getAuthed() {
  const supabase = createServerActionSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Not authenticated");
  return { supabase, userId: data.user.id as string };
}

/* -------------------------------------------
   Shared: Find or Create Peptide + Inventory Slot
-------------------------------------------- */
export async function ensurePeptideAndInventory(
  name: string, 
  kind: 'peptide' | 'capsule'
): Promise<{ peptideId: number, inventoryId: number }> {
  const { supabase, userId } = await getAuthed();
  const normalized_key = name.toLowerCase().replace(/[^a-z0-9]+/g, "");

  // 1. Find or Create Peptide in global dictionary
  const { data: pep, error: pepErr } = await supabase
    .from("peptides")
    .upsert(
      { canonical_name: name, normalized_key, aliases: [] },
      { onConflict: "normalized_key" }
    )
    .select("id")
    .single();

  if (pepErr) throw new Error(`Peptide error: ${pepErr.message}`);
  const peptideId = pep.id;

  // 2. Ensure it exists in the user's inventory
  const table = kind === 'capsule' ? 'inventory_capsules' : 'inventory_items';
  
  const { data: existing } = await supabase
    .from(table)
    .select('id')
    .eq('user_id', userId)
    .eq('peptide_id', peptideId)
    .maybeSingle();

  if (existing) return { peptideId, inventoryId: existing.id };

  // Create empty inventory slot
  const { data: newInv, error: invErr } = await supabase
    .from(table)
    .insert({
        user_id: userId,
        peptide_id: peptideId,
        // Defaults
        vials: 0, mg_per_vial: 0, bac_ml: 0, half_life_hours: 0,
        bottles: 0, caps_per_bottle: 0, mg_per_cap: 0,
    })
    .select('id')
    .single();
    
   if (invErr) throw new Error(`Inventory error: ${invErr.message}`);
   return { peptideId, inventoryId: newInv.id };
}

/* -------------------------------------------
   Known lists
-------------------------------------------- */

export type KnownItem = { id: number; canonical_name: string };

export async function getKnownListsFiltered(): Promise<{
  peptidesForVials: KnownItem[];
  peptidesForCapsules: KnownItem[];
}> {
  const supabase = createServerActionSupabase();

  const { data: vialProd } = await supabase.from("vendor_products").select("peptide_id").eq("kind", "vial").limit(1000);
  const vialIds = Array.from(new Set((vialProd ?? []).map((r) => r.peptide_id)));
  const { data: vialPeps } = await supabase.from("peptides").select("id, canonical_name").in("id", vialIds.length ? vialIds : [0]);

  const { data: capProd } = await supabase.from("vendor_products").select("peptide_id").eq("kind", "capsule").limit(1000);
  const capIds = Array.from(new Set((capProd ?? []).map((r) => r.peptide_id)));
  const { data: capPeps } = await supabase.from("peptides").select("id, canonical_name").in("id", capIds.length ? capIds : [0]);

  const peptidesForVials = (vialPeps ?? []).sort((a, b) => a.canonical_name.localeCompare(b.canonical_name));
  const peptidesForCapsules = (capPeps ?? []).sort((a, b) => a.canonical_name.localeCompare(b.canonical_name));

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
  current_used_mg: number;
  name: string;
};

export type CapsRow = {
  id: number;
  peptide_id: number;
  bottles: number;
  caps_per_bottle: number;
  mg_per_cap: number;
  half_life_hours: number;
  current_used_mg: number;
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
  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, peptide_id, vials, mg_per_vial, bac_ml, half_life_hours, current_used_mg, peptides(canonical_name)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

   if (error) throw error;

    return (data?.map((r: any) => ({
      id: r.id,
      peptide_id: r.peptide_id,
      vials: Number(r.vials ?? 0),
      mg_per_vial: Number(r.mg_per_vial ?? 0),
      bac_ml: Number(r.bac_ml ?? 0),
      half_life_hours: Number(r.half_life_hours ?? 0),
      current_used_mg: Number(r.current_used_mg || 0),
      name: r.peptides?.canonical_name ?? "Peptide",
    })) ?? []);
}

export async function getCapsInventory(): Promise<CapsRow[]> {
  const { supabase, userId } = await getAuthed();
  const { data, error } = await supabase
    .from("inventory_capsules")
    .select("id, peptide_id, bottles, caps_per_bottle, mg_per_cap, half_life_hours, current_used_mg, peptides(canonical_name)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

   if (error) throw error;

  return (data?.map((r: any) => ({
      id: r.id,
      peptide_id: r.peptide_id,
      bottles: Number(r.bottles ?? 0),
      caps_per_bottle: Number(r.caps_per_bottle ?? 0),
      mg_per_cap: Number(r.mg_per_cap ?? 0),
      half_life_hours: Number(r.half_life_hours ?? 0),
      current_used_mg: Number(r.current_used_mg || 0),
      name: r.peptides?.canonical_name ?? "Capsule",
    })) ?? []);
}

/* -------------------------------------------
   Mutations
-------------------------------------------- */

export async function addCustomAction(formData: FormData): Promise<ActionResult> {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  const kind = (String(formData.get("kind") ?? "peptide") === "capsule" ? "capsule" : "peptide");
  
  if (!name) return { ok: false, message: "Enter a name" };

  try {
      await ensurePeptideAndInventory(name, kind);
      revalidatePath("/inventory");
      return { ok: true };
  } catch (e: any) {
      return { ok: false, message: e.message };
  }
}

export async function addPeptideByIdAction(formData: FormData): Promise<ActionResult> {
  "use server";
  const { supabase, userId } = await getAuthed();
  const peptideId = Number(formData.get("peptide_id"));
  if (!peptideId) return { ok: false, message: "Choose a peptide" };

  const { error } = await supabase
    .from("inventory_items")
    .upsert(
      { user_id: userId, peptide_id: peptideId, vials: 0, mg_per_vial: 0, bac_ml: 0, half_life_hours: 0 },
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
      { user_id: userId, peptide_id: peptideId, bottles: 0, caps_per_bottle: 0, mg_per_cap: 0, half_life_hours: 0 },
      { onConflict: "user_id,peptide_id" }
    );

  if (error) return { ok: false, message: error.message };
  revalidatePath("/inventory");
  return { ok: true };
}

// THIS IS THE FUNCTION THAT WAS MISSING IN YOUR BUILD
export async function importInventoryItemAction(
    name: string, 
    kind: 'peptide' | 'capsule',
    stock: number,
    conc: number,
    conc2?: number
): Promise<void> {
    "use server";
    const { supabase, userId } = await getAuthed();
    
    // 1. Ensure basics exist
    const { inventoryId } = await ensurePeptideAndInventory(name, kind);
    
    // 2. Update stock values
    const table = kind === 'capsule' ? 'inventory_capsules' : 'inventory_items';
    const update: any = { updated_at: new Date().toISOString() };
    
    if (kind === 'peptide') {
        if (stock > 0) update.vials = stock;
        if (conc > 0) update.mg_per_vial = conc;
        if (conc2 && conc2 > 0) update.bac_ml = conc2;
    } else {
        if (stock > 0) update.bottles = stock;
        if (conc > 0) update.caps_per_bottle = conc;
        if (conc2 && conc2 > 0) update.mg_per_cap = conc2;
    }

    await supabase.from(table).update(update).eq('id', inventoryId).eq('user_id', userId);
    revalidatePath("/inventory");
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
  
  await supabase.from("inventory_items").update({ vials, mg_per_vial, bac_ml, half_life_hours, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId);
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

  await supabase.from("inventory_capsules").update({ bottles, caps_per_bottle, mg_per_cap, half_life_hours, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId);
  revalidatePath("/inventory");
  return { ok: true };
}

export async function deleteVialItemAction(formData: FormData): Promise<ActionResult> {
  "use server";
  const { supabase, userId } = await getAuthed();
  const id = Number(formData.get("id"));
  if (!id) return { ok: false, message: "Missing id" };
  await supabase.from("inventory_items").delete().eq("id", id).eq("user_id", userId);
  revalidatePath("/inventory");
  return { ok: true };
}

export async function deleteCapsuleItemAction(formData: FormData): Promise<ActionResult> {
  "use server";
  const { supabase, userId } = await getAuthed();
  const id = Number(formData.get("id"));
  if (!id) return { ok: false, message: "Missing id" };
  await supabase.from("inventory_capsules").delete().eq("id", id).eq("user_id", userId);
  revalidatePath("/inventory");
  return { ok: true };
}