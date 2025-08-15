'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import InventoryCard from '@/components/InventoryCard';

type Row = {
    id: number;
    peptide_id: number;
    vials: number;
    mg_per_vial: number;
    bac_ml: number;
    peptides: { canonical_name: string };
};

type ProtoItem = {
    peptide_id: number;
    dose_mg_per_administration: number;
    schedule: 'EVERYDAY' | 'WEEKDAYS' | 'CUSTOM';
    custom_days: number[] | null;
};

export default function InventoryPage() {
    const [rows, setRows] = useState<Row[]>([]);
    const [protoMap, setProtoMap] = useState<Record<number, ProtoItem> | null>(null);
    const [loggedCountByPeptide, setLoggedCountByPeptide] = useState<Record<number, number>>({});
    const [loading, setLoading] = useState(true);
    const [nameInput, setNameInput] = useState('');

    const load = async () => {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); window.location.href = '/login'; return; }

        // Inventory rows (joined for display name)
        const { data: inv, error: eInv } = await supabase
            .from('inventory_items')
            .select('id, peptide_id, vials, mg_per_vial, bac_ml, peptides!inner(canonical_name)')
            .order('id');
        if (eInv) console.error(eInv);
        setRows(inv ?? []);

        // Active protocol → map items by peptide
        const { data: proto } = await supabase.from('protocols').select('id').eq('is_active', true).limit(1).maybeSingle();
        if (proto?.id) {
            const { data: items } = await supabase
                .from('protocol_items')
                .select('peptide_id, dose_mg_per_administration, schedule, custom_days')
                .eq('protocol_id', proto.id);
            const map: Record<number, ProtoItem> = {};
            (items ?? []).forEach(i => map[i.peptide_id] = i as any);
            setProtoMap(map);
        } else {
            setProtoMap({});
        }

        // All-time LOGGED dose rows for this user → aggregate per peptide_id in JS
        const { data: doseRows, error: eDose } = await supabase
            .from('doses')
            .select('peptide_id, status')
            .eq('status', 'LOGGED');
        if (eDose) console.error(eDose);
        const byPep: Record<number, number> = {};
        (doseRows ?? []).forEach((r: any) => {
            const pid = Number(r.peptide_id);
            byPep[pid] = (byPep[pid] ?? 0) + 1;
        });
        setLoggedCountByPeptide(byPep);

        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const addPeptide = async () => {
        const name = nameInput.trim();
        if (!name) return;
        setNameInput('');

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const user_id = session.user.id;

        // normalize key
        const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '').trim();

        // ensure catalog entry
        let pid: number | undefined;
        const { data: existingCatalog } = await supabase
            .from('peptides')
            .select('id, normalized_key, canonical_name')
            .eq('normalized_key', key)
            .maybeSingle();
        if (existingCatalog?.id) {
            pid = existingCatalog.id;
        } else {
            const display = name.toUpperCase().replace(/\s+/g, '-');
            const { data: created, error } = await supabase.from('peptides').insert({
                canonical_name: display,
                aliases: [name],
                normalized_key: key
            }).select('id').single();
            if (error) { alert(error.message); return; }
            pid = created.id;
        }

        // prevent duplicate inventory row for this peptide
        const { count } = await supabase
            .from('inventory_items')
            .select('id', { count: 'exact', head: true })
            .eq('peptide_id', pid);
        if ((count ?? 0) > 0) {
            alert('This peptide is already in your inventory.');
            return;
        }

        // create inventory row
        const { error: e2 } = await supabase.from('inventory_items').insert({
            user_id,
            peptide_id: pid,
            vials: 0, mg_per_vial: 0, bac_ml: 0
        });
        if (e2) { alert(e2.message); return; }
        await load();
    };

    if (loading) return <div>Loading…</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <input value={nameInput} onChange={e => setNameInput(e.target.value)}
                    placeholder="Add peptide by name…" className="px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent flex-1" />
                <button onClick={addPeptide} className="px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700">Add peptide</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rows.map(r => {
                    const pi = protoMap?.[r.peptide_id];
                    const consumed = loggedCountByPeptide[r.peptide_id] ?? 0; // all-time
                    return (
                        <InventoryCard
                            key={r.id}
                            id={r.id}
                            peptide_id={r.peptide_id}
                            name={r.peptides.canonical_name}
                            vials={r.vials}
                            mg_per_vial={r.mg_per_vial}
                            bac_ml={r.bac_ml}
                            dose_mg={pi?.dose_mg_per_administration ?? null}
                            schedule={pi?.schedule}
                            custom_days={pi?.custom_days ?? null}
                            consumed_doses={consumed}
                            onDeleted={load}
                        />
                    );
                })}
            </div>
            {!rows.length && (
                <div className="text-sm text-neutral-500">No inventory yet. Use "Add peptide" to create your first item.</div>
            )}
        </div>
    );
}
