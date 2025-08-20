// app/(app)/cart/CartVendorCard.tsx
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import CouponSelect from "./components/CouponSelect";
import PlaceOrderLink from "./PlaceOrderLink";

type Kind = "vial" | "capsule";

function applyCouponToPrice(unit: number, percent_off?: number | null, amount_off?: number | null) {
  let price = unit;
  if (percent_off && percent_off > 0) price = price * (1 - percent_off / 100);
  if (amount_off && amount_off > 0) price = price - amount_off;
  return Math.max(0, Number(price.toFixed(2)));
}

export default async function CartVendorCard({ vendorId }: { vendorId: number }) {
  const supabase = createServerComponentClient({ cookies });

  const { data: ures } = await supabase.auth.getUser();
  if (!ures?.user) {
    return (
      <div
        className="
          rounded-2xl border border-border bg-card text-card-foreground
          shadow-sm p-6
        "
      >
        <p className="text-sm text-muted-foreground">Please sign in to view your cart.</p>
      </div>
    );
  }
  const user_id = ures.user.id as string;

  // Load cart lines for this vendor
  const { data: cartRows, error: cartErr } = await supabase
    .from("cart_items")
    .select("id, peptide_id, kind, quantity_vials, quantity_units, prefer_coupon_id")
    .eq("user_id", user_id)
    .eq("vendor_id", vendorId);
  if (cartErr) throw cartErr;

  if (!cartRows?.length) {
    return (
      <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Vendor #{vendorId}</h3>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">No items for this vendor.</p>
      </div>
    );
  }

  // Peptide names
  const peptideIds = Array.from(new Set(cartRows.map(r => r.peptide_id)));
  const { data: peptides } = await supabase
    .from("peptides")
    .select("id, canonical_name")
    .in("id", peptideIds);

  const nameMap = new Map<number, string>();
  (peptides ?? []).forEach(p => nameMap.set(p.id, p.canonical_name));

  // Vendor products (vials + capsules)
  const { data: products } = await supabase
    .from("vendor_products")
    .select("vendor_id, peptide_id, price, mg_per_vial, bac_ml, kind, caps_per_bottle, mg_per_cap")
    .eq("vendor_id", vendorId);

  const productMap = new Map<string, any>();
  (products ?? []).forEach(p => {
    const k = `${p.vendor_id}:${p.peptide_id}:${(p.kind ?? "vial") as Kind}`;
    productMap.set(k, p);
    if (!p.kind) productMap.set(`${p.vendor_id}:${p.peptide_id}:vial`, p);
  });

  // Coupons for this vendor
  const { data: coupons } = await supabase
    .from("coupons")
    .select("id, vendor_id, code, percent_off, amount_off, expires_at")
    .eq("vendor_id", vendorId);

  // Vendor display
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, name, homepage")
    .eq("id", vendorId)
    .single();

  const selectedCouponId =
    (cartRows.find(r => r.prefer_coupon_id)?.prefer_coupon_id as number | null) ?? null;
  const selected = coupons?.find(c => c.id === selectedCouponId) ?? null;

  // Build lines
  const lines = cartRows.map((r) => {
    const kind = (r.kind ?? "vial") as Kind;
    const prod = productMap.get(`${vendorId}:${r.peptide_id}:${kind}`);
    const qty =
      kind === "vial" ? Number(r.quantity_vials ?? 1) : Number(r.quantity_units ?? 1);
    const unit = Number(prod?.price ?? 0);
    const effectiveUnit = selected
      ? applyCouponToPrice(unit, selected.percent_off, selected.amount_off)
      : unit;

    const total = Number((effectiveUnit * qty).toFixed(2));

    return {
      id: r.id,
      peptide_id: r.peptide_id,
      name: nameMap.get(r.peptide_id) ?? `Peptide #${r.peptide_id}`,
      kind,
      qty,
      unit,
      effectiveUnit,
      total,
      mg_per_vial: prod?.mg_per_vial ?? null,
      bac_ml: prod?.bac_ml ?? null,
      caps_per_bottle: prod?.caps_per_bottle ?? null,
      mg_per_cap: prod?.mg_per_cap ?? null,
    };
  });

  const subtotal = lines.reduce((s, l) => s + l.total, 0);

  return (
    <section
      className="
        rounded-2xl border border-border bg-card text-card-foreground
        shadow-sm p-5 space-y-4
      "
    >
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{vendor?.name ?? `Vendor #${vendorId}`}</h3>
          {vendor?.homepage ? (
            <a
              href={vendor.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary underline underline-offset-4"
            >
              Visit site
            </a>
          ) : null}
        </div>

        <CouponSelect
          vendorId={vendorId}
          coupons={(coupons ?? []).map(c => ({
            id: c.id as number,
            code: c.code as string,
            percent_off: (c.percent_off as number | null) ?? null,
            amount_off: (c.amount_off as number | null) ?? null,
            expires_at: (c.expires_at as string | null) ?? null,
          }))}
          selectedId={selectedCouponId}
        />
      </header>

      <div className="space-y-3">
        {lines.map((l) => (
          <div
            key={l.id}
            className="
              flex items-start justify-between
              rounded-xl border border-border bg-background shadow-sm
              p-3
            "
          >
            <div>
              <div className="font-medium">
                {l.name}{" "}
                <span className="text-xs text-muted-foreground">
                  {l.kind === "vial"
                    ? `${l.mg_per_vial ?? 0} mg / ${l.bac_ml ?? 0} ml`
                    : `${l.caps_per_bottle ?? 0} caps • ${l.mg_per_cap ?? 0} mg/cap`}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {l.kind === "vial" ? "Vials" : "Bottles"}: {l.qty}
              </div>
              {selected ? (
                <div className="text-xs text-emerald-600 dark:text-emerald-400">
                  Coupon <span className="font-mono">{selected.code}</span>{" "}
                  {selected.percent_off ? `(-${selected.percent_off}% )` : ""}
                  {selected.amount_off ? `(-$${Number(selected.amount_off).toFixed(2)} ea)` : ""}
                </div>
              ) : null}
            </div>
            <div className="text-right">
              <div className="text-sm">
                ${l.effectiveUnit.toFixed(2)}{" "}
                <span className="text-xs text-muted-foreground">ea</span>
              </div>
              <div className="font-semibold">${l.total.toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="text-sm text-muted-foreground">Subtotal</div>
        <div className="text-lg font-semibold">${subtotal.toFixed(2)}</div>
      </div>

      <div className="flex justify-end">
        <PlaceOrderLink vendorId={vendorId} />
      </div>
    </section>
  );
}
