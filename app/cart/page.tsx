'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { bestOfferForVendorPeptide } from '@/lib/vendors';

type CartRow = {
    id: number;
    vendor_id: number;
    peptide_id: number;
    quantity_vials: number;
    vendors: { name: string };
    peptides: { canonical_name: string };
};

type PricedRow = CartRow & { unit_price: number; currency: string };

export default function CartPage() {
    const [rows, setRows] = useState<PricedRow[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { window.location.href = '/login'; return; }

        const { data } = await supabase
            .from('cart_items')
            .select('id, vendor_id, peptide_id, quantity_vials, vendors!inner(name), peptides!inner(canonical_name)')
            .order('id');

        const base = (data ?? []) as CartRow[];
        // attach pricing per line
        const priced: PricedRow[] = [];
        for (const line of base) {
            const offer = await bestOfferForVendorPeptide(line.vendor_id, line.peptide_id);
            priced.push({
                ...line,
                unit_price: offer?.effective_price ?? 0,
                currency: offer?.price_currency ?? 'USD',
            });
        }
        setRows(priced);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const grouped = useMemo(() => {
        const g: Record<number, PricedRow[]> = {};
        rows.forEach(r => { (g[r.vendor_id] = g[r.vendor_id] || []).push(r); });
        return g;
    }, [rows]);

    const updateQty = async (id: number, q: number) => {
        if (q <= 0) return;
        await supabase.from('cart_items').update({ quantity_vials: q }).eq('id', id);
        setRows(rs => rs.map(r => r.id === id ? { ...r, quantity_vials: q } : r));
    };

    const removeLine = async (id: number) => {
        await supabase.from('cart_items').delete().eq('id', id);
        setRows(rs => rs.filter(r => r.id !== id));
    };

    const placeOrder = async (vendor_id: number) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { window.location.href = '/login'; return; }
        const user_id = session.user.id;

        const lines = grouped[vendor_id] ?? [];
        if (!lines.length) return;

        const { data: order, error } = await supabase.from('orders').insert({
            user_id,
            vendor_id,
            status: 'DRAFT'
        }).select('id').single();
        if (error) { alert(error.message); return; }

        const items = lines.map(l => ({
            order_id: order.id,
            peptide_id: l.peptide_id,
            quantity_vials: l.quantity_vials
        }));
        const { error: e2 } = await supabase.from('order_items').insert(items);
        if (e2) { alert(e2.message); return; }

        const ids = lines.map(l => l.id);
        await supabase.from('cart_items').delete().in('id', ids);
        await load();

        const { data: aff } = await supabase.from('affiliate_links')
            .select('base_url, param_key, param_value')
            .eq('vendor_id', vendor_id).eq('active', true).maybeSingle();
        const url = aff?.base_url
            ? (aff.param_key && aff.param_value
                ? `${aff.base_url}?${encodeURIComponent(aff.param_key)}=${encodeURIComponent(aff.param_value)}`
                : aff.base_url)
            : undefined;
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
        alert('Order created as DRAFT and vendor page opened.');
    };

    if (loading) return <div>Loading…</div>;

    return (
        <div className="space-y-6">
            {Object.entries(grouped).map(([vendorId, list]) => {
                const total = list.reduce((s, l) => s + l.unit_price * l.quantity_vials, 0);
                const currency = list[0]?.currency ?? 'USD';
                return (
                    <div key={vendorId} className="rounded border border-neutral-200 dark:border-neutral-800 p-3">
                        <div className="flex items-center justify-between mb-2">
                            <div className="font-medium">{list[0]?.vendors.name ?? 'Vendor'}</div>
                            <div className="text-sm">Total: <b>{total.toFixed(2)} {currency}</b></div>
                        </div>
                        <div className="space-y-2">
                            {list.map(line => {
                                const lineTotal = line.unit_price * line.quantity_vials;
                                return (
                                    <div key={line.id} className="flex items-center justify-between gap-3 text-sm">
                                        <div className="flex-1">
                                            {line.peptides.canonical_name}
                                            <span className="ml-2 text-xs text-neutral-500">
                                                @ {line.unit_price.toFixed(2)} {line.currency} / vial
                                            </span>
                                        </div>
                                        <input
                                            type="number"
                                            min={1}
                                            value={line.quantity_vials}
                                            onChange={e => updateQty(line.id, parseInt(e.target.value || '1', 10))}
                                            className="w-20 px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent"
                                        />
                                        <div className="w-28 text-right">{lineTotal.toFixed(2)} {line.currency}</div>
                                        <button onClick={() => removeLine(line.id)} className="text-xs underline">Delete</button>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-3 text-right">
                            <button onClick={() => placeOrder(Number(vendorId))} className="text-sm underline">Place order</button>
                        </div>
                    </div>
                );
            })}
            {!rows.length && <div className="text-sm text-neutral-500">Your cart is empty.</div>}
        </div>
    );
}
