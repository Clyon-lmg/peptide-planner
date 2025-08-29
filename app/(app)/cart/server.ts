"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabaseServer";

type Kind = "vial" | "capsule";

async function authed() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Not authenticated");
  return { supabase, userId: data.user.id as string };
}

export async function addToCart(opts: {
  vendor_id: number;
  peptide_id: number;
  kind?: Kind;                 // default "vial"
  quantity_vials?: number;     // for vials
  quantity_units?: number;     // for capsules (bottles)
  prefer_coupon_id?: number | null;
}) {
  const { supabase, userId } = await authed();
  const kind = (opts.kind ?? "vial") as Kind;

  if (!opts.vendor_id || !opts.peptide_id) throw new Error("Missing vendor_id or peptide_id");

  const quantity_vials =
    kind === "vial" ? Math.max(1, Number(opts.quantity_vials ?? 1)) : null;
  const quantity_units =
    kind === "capsule" ? Math.max(1, Number(opts.quantity_units ?? 1)) : null;

  const { error } = await supabase
    .from("cart_items")
    .upsert(
      {
        user_id: userId,
        vendor_id: opts.vendor_id,
        peptide_id: opts.peptide_id,
        kind,
        quantity_vials,
        quantity_units,
        prefer_coupon_id: opts.prefer_coupon_id ?? null,
      },
      {
        onConflict: "user_id,vendor_id,peptide_id,kind",
        ignoreDuplicates: false,
      }
    );

  if (error) throw error;
  revalidatePath("/cart");
}

export async function updateCartQuantity(itemId: number, qty: number) {
  const { supabase, userId } = await authed();
  if (!itemId || !qty) throw new Error("Missing id/qty");
  const q = Math.max(1, Number(qty));
  const { error } = await supabase
    .from("cart_items")
    .update({
      quantity_vials: q, // vials rows
      quantity_units: q, // capsules rows
    })
    .eq("id", itemId)
    .eq("user_id", userId);
  if (error) throw error;
  revalidatePath("/cart");
}

export async function deleteCartItem(itemId: number) {
  const { supabase, userId } = await authed();
  if (!itemId) throw new Error("Missing id");
  const { error } = await supabase.from("cart_items").delete().eq("id", itemId).eq("user_id", userId);
  if (error) throw error;
  revalidatePath("/cart");
}

export async function chooseVendorCoupon(vendor_id: number, coupon_id: number | null) {
  const { supabase, userId } = await authed();
  if (!vendor_id) throw new Error("Missing vendor id");

  if (coupon_id) {
    const { data: coup, error: cErr } = await supabase
      .from("coupons")
      .select("id, vendor_id, expires_at")
      .eq("id", coupon_id)
      .single();
    if (cErr) throw cErr;
    if (!coup || coup.vendor_id !== vendor_id) throw new Error("Coupon does not belong to this vendor");
    if (coup.expires_at && new Date(coup.expires_at) < new Date()) {
      throw new Error("Coupon is expired");
    }
  }

  const { error } = await supabase
    .from("cart_items")
    .update({ prefer_coupon_id: coupon_id })
    .eq("user_id", userId)
    .eq("vendor_id", vendor_id);

  if (error) throw error;
  revalidatePath("/cart");
}
