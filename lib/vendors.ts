import { supabase } from '@/lib/supabaseClient';

export type Offer = {
    vendor_id: number;
    vendor_name: string;
    price: number;
    price_currency: string;
    mg_per_vial: number;
    bac_ml: number;
    effective_price: number;
    coupon_code?: string | null;
    affiliate_url?: string | null;
};

export async function topOffersForPeptide(peptide_id: number, limit = 3): Promise<Offer[]> {
    const { data: prods, error: e1 } = await supabase
        .from('vendor_products')
        .select('vendor_id, price, price_currency, mg_per_vial, bac_ml')
        .eq('peptide_id', peptide_id)
        .order('price', { ascending: true });
    if (e1) throw e1;
    if (!prods?.length) return [];

    const vendorIds = Array.from(new Set(prods.map(p => p.vendor_id)));
    const { data: vendors } = await supabase.from('vendors').select('id, name').in('id', vendorIds);
    const { data: coupons } = await supabase.from('coupons').select('vendor_id, code, percent_off, amount_off, expires_at').in('vendor_id', vendorIds);
    const { data: affs } = await supabase.from('affiliate_links').select('vendor_id, base_url, param_key, param_value, active').in('vendor_id', vendorIds);

    const now = new Date();
    const bestCouponByVendor = new Map<number, { code: string | null; percent: number; amount: number }>();
    (coupons ?? []).forEach(c => {
        if (c.expires_at && new Date(c.expires_at) < now) return;
        const pct = Number(c.percent_off ?? 0);
        const amt = Number(c.amount_off ?? 0);
        const cur = bestCouponByVendor.get(c.vendor_id);
        const score = (p: number, a: number) => (p > 0 ? p * 1.5 : 0) + a;
        if (!cur || score(pct, amt) > score(cur.percent, cur.amount)) {
            bestCouponByVendor.set(c.vendor_id, { code: c.code, percent: pct, amount: amt });
        }
    });

    const nameByVendor = new Map((vendors ?? []).map(v => [v.id, v.name]));
    const affByVendor = new Map((affs ?? []).filter(a => a.active).map(a => {
        const url = a.param_key && a.param_value
            ? `${a.base_url}?${encodeURIComponent(a.param_key)}=${encodeURIComponent(a.param_value)}`
            : a.base_url;
        return [a.vendor_id, url];
    }));

    const offers: Offer[] = prods.map(p => {
        const best = bestCouponByVendor.get(p.vendor_id) ?? { code: null, percent: 0, amount: 0 };
        const eff = Math.max(0, (Number(p.price) || 0) * (1 - best.percent / 100) - best.amount);
        return {
            vendor_id: p.vendor_id,
            vendor_name: nameByVendor.get(p.vendor_id) ?? `Vendor ${p.vendor_id}`,
            price: Number(p.price) || 0,
            price_currency: p.price_currency ?? 'USD',
            mg_per_vial: Number(p.mg_per_vial ?? 0),
            bac_ml: Number(p.bac_ml ?? 0),
            effective_price: eff,
            coupon_code: best.code,
            affiliate_url: affByVendor.get(p.vendor_id) ?? null
        };
    })
        .sort((a, b) => a.effective_price - b.effective_price)
        .slice(0, limit);

    return offers;
}

export async function bestOfferForVendorPeptide(vendor_id: number, peptide_id: number): Promise<Offer | null> {
    const { data: prod, error: e1 } = await supabase
        .from('vendor_products')
        .select('vendor_id, price, price_currency, mg_per_vial, bac_ml')
        .eq('vendor_id', vendor_id)
        .eq('peptide_id', peptide_id)
        .limit(1)
        .maybeSingle();
    if (e1) throw e1;
    if (!prod) return null;

    const { data: vend } = await supabase.from('vendors').select('id, name').eq('id', vendor_id).maybeSingle();
    const { data: coupRows } = await supabase.from('coupons').select('vendor_id, code, percent_off, amount_off, expires_at').eq('vendor_id', vendor_id);
    const { data: aff } = await supabase.from('affiliate_links').select('base_url, param_key, param_value, active').eq('vendor_id', vendor_id).maybeSingle();

    const now = new Date();
    let best = { code: null as string | null, percent: 0, amount: 0 };
    (coupRows ?? []).forEach(c => {
        if (c.expires_at && new Date(c.expires_at) < now) return;
        const pct = Number(c.percent_off ?? 0);
        const amt = Number(c.amount_off ?? 0);
        const score = (p: number, a: number) => (p > 0 ? p * 1.5 : 0) + a;
        const curScore = (best.percent > 0 ? best.percent * 1.5 : 0) + best.amount;
        if (score(pct, amt) > curScore) best = { code: c.code, percent: pct, amount: amt };
    });

    const eff = Math.max(0, (Number(prod.price) || 0) * (1 - best.percent / 100) - best.amount);
    const url = (aff?.active && aff.base_url)
        ? (aff.param_key && aff.param_value ? `${aff.base_url}?${encodeURIComponent(aff.param_key)}=${encodeURIComponent(aff.param_value)}` : aff.base_url)
        : null;

    return {
        vendor_id,
        vendor_name: vend?.name ?? `Vendor ${vendor_id}`,
        price: Number(prod.price) || 0,
        price_currency: prod.price_currency ?? 'USD',
        mg_per_vial: Number(prod.mg_per_vial ?? 0),
        bac_ml: Number(prod.bac_ml ?? 0),
        effective_price: eff,
        coupon_code: best.code,
        affiliate_url: url
    };
}
