"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabaseServer";

async function authed() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Not authenticated");
  return { supabase, userId: data.user.id as string };
}

export async function markPlacedAction(orderId: number) {
  const { supabase, userId } = await authed();
  if (!orderId) return { ok: false, message: "Missing order id" };

  const { data: ord, error: oErr } = await supabase
    .from("orders")
    .select("id, user_id")
    .eq("id", orderId)
    .single();
  if (oErr) return { ok: false, message: oErr.message };
  if (ord.user_id !== userId) return { ok: false, message: "Forbidden" };

  const { error } = await supabase
    .from("orders")
    .update({ status: "PLACED", placed_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("user_id", userId);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/orders");
  return { ok: true };
}

export async function addTrackingAction(orderId: number, tracking_number: string, carrier?: string) {
  const { supabase, userId } = await authed();
  if (!orderId || !tracking_number) return { ok: false, message: "Missing order id or tracking number" };

  const { data: ord, error: oErr } = await supabase
    .from("orders")
    .select("id, user_id")
    .eq("id", orderId)
    .single();
  if (oErr) return { ok: false, message: oErr.message };
  if (ord.user_id !== userId) return { ok: false, message: "Forbidden" };

  const { error } = await supabase.from("shipments").insert({
    order_id: orderId,
    tracking_number,
    carrier: carrier ?? null,
    last_status: null,
    eta_date: null,
  });

  if (error) return { ok: false, message: error.message };
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

export async function markReceivedAction(orderId: number) {
  const { supabase, userId } = await authed();
  if (!orderId) return { ok: false, message: "Missing order id" };

  const { data: ord, error: oErr } = await supabase
    .from("orders")
    .select("id, user_id")
    .eq("id", orderId)
    .single();
  if (oErr) return { ok: false, message: oErr.message };
  if (ord.user_id !== userId) return { ok: false, message: "Forbidden" };

  const { error: updErr } = await supabase
    .from("orders")
    .update({ status: "RECEIVED", received_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("user_id", userId);
  if (updErr) return { ok: false, message: updErr.message };

  // Fetch order_items to increment inventory (vials & capsules)
  const { data: items, error: iErr } = await supabase
    .from("order_items")
    .select("peptide_id, quantity_vials, mg_per_vial, bac_ml, quantity_units, caps_per_bottle, mg_per_cap")
    .eq("order_id", orderId);
  if (iErr) return { ok: false, message: iErr.message };

  // Vials -> inventory_items
  const vialItems = (items ?? []).filter(it => Number(it.quantity_vials ?? 0) > 0);
  for (const it of vialItems) {
    const vials = Number(it.quantity_vials ?? 0);
    const { data: inv } = await supabase
      .from("inventory_items")
      .select("id, vials, mg_per_vial, bac_ml")
      .eq("user_id", userId)
      .eq("peptide_id", it.peptide_id)
      .maybeSingle();

    if (!inv) {
      const { error: insErr } = await supabase.from("inventory_items").insert({
        user_id: userId,
        peptide_id: it.peptide_id,
        vials: vials,
        mg_per_vial: Number(it.mg_per_vial ?? 0),
        bac_ml: Number(it.bac_ml ?? 0),
      });
      if (insErr) return { ok: false, message: insErr.message };
    } else {
      const { error: updErr2 } = await supabase
        .from("inventory_items")
        .update({
          vials: Number(inv.vials ?? 0) + vials,
          mg_per_vial: Number(inv.mg_per_vial ?? 0) || Number(it.mg_per_vial ?? 0),
          bac_ml: Number(inv.bac_ml ?? 0) || Number(it.bac_ml ?? 0),
        })
        .eq("id", inv.id)
        .eq("user_id", userId);
      if (updErr2) return { ok: false, message: updErr2.message };
    }
  }

  // Capsules -> inventory_capsules
  const capItems = (items ?? []).filter(it => Number(it.quantity_units ?? 0) > 0);
  for (const it of capItems) {
    const bottles = Number(it.quantity_units ?? 0);
    const { data: invc } = await supabase
      .from("inventory_capsules")
      .select("id, bottles, caps_per_bottle, mg_per_cap")
      .eq("user_id", userId)
      .eq("peptide_id", it.peptide_id)
      .maybeSingle();

    if (!invc) {
      const { error: insErr } = await supabase.from("inventory_capsules").insert({
        user_id: userId,
        peptide_id: it.peptide_id,
        bottles,
        caps_per_bottle: Number(it.caps_per_bottle ?? 0),
        mg_per_cap: Number(it.mg_per_cap ?? 0),
      });
      if (insErr) return { ok: false, message: insErr.message };
    } else {
      const { error: updErr3 } = await supabase
        .from("inventory_capsules")
        .update({
          bottles: Number(invc.bottles ?? 0) + bottles,
          caps_per_bottle: Number(invc.caps_per_bottle ?? 0) || Number(it.caps_per_bottle ?? 0),
          mg_per_cap: Number(invc.mg_per_cap ?? 0) || Number(it.mg_per_cap ?? 0),
        })
        .eq("id", invc.id)
        .eq("user_id", userId);
      if (updErr3) return { ok: false, message: updErr3.message };
    }
  }

  revalidatePath("/inventory");
  revalidatePath("/orders");
  return { ok: true };
}
