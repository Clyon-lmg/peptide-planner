'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';

// Minimal toast helpers (no extra deps)
function notify(msg: string) {
  // eslint-disable-next-line no-alert
  alert(msg);
  // Also log for dev
  console.log(msg);
}

// Known vendor URL param patterns for coupon pre-application (best-effort).
// If a vendor ignores URL params, we still copy the coupon code to clipboard.
const VENDOR_COUPON_PATTERNS: Record<number, { couponParam?: string }> = {
  10: { couponParam: 'coupon' }, // BioLongevity Labs (best guess)
  11: { couponParam: 'coupon' }, // Particle Peptides (best guess)
};

// Data shapes (lightweight, no project-local imports)
type CartRow = {
  id: number;
  user_id: string;
  vendor_id: number;
  peptide_id: number;
  quantity_vials: number;
  kind: 'vial' | 'capsule' | string | null;
  quantity_units: number | null;
  prefer_coupon_id: number | null;
  peptide_name: string;
  vendor_name: string;
};

type AffiliateLink = {
  id: number;
  vendor_id: number;
  base_url: string;
  param_key: string | null;
  param_value: string | null;
};

type Coupon = {
  id: number;
  vendor_id: number;
  code: string;
  percent_off: number | null;
  amount_off: number | null;
};

export default function CartPage() {
  const supabase = getSupabaseBrowser();
  const [rows, setRows] = useState<CartRow[]>([]);
  const [isPending, startTransition] = useTransition();

  // Load cart rows (join to peptide and vendor display fields)
  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;
      if (!userId) return;

      const { data, error } = await supabase
        .from('cart_items')
        .select(
          `
            id,
            user_id,
            vendor_id,
            peptide_id,
            quantity_vials,
            kind,
            quantity_units,
            prefer_coupon_id,
            peptides:peptide_id ( canonical_name ),
            vendors:vendor_id ( name )
          `
        )
        .eq('user_id', userId);

      if (error) {
        notify('Failed to load cart');
        return;
      }

      const normalized: CartRow[] =
        (data || []).map((r: any) => ({
          id: r.id,
          user_id: r.user_id,
          vendor_id: r.vendor_id,
          peptide_id: r.peptide_id,
          quantity_vials: r.quantity_vials,
          kind: r.kind,
          quantity_units: r.quantity_units,
          prefer_coupon_id: r.prefer_coupon_id,
          peptide_name: r.peptides?.canonical_name ?? 'Peptide',
          vendor_name: r.vendors?.name ?? `Vendor ${r.vendor_id}`,
        })) ?? [];

      setRows(normalized);
    })();
  }, [supabase]);

  const byVendor = useMemo(() => {
    const m = new Map<number, CartRow[]>();
    rows.forEach((r) => {
      if (!m.has(r.vendor_id)) m.set(r.vendor_id, []);
      m.get(r.vendor_id)!.push(r);
    });
    return m;
  }, [rows]);

  async function getAffiliateLink(vendorId: number): Promise<AffiliateLink | null> {
    const { data, error } = await supabase
      .from('affiliate_links')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('active', true)
      .limit(1)
      .maybeSingle();

    if (error) return null;
    return data as AffiliateLink | null;
  }

  async function getPreferredOrBestCoupon(
    vendorId: number,
    linePrefs: number[]
  ): Promise<Coupon | null> {
    // 1) If any line has prefer_coupon_id, honor it first
    if (linePrefs.length) {
      const { data } = await supabase
        .from('coupons')
        .select('*')
        .in('id', linePrefs)
        .limit(1);
      if (data && data.length) return data[0] as Coupon;
    }
    // 2) Otherwise choose best coupon for vendor (max percent_off, then amount_off)
    const { data } = await supabase
      .from('coupons')
      .select('*')
      .eq('vendor_id', vendorId);

    if (!data || !data.length) return null;

    const ranked = [...data].sort((a, b) => {
      const ap = Number(a.percent_off || 0);
      const bp = Number(b.percent_off || 0);
      if (bp !== ap) return bp - ap;
      const aa = Number(a.amount_off || 0);
      const ba = Number(b.amount_off || 0);
      return ba - aa;
    });
    return ranked[0] as Coupon;
  }

  function buildOutboundUrl(
    vendorId: number,
    affiliate: AffiliateLink | null,
    coupon: Coupon | null
  ) {
    let url = affiliate?.base_url || '';
    if (!url) return '';

    const pattern = VENDOR_COUPON_PATTERNS[vendorId];
    if (coupon?.code && pattern?.couponParam) {
      try {
        const u = new URL(url);
        if (!u.searchParams.has(pattern.couponParam)) {
          u.searchParams.set(pattern.couponParam, coupon.code);
        }
        url = u.toString();
      } catch {
        const sep = url.includes('?') ? '&' : '?';
        url = `${url}${sep}${pattern.couponParam}=${encodeURIComponent(
          coupon.code
        )}`;
      }
    }
    return url;
  }

  async function onVisitSite(vendorId: number) {
    const affiliate = await getAffiliateLink(vendorId);
    const url = affiliate?.base_url;
    if (!url) {
      notify('No affiliate link found for this vendor');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function onPlaceOrder(vendorId: number, lines: CartRow[]) {
    startTransition(async () => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;
      if (!userId) {
        notify('Please sign in');
        return;
      }

      const affiliate = await getAffiliateLink(vendorId);
      const preferIds = lines
        .map((l) => l.prefer_coupon_id)
        .filter((x): x is number => !!x);
      const coupon = await getPreferredOrBestCoupon(vendorId, preferIds);

      // 1) Create order (DRAFT)
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .insert({
          user_id: userId,
          vendor_id: vendorId,
          status: 'DRAFT',
        })
        .select('id')
        .single();

      if (orderErr || !orderData) {
        notify('Failed to create order');
        return;
      }
      const orderId = orderData.id as number;

      // 2) Create order_items
      const toInsert = lines.map((l) => ({
        order_id: orderId,
        peptide_id: l.peptide_id,
        quantity_vials: l.quantity_vials,
        mg_per_vial: 0,
        bac_ml: 0,
        unit_price: 0,
        coupon_id: coupon?.id ?? null,
        affiliate_link_id: affiliate?.id ?? null,
      }));

      const { error: itemsErr } = await supabase.from('order_items').insert(toInsert);
      if (itemsErr) {
        notify('Failed to attach items');
        return;
      }

      // 3) Open outbound (coupon best-effort) + copy coupon as fallback
      if (coupon?.code) {
        try {
          await navigator.clipboard.writeText(coupon.code);
          notify(`Coupon ${coupon.code} copied to clipboard`);
        } catch {
          // ignore
        }
      }

      const outbound = buildOutboundUrl(vendorId, affiliate, coupon);
      if (outbound) {
        window.open(outbound, '_blank', 'noopener,noreferrer');
      } else if (affiliate?.base_url) {
        window.open(affiliate.base_url, '_blank', 'noopener,noreferrer');
      } else {
        notify(
          coupon?.code
            ? `Use coupon ${coupon.code} at checkout`
            : 'Proceed to vendor site to complete purchase'
        );
      }

      // 4) (Optional) Remove lines from cart after creating DRAFT order
      const ids = lines.map((l) => l.id);
      await supabase.from('cart_items').delete().in('id', ids);
      setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
    });
  }

  if (!rows.length) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Cart</h1>
        <p>Your cart is empty.</p>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Cart</h1>

      {[...byVendor.entries()].map(([vendorId, lines]) => {
        const vendorName = lines[0]?.vendor_name ?? `Vendor ${vendorId}`;
        return (
          <section
            key={vendorId}
            className="rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm"
          >
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="text-lg font-medium">{vendorName}</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onVisitSite(vendorId)}
                  disabled={isPending}
                  className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  Visit site (affiliate)
                </button>
                <button
                  type="button"
                  onClick={() => onPlaceOrder(vendorId, lines)}
                  disabled={isPending}
                  className="px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
                >
                  Place order
                </button>
              </div>
            </div>

            <div className="p-4 space-y-2">
              {lines.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{l.peptide_name}</span>
                    <span className="text-sm opacity-70">
                      {l.kind ?? 'vial'} • qty {l.quantity_vials}
                      {l.quantity_units ? ` • units ${l.quantity_units}` : ''}
                    </span>
                  </div>
                  <div className="text-sm opacity-70">
                    Vendor #{l.vendor_id}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
