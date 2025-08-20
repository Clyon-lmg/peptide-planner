// app/(app)/cart/checkout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /cart/checkout?vendor_id=123
 * - Creates a DRAFT order + order_items from the user's cart for this vendor
 * - Clears those cart lines
 * - Redirects to vendor using affiliate link (and appends coupon code if chosen)
 *
 * IMPORTANT: On any error, we now return a 4xx JSON instead of redirecting to /cart
 * to avoid accidental redirect loops.
 */
export async function GET(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const url = new URL(req.url);
    const vendorId = Number(url.searchParams.get("vendor_id") ?? 0);
    if (!vendorId) {
      return NextResponse.json({ ok: false, error: "Missing vendor_id" }, { status: 400 });
    }

    // Load cart lines for this vendor
    const { data: cart, error: cartErr } = await supabase
      .from("cart_items")
      .select("id, peptide_id, vendor_id, kind, quantity_vials, quantity_units, prefer_coupon_id")
      .eq("user_id", user.id)
      .eq("vendor_id", vendorId);

    if (cartErr) {
      return NextResponse.json({ ok: false, error: cartErr.message }, { status: 500 });
    }
    if (!cart || cart.length === 0) {
      return NextResponse.json({ ok: false, error: "No items to order" }, { status: 400 });
    }

    // Load product specs/prices
    const peptideIds = Array.from(new Set(cart.map((c) => c.peptide_id)));
    const { data: products, error: prodErr } = await supabase
      .from("vendor_products")
      .select("peptide_id, kind, price, mg_per_vial, bac_ml, mg_per_cap, caps_per_bottle, vendor_id")
      .eq("vendor_id", vendorId)
      .in("peptide_id", peptideIds);

    if (prodErr) {
      return NextResponse.json({ ok: false, error: prodErr.message }, { status: 500 });
    }

    // Create order draft
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({ user_id: user.id, vendor_id: vendorId, status: "DRAFT" })
      .select("id")
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ ok: false, error: orderErr?.message || "Order create failed" }, { status: 500 });
    }

    // Build order_items payload (capsules stored with mg_per_vial/bac_ml=0, quantity in quantity_vials)
    const itemsPayload = cart.map((line) => {
      const p = (products ?? []).find(
        (vp) => vp.peptide_id === line.peptide_id && vp.vendor_id === vendorId && vp.kind === line.kind
      );
      const unit_price = Number(p?.price ?? 0);
      const q =
        line.kind === "vial"
          ? Number(line.quantity_vials ?? 1)
          : Number(line.quantity_units ?? 1);

      return {
        order_id: order.id,
        peptide_id: line.peptide_id,
        quantity_vials: Math.max(1, q),
        mg_per_vial: line.kind === "vial" ? Number(p?.mg_per_vial ?? 0) : 0,
        bac_ml: line.kind === "vial" ? Number(p?.bac_ml ?? 0) : 0,
        unit_price,
        coupon_id: line.prefer_coupon_id ?? null,
        affiliate_link_id: null as number | null,
      };
    });

    const { error: oiErr } = await supabase.from("order_items").insert(itemsPayload);
    if (oiErr) {
      return NextResponse.json({ ok: false, error: oiErr.message }, { status: 500 });
    }

    // Clear cart for this vendor
    const { error: delErr } = await supabase
      .from("cart_items")
      .delete()
      .eq("user_id", user.id)
      .eq("vendor_id", vendorId);
    if (delErr) {
      // Not fatal for redirect, but report it
      return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
    }

    // Find affiliate link + coupon for redirect
    const [{ data: vendor }, { data: aff }, { data: coupon, error: couponErr }] = await Promise.all([
      supabase.from("vendors").select("id, homepage").eq("id", vendorId).single(),
      supabase
        .from("affiliate_links")
        .select("id, base_url, param_key, param_value")
        .eq("vendor_id", vendorId)
        .eq("active", true)
        .limit(1)
        .single(),
      supabase
        .from("coupons")
        .select("id, code")
        .in(
          "id",
          itemsPayload.map((i) => i.coupon_id).filter(Boolean) as number[]
        )
        .limit(1)
        .maybeSingle(),
    ]);

    if (couponErr) {
      // Non-fatal; continue without coupon code
    }

    // Build outbound URL (absolute only)
    let outbound = aff?.base_url || vendor?.homepage || "";
    try {
      const u = new URL(outbound);
      if (aff?.param_key && aff?.param_value) u.searchParams.set(aff.param_key, aff.param_value);
      if (coupon?.code) u.searchParams.set("coupon", coupon.code);
      outbound = u.toString();
    } catch {
      // If affiliate/homepage is not a valid absolute URL, just show a success JSON
      outbound = "";
    }

    if (!outbound) {
      // No valid external link; return a simple success payload instead of redirecting
      return NextResponse.json({ ok: true, order_id: order.id, message: "Order created (no external link found)" });
    }

    // Success: redirect to vendor (302)
    return NextResponse.redirect(outbound, { status: 302 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
