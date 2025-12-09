"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, Save, X, Activity, Calendar } from "lucide-react";
import Card from "@/components/layout/Card";
import type { SaveVialPayload, SaveCapsPayload } from "../actions";

export type VialItem = {
    id: number;
    peptide_id: number;
    canonical_name: string;
    vials: number;
    mg_per_vial: number;
    bac_ml: number;
    half_life_hours: number;
    remainingDoses: number | null;
    reorderDateISO: string | null;
};

export type CapsuleItem = {
    id: number;
    peptide_id: number;
    canonical_name: string;
    bottles: number;
    caps_per_bottle: number;
    mg_per_cap: number;
    half_life_hours: number;
    remainingDoses: number | null;
    reorderDateISO: string | null;
};

export type InventoryListProps = {
    vials: VialItem[];
    capsules: CapsuleItem[];
    onSaveVial?: (payload: SaveVialPayload) => Promise<void> | void;
    onSaveCapsule?: (payload: SaveCapsPayload) => Promise<void> | void;
    onDeleteVial?: (id: number) => Promise<void> | void;
    onDeleteCapsule?: (id: number) => Promise<void> | void;
};

function parseNum(value: string, allowEmpty = true) {
    if (allowEmpty && value.trim() === "") return undefined;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
}

export default function InventoryList({
    vials,
    capsules,
    onSaveVial,
    onSaveCapsule,
    onDeleteVial,
    onDeleteCapsule,
}: InventoryListProps) {
    const [vialEdits, setVialEdits] = React.useState<Record<number, SaveVialPayload>>({});
    const [capsEdits, setCapsEdits] = React.useState<Record<number, SaveCapsPayload>>({});
    const [savingIds, setSavingIds] = React.useState<Set<string>>(new Set());
    const router = useRouter();

    const currentVialValue = (item: VialItem, field: any) => (vialEdits[item.id] as any)?.[field] ?? (item as any)[field];
    const currentCapsValue = (item: CapsuleItem, field: any) => (capsEdits[item.id] as any)?.[field] ?? (item as any)[field];

    const isVialDirty = (item: VialItem) => {
        const e = vialEdits[item.id];
        if (!e) return false;
        return (e.vials !== undefined && Number(e.vials) !== Number(item.vials)) ||
            (e.mg_per_vial !== undefined && Number(e.mg_per_vial) !== Number(item.mg_per_vial)) ||
            (e.bac_ml !== undefined && Number(e.bac_ml) !== Number(item.bac_ml)) ||
            (e.half_life_hours !== undefined && Number(e.half_life_hours) !== Number(item.half_life_hours));
    };

    const isCapsDirty = (item: CapsuleItem) => {
        const e = capsEdits[item.id];
        if (!e) return false;
        return (e.bottles !== undefined && Number(e.bottles) !== Number(item.bottles)) ||
            (e.caps_per_bottle !== undefined && Number(e.caps_per_bottle) !== Number(item.caps_per_bottle)) ||
            (e.mg_per_cap !== undefined && Number(e.mg_per_cap) !== Number(item.mg_per_cap)) ||
            (e.half_life_hours !== undefined && Number(e.half_life_hours) !== Number(item.half_life_hours));
    };

    const onChangeVial = (id: number, field: any, value: any) => setVialEdits(p => ({ ...p, [id]: { ...(p[id] ?? { id }), id, [field]: value } }));
    const onChangeCaps = (id: number, field: any, value: any) => setCapsEdits(p => ({ ...p, [id]: { ...(p[id] ?? { id }), id, [field]: value } }));

    const clearVial = (id: number) => setVialEdits(p => { const n = { ...p }; delete n[id]; return n; });
    const clearCaps = (id: number) => setCapsEdits(p => { const n = { ...p }; delete n[id]; return n; });

    const saveWrapper = async (key: string, fn: () => Promise<void>) => {
        setSavingIds((s) => new Set(s).add(key));
        try { await fn(); } finally { setSavingIds((s) => { const n = new Set(s); n.delete(key); return n; }); }
    };

    const handleSaveVial = async (item: VialItem) => {
        if (!onSaveVial) return;
        const edited = vialEdits[item.id];
        if (!edited) return;
        // Fix: Spread 'edited' first, then overwrite 'id' to satisfy TS
        const payload: SaveVialPayload = { ...edited, id: item.id };
        await saveWrapper(`vial-${item.id}`, async () => { await onSaveVial(payload); clearVial(item.id); router.refresh(); });
    };

    const handleSaveCaps = async (item: CapsuleItem) => {
        if (!onSaveCapsule) return;
        const edited = capsEdits[item.id];
        if (!edited) return;
        // Fix: Spread 'edited' first
        const payload: SaveCapsPayload = { ...edited, id: item.id };
        await saveWrapper(`cap-${item.id}`, async () => { await onSaveCapsule(payload); clearCaps(item.id); router.refresh(); });
    };

    const handleDeleteVial = async (id: number) => {
        if (!onDeleteVial || !confirm("Delete item?")) return;
        await saveWrapper(`vial-${id}`, async () => { await onDeleteVial(id); router.refresh(); });
    };

    const handleDeleteCaps = async (id: number) => {
        if (!onDeleteCapsule || !confirm("Delete item?")) return;
        await saveWrapper(`cap-${id}`, async () => { await onDeleteCapsule(id); router.refresh(); });
    };

    const InputGroup = ({ label, value, onChange, disabled, step = 1, type = "number" }: any) => (
        <div className="flex flex-col gap-1.5 min-w-0">
            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider truncate">{label}</label>
            <input
                type={type}
                step={step}
                min={0}
                value={String(value ?? "")}
                onChange={e => onChange(parseNum(e.target.value))}
                disabled={disabled}
                className="input font-mono text-sm px-2"
            />
        </div>
    );

    return (
        <div className="space-y-10">
            {/* Vials */}
            <section>
                <h2 className="pp-h2 mb-4">Vials</h2>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {vials.length === 0 && <p className="text-muted-foreground text-sm">No vials in inventory.</p>}
                    {vials.map((item) => {
                        const dirty = isVialDirty(item);
                        const saving = savingIds.has(`vial-${item.id}`);
                        return (
                            <Card key={item.id} className="relative group hover:border-primary/20 transition-colors">
                                <div className="flex items-start justify-between mb-5">
                                    <div className="flex flex-col min-w-0">
                                        <h3 className="font-bold text-lg leading-tight truncate pr-2">{item.canonical_name}</h3>
                                        {item.remainingDoses !== null && (
                                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                <span className="inline-flex items-center text-xs font-medium text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
                                                    <Activity className="w-3 h-3 mr-1" />
                                                    {item.remainingDoses} doses
                                                </span>
                                                <span className="inline-flex items-center text-xs text-muted-foreground bg-muted/10 px-2 py-0.5 rounded">
                                                    <Calendar className="w-3 h-3 mr-1 opacity-70" />
                                                    {item.reorderDateISO ?? "—"}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleDeleteVial(item.id)}
                                        className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground/50 transition-colors"
                                        disabled={saving}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-4 gap-3">
                                    <InputGroup label="Vials" value={currentVialValue(item, "vials")} onChange={(v: number) => onChangeVial(item.id, "vials", v)} disabled={saving} />
                                    <InputGroup label="mg/vial" value={currentVialValue(item, "mg_per_vial")} onChange={(v: number) => onChangeVial(item.id, "mg_per_vial", v)} disabled={saving} step={0.1} />
                                    <InputGroup label="mL BAC" value={currentVialValue(item, "bac_ml")} onChange={(v: number) => onChangeVial(item.id, "bac_ml", v)} disabled={saving} step={0.1} />
                                    <InputGroup label="Half-life" value={currentVialValue(item, "half_life_hours")} onChange={(v: number) => onChangeVial(item.id, "half_life_hours", v)} disabled={saving} step={0.1} />
                                </div>

                                {dirty && (
                                    <div className="absolute bottom-4 right-4 flex items-center gap-2 animate-in fade-in zoom-in-95">
                                        <button onClick={() => clearVial(item.id)} className="btn h-9 w-9 p-0 rounded-full border-muted hover:bg-muted/20"><X className="w-4 h-4" /></button>
                                        <button onClick={() => handleSaveVial(item)} disabled={saving} className="btn h-9 px-4 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-md flex items-center gap-2">
                                            {saving ? "..." : <><Save className="w-4 h-4" /> Save</>}
                                        </button>
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            </section>

            {/* Capsules */}
            <section>
                <h2 className="pp-h2 mb-4">Capsules</h2>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {capsules.length === 0 && <p className="text-muted-foreground text-sm">No capsules in inventory.</p>}
                    {capsules.map((item) => {
                        const dirty = isCapsDirty(item);
                        const saving = savingIds.has(`cap-${item.id}`);
                        return (
                            <Card key={item.id} className="relative group">
                                <div className="flex items-start justify-between mb-5">
                                    <div className="flex flex-col min-w-0">
                                        <h3 className="font-bold text-lg leading-tight truncate pr-2">{item.canonical_name}</h3>
                                        {item.remainingDoses !== null && (
                                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                <span className="inline-flex items-center text-xs font-medium text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
                                                    <Activity className="w-3 h-3 mr-1" />
                                                    {item.remainingDoses} doses
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => handleDeleteCaps(item.id)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground/50 transition-colors" disabled={saving}><Trash2 className="w-4 h-4" /></button>
                                </div>

                                <div className="grid grid-cols-4 gap-3">
                                    <InputGroup label="Bottles" value={currentCapsValue(item, "bottles")} onChange={(v: number) => onChangeCaps(item.id, "bottles", v)} disabled={saving} />
                                    <InputGroup label="Caps/Btl" value={currentCapsValue(item, "caps_per_bottle")} onChange={(v: number) => onChangeCaps(item.id, "caps_per_bottle", v)} disabled={saving} />
                                    <InputGroup label="mg/cap" value={currentCapsValue(item, "mg_per_cap")} onChange={(v: number) => onChangeCaps(item.id, "mg_per_cap", v)} disabled={saving} step={0.1} />
                                    <InputGroup label="Half-life" value={currentCapsValue(item, "half_life_hours")} onChange={(v: number) => onChangeCaps(item.id, "half_life_hours", v)} disabled={saving} step={0.1} />
                                </div>

                                {dirty && (
                                    <div className="absolute bottom-4 right-4 flex items-center gap-2 animate-in fade-in zoom-in-95">
                                        <button onClick={() => clearCaps(item.id)} className="btn h-9 w-9 p-0 rounded-full border-muted hover:bg-muted/20"><X className="w-4 h-4" /></button>
                                        <button onClick={() => handleSaveCaps(item)} disabled={saving} className="btn h-9 px-4 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-md flex items-center gap-2">
                                            {saving ? "..." : <><Save className="w-4 h-4" /> Save</>}
                                        </button>
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}