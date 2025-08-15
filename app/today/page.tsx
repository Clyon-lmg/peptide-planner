'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { concentrationMgPerMl, unitsForDose, remainingDoses } from '@/lib/calc';

type Item = {
    peptide_id: number;
    dose_mg_per_administration: number;
    peptides: { canonical_name: string };
};

type Inv = { peptide_id: number; vials: number; mg_per_vial: number; bac_ml: number };
type DoseStatus = 'LOGGED' | 'SKIPPED' | null;

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function TodayPage() {
    const [protocolId, setProtocolId] = useState<number | null>(null);
    const [items, setItems] = useState<Item[]>([]);
    const [invMap, setInvMap] = useState<Record<number, Inv>>({});
    const [statusByPeptide, setStatusByPeptide] = useState<Record<number, DoseStatus>>({});
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); window.location.href = '/login'; return; }

        // Active protocol
        const { data: active } = await supabase
            .from('protocols').select('id').eq('is_active', true).limit(1).maybeSingle();
        if (!active?.id) {
            setProtocolId(null);
            setItems([]);
            setInvMap({});
            setStatusByPeptide({});
            setLoading(false);
            return;
        }
        setProtocolId(active.id);

        // Protocol items (include names & dose)
        const { data: its } = await supabase
            .from('protocol_items')
            .select('peptide_id, dose_mg_per_administration, peptides!inner(canonical_name)')
            .eq('protocol_id', active.id)
            .order('id');
        setItems((its as any) ?? []);

        // Inventory for cards
        const { data: inv } = await supabase
            .from('inventory_items')
            .select('peptide_id, vials, mg_per_vial, bac_ml');
        const m: Record<number, Inv> = {};
        (inv ?? []).forEach((r: any) => { m[r.peptide_id] = r; });
        setInvMap(m);

        // Today’s statuses
        const { data: doses } = await supabase
            .from('doses')
            .select('peptide_id, date_for, status')
            .eq('date_for', todayISO());
        const st: Record<number, DoseStatus> = {};
        (doses ?? []).forEach((d: any) => { st[d.peptide_id] = d.status; });
        setStatusByPeptide(st);

        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    // Helper to write (insert/update) a dose row including all required columns
    const writeDose = async (peptide_id: number, dose_mg: number, status: 'LOGGED' | 'SKIPPED') => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !protocolId) return;
        const user_id = session.user.id;
        const date_for = todayISO();
        const date_alias = date_for; // support schemas that also require "date" NOT NULL

        // optimistic UI
        setStatusByPeptide(s => ({ ...s, [peptide_id]: status }));

        // Is there an existing row for (today, peptide)?
        const { data: existing } = await supabase
            .from('doses')
            .select('id')
            .eq('peptide_id', peptide_id)
            .eq('date_for', date_for)
            .limit(1)
            .maybeSingle();

        if (existing?.id) {
            const { error } = await supabase
                .from('doses')
                .update({ status, protocol_id: protocolId, date_for, date: date_alias, dose_mg })
                .eq('id', existing.id);
            if (error) { alert(error.message); await load(); }
        } else {
            const { error } = await supabase
                .from('doses')
                .insert({ user_id, peptide_id, status, protocol_id: protocolId, date_for, date: date_alias, dose_mg });
            if (error) { alert(error.message); await load(); }
        }
    };

    const onLog = (peptide_id: number, dose_mg: number) => writeDose(peptide_id, dose_mg, 'LOGGED');
    const onSkip = (peptide_id: number, dose_mg: number) => writeDose(peptide_id, dose_mg, 'SKIPPED');

    const remainingWithToday = (doseMg: number, inv?: Inv | null, st?: DoseStatus) => {
        if (!inv) return null;
        const totalMg = Number(inv.vials ?? 0) * Number(inv.mg_per_vial ?? 0);
        const base = remainingDoses(totalMg, doseMg);
        if (base == null) return null;
        const delta = st === 'LOGGED' ? -1 : 0; // today's immediate effect
        return Math.max(0, base + delta);
    };

    if (loading) return <div>Loading…</div>;
    if (!items.length) return <div className="text-sm text-neutral-500">No doses scheduled for today.</div>;

    return (
        <div className="space-y-4">
            {items.map(it => {
                const inv = invMap[it.peptide_id] ?? null;
                const name = it.peptides?.canonical_name ?? it.peptide_id.toString();
                const mgPerMl = inv ? concentrationMgPerMl(inv.mg_per_vial, inv.bac_ml) : null;
                const units = mgPerMl ? unitsForDose(it.dose_mg_per_administration, mgPerMl) : null;
                const st = statusByPeptide[it.peptide_id] ?? null;
                const rem = remainingWithToday(it.dose_mg_per_administration, inv, st);

                return (
                    <div key={it.peptide_id} className="rounded border border-neutral-200 dark:border-neutral-800 p-3">
                        <div className="flex items-center justify-between mb-2">
                            <div className="font-medium">{name}</div>
                            <div className="text-xl">{st === 'LOGGED' ? '✓' : st === 'SKIPPED' ? '✕' : ''}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>Dose: <b>{it.dose_mg_per_administration} mg</b></div>
                            <div>Units: <b>{units ?? '—'}</b></div>
                            <div className="col-span-2">Remaining doses: <b>{rem ?? '—'}</b></div>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                            <button
                                onClick={() => onLog(it.peptide_id, it.dose_mg_per_administration)}
                                className="px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700"
                            >
                                Log
                            </button>
                            <button
                                onClick={() => onSkip(it.peptide_id, it.dose_mg_per_administration)}
                                className="px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700"
                            >
                                Skip
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
