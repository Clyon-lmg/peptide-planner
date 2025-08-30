'use client';
import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';
import { concentrationMgPerMl, projectedRunoutDate, freqPerWeek } from '@/lib/calc';
import { topOffersForPeptide, Offer } from '@/lib/vendors';
import Card from './layout/Card';

type Props = {
    id: number;
    peptide_id: number;
    name: string;
    vials: number;
    mg_per_vial: number;
    bac_ml: number;
    dose_mg?: number | null;
    schedule?: 'EVERYDAY' | 'WEEKDAYS' | 'CUSTOM' | 'EVERY_N_DAYS';
    custom_days?: number[] | null;
    every_n_days?: number | null;
    consumed_doses?: number; // all-time LOGGED
    onDeleted?: () => void;
};

const supabase = getSupabaseBrowser();

export default function InventoryCard(p: Props) {
    const [state, setState] = useState(p);
    const [offers, setOffers] = useState<Offer[] | null>(null);

    const conc = concentrationMgPerMl(state.mg_per_vial, state.bac_ml);
    const totalMg = Number(state.vials ?? 0) * Number(state.mg_per_vial ?? 0);

    // Derived mg remaining after all-time logged doses
    const remainingMg = useMemo(() => {
        if (!state.dose_mg || state.dose_mg <= 0) return totalMg;
        const consumed = Number(state.consumed_doses ?? 0);
        const usedMg = consumed * state.dose_mg;
        return Math.max(0, totalMg - usedMg);
    }, [totalMg, state.dose_mg, state.consumed_doses]);

    // Doses remaining (floor)
    const remainingDoses = useMemo(() => {
        if (!state.dose_mg || state.dose_mg <= 0) return null;
        return Math.floor(remainingMg / state.dose_mg);
    }, [remainingMg, state.dose_mg]);

    // Units per dose (U-100)
    const units = useMemo(() => {
        if (!conc || !state.dose_mg) return null;
        const ml = state.dose_mg / conc;
        return Math.round(ml * 100);
    }, [conc, state.dose_mg]);

    // Computed vials remaining (display-only)
    const vialsRemaining = useMemo(() => {
        if (!state.mg_per_vial || state.mg_per_vial <= 0) return null;
        return Math.floor(remainingMg / state.mg_per_vial);
    }, [remainingMg, state.mg_per_vial]);

    const freq = state.schedule ? freqPerWeek(state.schedule, state.custom_days, state.every_n_days ?? undefined) : 0;
    const runout = remainingDoses ? projectedRunoutDate(remainingDoses, freq || 1) : null;

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const o = await topOffersForPeptide(p.peptide_id, 3);
                if (!cancelled) setOffers(o);
            } catch {
                if (!cancelled) setOffers([]);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [p.peptide_id]);

    const updateField = async (patch: Partial<Props>) => {
        setState(s => ({ ...s, ...patch }));
        const payload: any = {};
        if (patch.vials !== undefined) payload.vials = patch.vials;
        if (patch.mg_per_vial !== undefined) payload.mg_per_vial = patch.mg_per_vial;
        if (patch.bac_ml !== undefined) payload.bac_ml = patch.bac_ml;
        if (Object.keys(payload).length) {
            await supabase.from('inventory_items').update(payload).eq('id', p.id);
        }
    };

    const del = async () => {
        if (!confirm(`Delete ${p.name} from inventory?`)) return;
        await supabase.from('inventory_items').delete().eq('id', p.id);
        p.onDeleted?.();
    };

    const addToCart = async (offer: Offer) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        await supabase.from('cart_items').insert({
            user_id: session.user.id,
            vendor_id: offer.vendor_id,
            peptide_id: p.peptide_id,
            quantity_vials: 1
        });
        // Optional: open vendor page with affiliate tag for convenience
        if (offer.affiliate_url) window.open(offer.affiliate_url, '_blank', 'noopener,noreferrer');
        alert('Added to cart');
    };

    return (
        <Card className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="font-medium">{p.name}</div>
                <button onClick={del} className="text-xs underline text-red-600">Delete</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                    <label className="block text-xs mb-1">Vials (entered)</label>
                    <input
                        type="number" min={0}
                        className="w-full px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent"
                        value={state.vials}
                        onChange={e => updateField({ vials: parseInt(e.target.value || '0', 10) })}
                    />
                </div>
                <div>
                    <label className="block text-xs mb-1">mg / vial</label>
                    <input
                        type="number" step="0.01" min={0}
                        className="w-full px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent"
                        value={state.mg_per_vial}
                        onChange={e => updateField({ mg_per_vial: parseFloat(e.target.value || '0') })}
                    />
                </div>
                <div>
                    <label className="block text-xs mb-1">BAC ml</label>
                    <input
                        type="number" step="0.01" min={0}
                        className="w-full px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent"
                        value={state.bac_ml}
                        onChange={e => updateField({ bac_ml: parseFloat(e.target.value || '0') })}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>Concentration: <b>{conc ? conc.toFixed(2) : '—'} mg/ml</b></div>
                <div>Units per dose: <b>{units ?? '—'}</b></div>
                <div>Remaining doses: <b>{remainingDoses ?? '—'}</b></div>
                <div>Vials remaining (computed): <b>{vialsRemaining ?? '—'}</b></div>
                <div className="col-span-2">Projected run‑out: <b>{runout ?? '—'}</b></div>
            </div>

            <Card className="p-2">
                <div className="text-xs mb-2">Top offers</div>
                {!offers && <div className="text-xs text-neutral-500">Loading offers…</div>}
                {offers && offers.length === 0 && <div className="text-xs text-neutral-500">No offers available.</div>}
                {offers && offers.length > 0 && (
                    <div className="space-y-2">
                        {offers.map((o, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                                <div>
                                    {o.vendor_name} — {o.effective_price.toFixed(2)} {o.price_currency}
                                    {o.coupon_code ? ` (coupon ${o.coupon_code})` : ''}
                                </div>
                                <div className="flex items-center gap-2">
                                    {o.affiliate_url && (
                                        <a href={o.affiliate_url} target="_blank" className="text-xs underline">Open</a>
                                    )}
                                    <button onClick={() => addToCart(o)} className="text-xs underline">Add to cart</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </Card>
    );
}
