'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import clsx from 'clsx';

type Protocol = { id: number; name: string; is_active: boolean };
type ProtoItem = {
    id: number;
    peptide_id: number;
    dose_mg_per_administration: number;
    schedule: 'EVERYDAY' | 'WEEKDAYS' | 'CUSTOM';
    custom_days: number[] | null;
    cycle_on_weeks: number;
    cycle_off_weeks: number;
    peptides?: { canonical_name: string }; // joined name
};

type InventoryPeptide = { peptide_id: number; canonical_name: string };
type CatalogPeptide = { id: number; canonical_name: string };

export default function ProtocolPage() {
    const [protocols, setProtocols] = useState<Protocol[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [items, setItems] = useState<ProtoItem[]>([]);
    const [invPeptides, setInvPeptides] = useState<InventoryPeptide[]>([]);
    const [catalog, setCatalog] = useState<CatalogPeptide[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [status, setStatus] = useState<string>('');

    const selectedProtocol = useMemo(
        () => protocols.find(p => p.id === selectedId) ?? null,
        [protocols, selectedId]
    );

    const ensureSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { window.location.href = '/login'; throw new Error('No session'); }
        return session;
    };

    const load = async (keepSelection = true) => {
        setLoading(true);
        const session = await ensureSession();

        // Protocols for this user
        const { data: protos, error: eP } = await supabase
            .from('protocols')
            .select('id, name, is_active')
            .order('created_at', { ascending: true });
        if (eP) console.error(eP);
        setProtocols(protos ?? []);

        // Keep selection or default to first available
        let nextSelected = selectedId;
        if (!keepSelection || !nextSelected) {
            nextSelected = protos?.[0]?.id ?? null;
        }
        setSelectedId(nextSelected);

        // Items (join peptide names)
        if (nextSelected) {
            const { data: its, error: eI } = await supabase
                .from('protocol_items')
                .select(`
          id,
          peptide_id,
          dose_mg_per_administration,
          schedule,
          custom_days,
          cycle_on_weeks,
          cycle_off_weeks,
          peptides!inner(canonical_name)
        `)
                .eq('protocol_id', nextSelected)
                .order('id', { ascending: true });
            if (eI) console.error(eI);
            setItems((its as any) ?? []);
        } else {
            setItems([]);
        }

        // Distinct peptides from inventory (inner join to labels)
        const { data: inv, error: eInv } = await supabase
            .from('inventory_items')
            .select('peptide_id, peptides!inner(canonical_name)');
        if (eInv) console.error(eInv);
        const invRows = (inv ?? []).map((r: any) => ({
            peptide_id: r.peptide_id,
            canonical_name: r.peptides.canonical_name
        }));
        // de-dup by peptide_id
        const uniq: Record<number, InventoryPeptide> = {};
        invRows.forEach((r) => { uniq[r.peptide_id] = r; });
        setInvPeptides(Object.values(uniq));

        // Full catalog (fallback for picker)
        const { data: cats, error: eCat } = await supabase
            .from('peptides')
            .select('id, canonical_name')
            .order('id', { ascending: true });
        if (eCat) console.error(eCat);
        setCatalog(cats ?? []);

        setLoading(false);
    };

    useEffect(() => { load(true); /* initial */ }, []);

    const addProtocol = async () => {
        const session = await ensureSession();
        const name = prompt('New protocol name?')?.trim();
        if (!name) return;
        const { data, error } = await supabase
            .from('protocols')
            .insert({ user_id: session.user.id, name })
            .select('id')
            .single();
        if (error) { alert(error.message); return; }
        setStatus('Protocol created.');
        await load(false);
        setSelectedId(data.id);
    };

    const deleteProtocol = async (id: number) => {
        if (!confirm('Delete this protocol?')) return;
        const { error } = await supabase.from('protocols').delete().eq('id', id);
        if (error) { alert(error.message); return; }
        if (selectedId === id) setSelectedId(null);
        await load(false);
    };

    const renameProtocol = async (id: number) => {
        const current = protocols.find(p => p.id === id)?.name ?? '';
        const name = prompt('Rename protocol', current)?.trim();
        if (!name) return;
        const { error } = await supabase.from('protocols').update({ name }).eq('id', id);
        if (error) { alert(error.message); return; }
        setProtocols(ps => ps.map(p => p.id === id ? { ...p, name } : p));
    };

    const setActive = async (id: number) => {
        // deactivate others for this user, then activate selected
        await supabase.from('protocols').update({ is_active: false }).neq('id', id);
        await supabase.from('protocols').update({ is_active: true }).eq('id', id);
        setProtocols(ps => ps.map(p => ({ ...p, is_active: p.id === id })));
    };

    const selectProtocol = async (id: number) => {
        setSelectedId(id);
        // when selection changes, load items (with peptide names)
        const { data: its, error } = await supabase
            .from('protocol_items')
            .select(`
        id,
        peptide_id,
        dose_mg_per_administration,
        schedule,
        custom_days,
        cycle_on_weeks,
        cycle_off_weeks,
        peptides!inner(canonical_name)
      `)
            .eq('protocol_id', id)
            .order('id');
        if (error) console.error(error);
        setItems((its as any) ?? []);
    };

    const addItem = async () => {
        if (!selectedId) return;
        // Build a simple picker list (inventory first, then catalog)
        const opts = (invPeptides.length ? invPeptides.map(p => `${p.peptide_id}|${p.canonical_name}`)
            : catalog.map(c => `${c.id}|${c.canonical_name}`));
        if (!opts.length) { alert('No peptides available in inventory or catalog. Add one in Inventory first.'); return; }
        const promptText = `Choose peptide by typing its number:\n` +
            opts.map((o, i) => `${i + 1}. ${o.split('|')[1]}`).join('\n');
        const choice = prompt(promptText)?.trim();
        if (!choice) return;
        const index = parseInt(choice, 10) - 1;
        if (Number.isNaN(index) || index < 0 || index >= opts.length) return;
        const [peptideIdStr, peptideName] = opts[index].split('|');
        const peptide_id = Number(peptideIdStr);

        const payload = {
            protocol_id: selectedId,
            peptide_id,
            dose_mg_per_administration: 0.5,
            schedule: 'EVERYDAY' as const,
            custom_days: null,
            cycle_on_weeks: 0,
            cycle_off_weeks: 0
        };

        const { data, error } = await supabase
            .from('protocol_items')
            .insert(payload)
            .select(`
        id,
        peptide_id,
        dose_mg_per_administration,
        schedule,
        custom_days,
        cycle_on_weeks,
        cycle_off_weeks
      `)
            .single();
        if (error) { alert(error.message); return; }

        // optimistic append with peptide name
        setItems(its => its.concat({
            ...data,
            peptides: { canonical_name: peptideName }
        } as any));
    };

    const updateItem = async (id: number, patch: Partial<ProtoItem>) => {
        setItems(its => its.map(i => i.id === id ? { ...i, ...patch } : i));
        const payload: any = {};
        if (patch.dose_mg_per_administration !== undefined) payload.dose_mg_per_administration = patch.dose_mg_per_administration;
        if (patch.schedule !== undefined) payload.schedule = patch.schedule;
        if (patch.custom_days !== undefined) payload.custom_days = patch.custom_days;
        if (patch.cycle_on_weeks !== undefined) payload.cycle_on_weeks = patch.cycle_on_weeks;
        if (patch.cycle_off_weeks !== undefined) payload.cycle_off_weeks = patch.cycle_off_weeks;
        const { error } = await supabase.from('protocol_items').update(payload).eq('id', id);
        if (error) { alert(error.message); await selectProtocol(selectedId!); }
    };

    const removeItem = async (id: number) => {
        if (!confirm('Remove this item?')) return;
        const { error } = await supabase.from('protocol_items').delete().eq('id', id);
        if (error) { alert(error.message); return; }
        setItems(its => its.filter(i => i.id !== id));
    };

    const toggleCustomDay = (item: ProtoItem, day: number) => {
        const days = new Set(item.custom_days ?? []);
        if (days.has(day)) days.delete(day); else days.add(day);
        updateItem(item.id, { custom_days: Array.from(days).sort() as any });
    };

    if (loading) return <div>Loading…</div>;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left: protocol list */}
            <div className="md:col-span-1">
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-lg font-semibold">Protocols</h1>
                    <button onClick={addProtocol} className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 text-xs">Add</button>
                </div>
                <div className="space-y-2">
                    {protocols.map(p => (
                        <div key={p.id} className={clsx(
                            'rounded border p-2',
                            p.id === selectedId ? 'border-blue-500' : 'border-neutral-200 dark:border-neutral-800'
                        )}>
                            <div className="flex items-center justify-between">
                                <button onClick={() => selectProtocol(p.id)} className="font-medium text-left">{p.name}</button>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => renameProtocol(p.id)} className="text-xs underline">Rename</button>
                                    <button onClick={() => deleteProtocol(p.id)} className="text-xs underline">Delete</button>
                                </div>
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-sm">
                                <input type="radio" checked={p.is_active} onChange={() => setActive(p.id)} />
                                <span>Active</span>
                            </div>
                        </div>
                    ))}
                    {!protocols.length && <div className="text-sm text-neutral-500">No protocols yet.</div>}
                </div>
            </div>

            {/* Right: builder */}
            <div className="md:col-span-2">
                <h2 className="font-semibold mb-2">Protocol Builder</h2>
                {!selectedProtocol ? (
                    <div className="text-sm text-neutral-500">Select or create a protocol.</div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <label className="text-sm w-24">Name</label>
                            <input
                                className="flex-1 px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent"
                                value={selectedProtocol.name}
                                onChange={async (e) => {
                                    const name = e.target.value;
                                    setProtocols(ps => ps.map(p => p.id === selectedProtocol.id ? { ...p, name } : p));
                                    await supabase.from('protocols').update({ name }).eq('id', selectedProtocol.id);
                                }}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <h3 className="font-medium">Items</h3>
                            <button onClick={addItem} className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 text-xs">
                                Add peptide
                            </button>
                        </div>

                        <div className="space-y-3">
                            {items.map(item => (
                                <div key={item.id} className="rounded border border-neutral-200 dark:border-neutral-800 p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm">
                                            Peptide: <b>{item.peptides?.canonical_name ?? item.peptide_id}</b>
                                        </div>
                                        <button onClick={() => removeItem(item.id)} className="text-xs underline">Remove</button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-sm">Dose (mg)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent"
                                                value={item.dose_mg_per_administration}
                                                onChange={(e) => updateItem(item.id, { dose_mg_per_administration: parseFloat(e.target.value || '0') })}
                                            />
                                        </div>

                                        <div className="flex flex-col">
                                            <label className="text-sm mb-1">Schedule</label>
                                            <div className="flex flex-wrap gap-2">
                                                {(['EVERYDAY', 'WEEKDAYS', 'CUSTOM'] as const).map(s => (
                                                    <button
                                                        key={s}
                                                        className={clsx(
                                                            'px-2 py-1 rounded border text-xs',
                                                            item.schedule === s ? 'border-blue-500' : 'border-neutral-300 dark:border-neutral-700'
                                                        )}
                                                        onClick={() => updateItem(item.id, { schedule: s })}
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-sm">Cycle (weeks on/off)</label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    className="w-24 px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent"
                                                    value={item.cycle_on_weeks}
                                                    onChange={(e) => updateItem(item.id, { cycle_on_weeks: parseInt(e.target.value || '0', 10) })}
                                                />
                                                <span className="text-sm">on</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    className="w-24 px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent"
                                                    value={item.cycle_off_weeks}
                                                    onChange={(e) => updateItem(item.id, { cycle_off_weeks: parseInt(e.target.value || '0', 10) })}
                                                />
                                                <span className="text-sm">off</span>
                                            </div>
                                        </div>

                                        {item.schedule === 'CUSTOM' && (
                                            <div className="sm:col-span-2">
                                                <label className="block text-sm mb-1">Custom days (Sun..Sat)</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                                                        <button
                                                            key={d}
                                                            className={clsx(
                                                                'px-2 py-1 rounded border text-xs',
                                                                (item.custom_days ?? []).includes(d)
                                                                    ? 'border-blue-500'
                                                                    : 'border-neutral-300 dark:border-neutral-700'
                                                            )}
                                                            onClick={() => toggleCustomDay(item, d)}
                                                        >
                                                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {!items.length && <div className="text-sm text-neutral-500">No items yet. Add a peptide.</div>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
