// app/(app)/orders/actions.ts
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

export async function markPlacedAction(formData: FormData): Promise<ActionResult> {
  "use server";
  const { supabase, userId } = await getAuthed();
  const orderId = Number(formData.get("order_id"));
  if (!orderId) return { ok: false, message: "Missing order id" };

  const { error } = await supabase
    .from("orders")
    .update({ status: "PLACED", placed_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("user_id", userId);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/orders");
  return { ok: true };
}

export async function addTrackingAction(formData: FormData): Promise<ActionResult> {
  "use server";
  const { supabase, userId } = await getAuthed();
  const orderId = Number(formData.get("order_id"));
  const tracking_number = String(formData.get("tracking_number") ?? "").trim();
  const carrier = String(formData.get("carrier") ?? "").trim();
  if (!orderId) return { ok: false, message: "Missing order id" };
  if (!tracking_number) return { ok: false, message: "Enter a tracking number" };

  const { error } = await supabase
    .from("shipments")
    .upsert(
      { order_id: orderId, tracking_number, carrier: carrier || null },
      { onConflict: "order_id" }
    );

  if (error) return { ok: false, message: error.message };
  revalidatePath("/orders");
  return { ok: true };
}

export async function markReceivedAction(formData: FormData): Promise<ActionResult> {
  "use server";
  const { supabase, userId } = await getAuthed();
  const orderId = Number(formData.get("order_id"));
  if (!orderId) return { ok: false, message: "Missing order id" };

  const { data: items, error: itemsErr } = await supabase
    .from("order_items")
    .select("peptide_id, quantity_vials, mg_per_vial, bac_ml")
    .eq("order_id", orderId);
  if (itemsErr) return { ok: false, message: itemsErr.message };

  for (const it of items ?? []) {
    const qty = Math.max(0, Number(it.quantity_vials ?? 0));
    if (qty === 0) continue;

    if (Number(it.mg_per_vial ?? 0) > 0 || Number(it.bac_ml ?? 0) > 0) {
      // vials
      const { data: existing } = await supabase
        .from("inventory_items")
        .select("id, vials")
        .eq("user_id", userId)
        .eq("peptide_id", it.peptide_id)
        .maybeSingle();

      if (existing?.id) {
        await supabase
          .from("inventory_items")
          .update({
            vials: Number(existing.vials ?? 0) + qty,
            mg_per_vial: Number(it.mg_per_vial ?? 0),
            bac_ml: Number(it.bac_ml ?? 0),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("inventory_items").insert({
          user_id: userId,
          peptide_id: it.peptide_id,
          vials: qty,
          mg_per_vial: Number(it.mg_per_vial ?? 0),
          bac_ml: Number(it.bac_ml ?? 0),
        });
      }
    } else {
      // capsules fallback: treat quantity_vials as bottles; infer specs from vendor_products if needed
      const { data: vp } = await supabase
        .from("vendor_products")
        .select("caps_per_bottle, mg_per_cap")
        .eq("peptide_id", it.peptide_id)
        .eq("kind", "capsule")
        .limit(1)
        .single();

      const caps_per_bottle = Number(vp?.caps_per_bottle ?? 0);
      const mg_per_cap = Number(vp?.mg_per_cap ?? 0);

      const { data: existing } = await supabase
        .from("inventory_capsules")
        .select("id, bottles")
        .eq("user_id", userId)
        .eq("peptide_id", it.peptide_id)
        .maybeSingle();

      if (existing?.id) {
        await supabase
          .from("inventory_capsules")
          .update({
            bottles: Number(existing.bottles ?? 0) + qty,
            caps_per_bottle,
            mg_per_cap,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("inventory_capsules").insert({
          user_id: userId,
          peptide_id: it.peptide_id,
          bottles: qty,
          caps_per_bottle,
          mg_per_cap,
        });
      }
    }
  }

  await supabase
    .from("orders")
    .update({ status: "RECEIVED", received_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("user_id", userId);

  revalidatePath("/orders");
  revalidatePath("/inventory");
  return { ok: true };
}

/** NEW: Delete an order (and its items & shipment) */
export async function deleteOrderAction(formData: FormData): Promise<ActionResult> {
  "use server";
  const { supabase, userId } = await getAuthed();
  const orderId = Number(formData.get("order_id"));
  if (!orderId) return { ok: false, message: "Missing order id" };

  // Clean children first
  await supabase.from("order_items").delete().eq("order_id", orderId);
  await supabase.from("shipments").delete().eq("order_id", orderId);
  const { error } = await supabase.from("orders").delete().eq("id", orderId).eq("user_id", userId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/orders");
  return { ok: true };
}
