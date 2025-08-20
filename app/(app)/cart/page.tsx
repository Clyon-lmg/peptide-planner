// app/(app)/cart/page.tsx
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";
import {
  updateCartQtyAction,
  deleteCartLineAction,
  setCartVendorCouponAction,
} from "./actions";

export const dynamic = "force-dynamic";

// Supabase may return nested relation as an ARRAY ([]) or OBJECT ({}) or null
type PeptidesRelation = { canonical_name: string } | { canonical_name: string }[] | null;

type CartLine = {
  id: number;
  vendor_id: number;
  peptide_id: number;
  kind: "vial" | "capsule";
  quantity_vials: number | null;
  quantity_units: number | null;
  prefer_coupon_id: number | null;
  peptides: PeptidesRelation;
};

type Vendor = { id: number; name: string; homepage: string | null };

type Product = {
  vendor_id: number;
  peptide_id: number;
  price: number;
  kind: "vial" | "capsule";
};

type Coupon = {
  id: number;
  vendor_id: number;
  code: string;
  percent_off: number | null;
  amount_off: number | null;
  expires_at: string | null;
};

type AffiliateLink = {
  id: number;
  vendor_id: number;
  base_url: string;
  param_key: string | null;
  param_value: string | null;
  active: boolean;
};

async function getUser() {
  const supabase = createServerComponentClient({ cookies });
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data?.user ?? null };
}

function computeDiscounted(
  subtotal: number,
  coupon: Coupon | null | undefined
): { discount: number; total: number; label: string } {
  if (!coupon) return { discount: 0, total: subtotal, label: "" };
  const pct = coupon.percent_off ? Number(coupon.percent_off) : 0;
  const amt = coupon.amount_off ? Number(coupon.amount_off) : 0;
  const discPct = pct > 0 ? (subtotal * pct) / 100 : 0;
  const discAmt = amt > 0 ? amt : 0;
  const discount = Math.max(discPct, discAmt);
  const total = Math.max(0, subtotal - discount);
  const label =
    pct > 0 && discPct >= discAmt ? `${pct}% off` : amt > 0 ? `$${amt.toFixed(2)} off` : "";
  return { discount, total, label };
}

function buildAffiliateUrl(
  vendor: Vendor | undefined,
  aff: AffiliateLink | undefined,
  chosenCoupon: Coupon | null
) {
  let url = aff?.base_url || vendor?.homepage || "#";
  try {
    const u = new URL(url);
    if (aff?.param_key && aff.param_value) {
      u.searchParams.set(aff.param_key, aff.param_value);
    }
    if (chosenCoupon?.code) {
      // Common param names: coupon / discount / code
      u.searchParams.set("coupon", chosenCoupon.code);
    }
    return u.toString();
  } catch {
    return url;
  }
}

// Normalize nested relation into a plain string
function getPeptideName(rel: PeptidesRelation): string {
  if (!rel) return "Peptide";
  if (Array.isArray(rel)) {
    const first = rel[0];
    if (first && typeof first.canonical_name === "string") return first.canonical_name;
    return "Peptide";
  }
  return typeof rel.canonical_name === "string" ? rel.canonical_name : "Peptide";
}

export default async function CartPage() {
  const { supabase, user } = await getUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-xl border p-6">
          <h1 className="text-2xl font-semibold">Cart</h1>
          <p className="mt-2 text-sm">
            You’re not signed in.{" "}
            <Link href="/sign-in" className="underline">
              Sign in
            </Link>{" "}
            to view your cart.
          </p>
        </div>
      </div>
    );
  }

  const [{ data: raw }, { data: vendors }, { data: coupons }, { data: affLinks }] = await Promise.all([
    supabase
      .from("cart_items")
      // NOTE: Supabase may return peptides(...) as array. Our types + helper handle both.
      .select(
        "id, vendor_id, peptide_id, kind, quantity_vials, quantity_units, prefer_coupon_id, peptides(canonical_name)"
      )
      .eq("user_id", user.id)
      .order("id", { ascending: true }),
    supabase.from("vendors").select("id, name, homepage").eq("active", true),
    supabase.from("coupons").select("id, vendor_id, code, percent_off, amount_off, expires_at"),
    supabase
      .from("affiliate_links")
      .select("id, vendor_id, base_url, param_key, param_value, active")
      .eq("active", true),
  ]);

  const lines = (raw ?? []) as CartLine[];
  const vendorMap = new Map<number, Vendor>((vendors ?? []).map((v) => [v.id, v as Vendor]));
  const affByVendor = new Map<number, AffiliateLink>(
    (affLinks ?? []).map((a: any) => [a.vendor_id, a as AffiliateLink]),
  );

  const couponsByVendor = new Map<number, Coupon[]>();
  (coupons ?? []).forEach((c) => {
    const arr = couponsByVendor.get(c.vendor_id) ?? [];
    arr.push(c as Coupon);
    couponsByVendor.set(c.vendor_id, arr);
  });

  // load product prices for (vendor, peptide, kind)
  const peptideIds = Array.from(new Set(lines.map((l) => l.peptide_id)));
  const vendorIds = Array.from(new Set(lines.map((l) => l.vendor_id)));
  const { data: products } = await supabase
    .from("vendor_products")
    .select("vendor_id, peptide_id, price, kind")
    .in("vendor_id", vendorIds.length ? vendorIds : [-1])
    .in("peptide_id", peptideIds.length ? peptideIds : [-1]);

  const priceKey = (vp: Product) => `${vp.vendor_id}-${vp.peptide_id}-${vp.kind}`;
  const priceMap = new Map<string, number>((products ?? []).map((p: any) => [priceKey(p), Number(p.price ?? 0)]));

  // Group by vendor
  const byVendor = new Map<number, CartLine[]>();
  lines.forEach((l) => {
    const arr = byVendor.get(l.vendor_id) ?? [];
    arr.push(l);
    byVendor.set(l.vendor_id, arr);
  });

  const vendorIdsSorted = Array.from(byVendor.keys()).sort((a, b) => {
    const an = vendorMap.get(a)?.name ?? "";
    const bn = vendorMap.get(b)?.name ?? "";
    return an.localeCompare(bn);
  });

  // ---- Inline server action wrappers (discard return values) ----
  // These satisfy Next's type requirement: (fd) => void | Promise<void>
  const updateQty = async (formData: FormData) => {
    "use server";
    await updateCartQtyAction(formData);
  };

  const deleteLine = async (formData: FormData) => {
    "use server";
    await deleteCartLineAction(formData);
  };

  const saveCoupon = async (formData: FormData) => {
    "use server";
    await setCartVendorCouponAction(formData);
  };
  // ---------------------------------------------------------------

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Cart</h1>
        <Link href="/orders" className="text-sm underline">
          View Orders
        </Link>
      </header>

      {vendorIdsSorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">Your cart is empty.</p>
      ) : (
        vendorIdsSorted.map((vid) => {
          const vendor = vendorMap.get(vid);
          const lines = byVendor.get(vid) ?? [];
          const vendorCoupons = couponsByVendor.get(vid) ?? [];

          // compute subtotal
          let subtotal = 0;
          const computed = lines.map((l) => {
            const qty = l.kind === "vial" ? Number(l.quantity_vials ?? 1) : Number(l.quantity_units ?? 1);
            const price = priceMap.get(`${l.vendor_id}-${l.peptide_id}-${l.kind}`) ?? 0;
            const lineTotal = qty * price;
            subtotal += lineTotal;
            return { ...l, qty, price, lineTotal };
          });

          // chosen coupon → pick first non-null prefer_coupon_id (UI lets you pick one)
          const chosenCouponId = computed.find((l) => l.prefer_coupon_id)?.prefer_coupon_id ?? null;
          const chosenCoupon = vendorCoupons.find((c) => c.id === chosenCouponId) ?? null;

          const { discount, total, label } = computeDiscounted(subtotal, chosenCoupon);

          // Build affiliate visit link (and use same for "Place Order" redirect page)
          const affiliate = affByVendor.get(vid);
          const externalUrl = buildAffiliateUrl(vendor, affiliate, chosenCoupon);
          const checkoutUrl = `/cart/checkout?vendor_id=${vid}`;

          return (
            <section key={vid} className="rounded-xl border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{vendor?.name ?? "Vendor"}</h2>
                {externalUrl !== "#" ? (
                  <a
                    href={externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline"
                  >
                    Visit site
                  </a>
                ) : null}
              </div>

              {/* Lines */}
              <div className="space-y-3">
                {computed.map((l) => (
                  <div
                    key={l.id}
                    className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto_auto] gap-2 items-center rounded border p-2"
                  >
                    <div className="font-medium truncate">
                      {getPeptideName(l.peptides)}{" "}
                      <span className="text-xs text-gray-500">({l.kind})</span>
                    </div>
                    <div className="text-sm">${l.price.toFixed(2)}/unit</div>

                    <form action={updateQty} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="kind" value={l.kind} />
                      <label className="text-xs">
                        Qty
                        <input
                          name="quantity"
                          type="number"
                          min={1}
                          defaultValue={l.qty}
                          className="ml-2 w-20 rounded border px-2 py-1"
                        />
                      </label>
                      <button
                        type="submit"
                        className="rounded px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                        title="Save"
                      >
                        Save
                      </button>
                    </form>

                    <div className="text-sm">${l.lineTotal.toFixed(2)}</div>

                    <form action={deleteLine}>
                      <input type="hidden" name="id" value={l.id} />
                      <button
                        type="submit"
                        className="rounded px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white"
                        title="Delete"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                ))}
              </div>

              {/* Coupon selection + totals */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <form action={saveCoupon} className="flex items-center gap-3">
                  <input type="hidden" name="vendor_id" value={vid} />
                  <label className="text-sm">
                    Coupon
                    <select
                      name="coupon_id"
                      defaultValue={
                        computed.find((l) => l.prefer_coupon_id)?.prefer_coupon_id ?? ""
                      }
                      className="ml-2 rounded border px-2 py-2"
                    >
                      <option value="">None</option>
                      {vendorCoupons.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code}
                          {c.percent_off ? ` - ${c.percent_off}%` : ""}
                          {c.amount_off ? ` - $${Number(c.amount_off).toFixed(2)}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    className="rounded px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Save
                  </button>
                </form>

                <div className="rounded-lg border p-3 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discount {label ? `(${label})` : ""}</span>
                    <span className="text-green-700">- ${discount.toFixed(2)}</span>
                  </div>
                  <div className="mt-2 border-t pt-2 flex justify-between font-semibold">
                    <span>Total</span>
                    <span>${(subtotal - discount).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Place order: open a new window */}
              <div className="flex justify-end">
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white"
                  title="Place Order (opens vendor in a new tab)"
                >
                  Place Order
                </a>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
