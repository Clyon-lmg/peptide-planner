﻿// app/(app)/cart/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createServerActionSupabase } from "@/lib/supabaseServer";

type ActionResult = { ok: boolean; message?: string };

async function getAuthed() {
  const supabase = createServerActionSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Not authenticated");
  return { supabase, userId: data.user.id as string };
}

/** Update quantity for a cart line (handles vial vs capsule) */
export async function updateCartQtyAction(formData: FormData): Promise<ActionResult> {
  "use server";
  const { supabase, userId } = await getAuthed();
  const id = Number(formData.get("id"));
  const kind = String(formData.get("kind") || "vial") as "vial" | "capsule";
  const qty = Math.max(1, Number(formData.get("quantity") ?? 1));
  if (!id) return { ok: false, message: "Missing cart id" };

  const patch: any = {};
  if (kind === "vial") patch.quantity_vials = qty;
  else patch.quantity_units = qty;

  const { error } = await supabase
    .from("cart_items")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/cart");
  return { ok: true };
}

/** Delete a single cart line */
export async function deleteCartLineAction(formData: FormData): Promise<ActionResult> {
  "use server";
  const { supabase, userId } = await getAuthed();
  const id = Number(formData.get("id"));
  if (!id) return { ok: false, message: "Missing cart id" };

  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/cart");
  return { ok: true };
}

/** Set preferred coupon for all lines from a vendor in the cart */
export async function setCartVendorCouponAction(formData: FormData): Promise<ActionResult> {
  "use server";
  const { supabase, userId } = await getAuthed();
  const vendorId = Number(formData.get("vendor_id"));
  const couponIdRaw = formData.get("coupon_id");
  const couponId = couponIdRaw ? Number(couponIdRaw) : null;
  if (!vendorId) return { ok: false, message: "Missing vendor id" };

  const { error } = await supabase
    .from("cart_items")
    .update({ prefer_coupon_id: couponId })
    .eq("user_id", userId)
    .eq("vendor_id", vendorId);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/cart");
  return { ok: true };
}
