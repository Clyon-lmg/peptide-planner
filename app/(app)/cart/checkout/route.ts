import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const url = new URL(req.url);
    const vendor_id = Number(url.searchParams.get("vendor_id") || 0);
    if (!vendor_id) {
      return NextResponse.json({ ok: false, error: "Missing vendor_id" }, { status: 400 });
    }

    const { data: ures, error: uerr } = await supabase.auth.getUser();
    if (uerr || !ures?.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }
    const user_id = ures.user.id as string;

    // 1) Cart lines
    const { data: items, error: ierr } = await supabase
      .from("cart_items")
      .select("id, peptide_id, kind, quantity_vials, quantity_units, prefer_coupon_id, vendor_id")
      .eq("user_id", user_id)
      .eq("vendor_id", vendor_id);
    if (ierr) throw ierr;
    if (!items?.length) {
      return NextResponse.json({ ok: false, error: "No items in cart for this vendor" }, { status: 400 });
    }

    // 2) Coupons referenced by cart rows
    const couponIds = Array.from(new Set(items.map(i => i.prefer_coupon_id).filter(Boolean))) as number[];
    const couponMap = new Map<number, { id: number; vendor_id: number; expires_at: string | null }>();
    if (couponIds.length) {
      const { data: coups, error: cErr } = await supabase
        .from("coupons")
        .select("id, vendor_id, expires_at")
        .in("id", couponIds);
      if (cErr) throw cErr;
      for (const c of coups ?? []) couponMap.set(c.id, c);
    }

    // 3) Vendor products (prices/specs)
    const { data: products, error: perr } = await supabase
      .from("vendor_products")
      .select(
        "vendor_id, peptide_id, price, price_currency, mg_per_vial, bac_ml, kind, caps_per_bottle, mg_per_cap"
      )
      .eq("vendor_id", vendor_id);
    if (perr) throw perr;
    const productMap = new Map<string, any>();
    for (const p of products ?? []) {
      productMap.set(`${p.vendor_id}:${p.peptide_id}:${p.kind ?? "vial"}`, p);
      if (!p.kind) productMap.set(`${p.vendor_id}:${p.peptide_id}:vial`, p);
    }

    // 4) Create order (DRAFT)
    const { data: oins, error: oerr } = await supabase
      .from("orders")
      .insert({ user_id, vendor_id, status: "DRAFT" })
      .select("id")
      .single();
    if (oerr) throw oerr;
    const order_id = oins.id as number;

    // 5) Affiliate + vendor homepage
    const { data: affs } = await supabase
      .from("affiliate_links")
      .select("id, vendor_id, base_url, param_key, param_value, active")
      .eq("vendor_id", vendor_id)
      .eq("active", true)
      .limit(1);
    const aff = affs?.[0] ?? null;

    const { data: vend } = await supabase
      .from("vendors")
      .select("id, homepage")
      .eq("id", vendor_id)
      .single();

    // 6) Create order_items (vials & capsules)
    for (const it of items) {
      const kind = (it.kind ?? "vial") as "vial" | "capsule";
      const pkey = `${vendor_id}:${it.peptide_id}:${kind}`;
      const prod = productMap.get(pkey);
      if (!prod) throw new Error(`No vendor product for peptide ${it.peptide_id} (${kind})`);

      // Resolve coupon (matches vendor and not expired)
      let coupon_id: number | null = null;
      if (it.prefer_coupon_id) {
        const c = couponMap.get(it.prefer_coupon_id);
        if (c && c.vendor_id === vendor_id) {
          if (!c.expires_at || new Date(c.expires_at) >= new Date()) coupon_id = c.id;
        }
      }

      if (kind === "vial") {
        const quantity_vials = Math.max(1, Number(it.quantity_vials ?? 1));
        const { error: oierr } = await supabase.from("order_items").insert({
          order_id,
          peptide_id: it.peptide_id,
          quantity_vials,
          mg_per_vial: Number(prod.mg_per_vial ?? 0),
          bac_ml: Number(prod.bac_ml ?? 0),
          unit_price: Number(prod.price ?? 0),
          coupon_id,
          affiliate_link_id: aff?.id ?? null,
          quantity_units: null,
          caps_per_bottle: null,
          mg_per_cap: null,
        });
        if (oierr) throw oierr;
      } else {
        const quantity_units = Math.max(1, Number(it.quantity_units ?? 1)); // bottles
        const { error: oierr } = await supabase.from("order_items").insert({
          order_id,
          peptide_id: it.peptide_id,
          quantity_vials: 0,
          mg_per_vial: 0,
          bac_ml: 0,
          unit_price: Number(prod.price ?? 0),
          coupon_id,
          affiliate_link_id: aff?.id ?? null,
          quantity_units,
          caps_per_bottle: Number(prod.caps_per_bottle ?? 0),
          mg_per_cap: Number(prod.mg_per_cap ?? 0),
        });
        if (oierr) throw oierr;
      }
    }

    // 7) Clear vendor rows from cart
    const { error: cerr } = await supabase
      .from("cart_items")
      .delete()
      .eq("user_id", user_id)
      .eq("vendor_id", vendor_id);
    if (cerr) throw cerr;

    // 8) Build outbound (affiliate first, else vendor homepage)
    let outbound = "";
    if (aff?.base_url) {
      const u = new URL(aff.base_url);
      if (aff.param_key && aff.param_value) u.searchParams.set(aff.param_key, aff.param_value);
      outbound = u.toString();
    } else if (vend?.homepage) {
      outbound = vend.homepage;
    }

    // Optional: redirect mode if you want to support plain <a> links
    const mode = url.searchParams.get("mode"); // "redirect" | null
    if (mode === "redirect" && outbound) {
      return NextResponse.redirect(outbound, { status: 302 });
    }

    return NextResponse.json({ ok: true, order_id, outbound });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
