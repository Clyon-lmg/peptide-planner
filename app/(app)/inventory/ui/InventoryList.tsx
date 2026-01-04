"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, Save, X, Activity, Calendar, Syringe, Pill } from "lucide-react";
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

// Component: InputGroup
// Handles the layout and the "allow empty string" logic for numeric inputs
const InputGroup = ({ label, value, onChange, disabled, step = 1 }: any) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        // Allow empty string OR valid number (int or float)
        if (val === "" || /^\d*\.?\d*$/.test(val)) {
            onChange(val);
        }
    };

    return (
        <div className="flex flex-col gap-1.5 min-w-0">
            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider truncate">
                {label}
            </label>
            <input
                type="text" 
                inputMode="decimal"
                value={value ?? ""}
                onChange={handleChange}
                disabled={disabled}
                placeholder="0"
                className="input font-mono text-sm px-2 w-full"
            />
        </div>
    );
};

export default function InventoryList({
    vials,
    capsules,
    onSaveVial,
    onSaveCapsule,
    onDeleteVial,
    onDeleteCapsule,
}: InventoryListProps) {
    // State: Store edits as strings/numbers to allow intermediate "10." typing state
    const [vialEdits, setVialEdits] = React.useState<Record<number, Partial<Record<keyof VialItem, string | number>>>>({});
    const [capsEdits, setCapsEdits] = React.useState<Record<number, Partial<Record<keyof CapsuleItem, string | number>>>>({});
    
    const [savingIds, setSavingIds] = React.useState<Set<string>>(new Set());
    const router = useRouter();

    const currentVialValue = (item: VialItem, field: keyof VialItem) => 
        (vialEdits[item.id] as any)?.[field] ?? item[field];

    const currentCapsValue = (item: CapsuleItem, field: keyof CapsuleItem) => 
        (capsEdits[item.id] as any)?.[field] ?? item[field];

    // Check if dirty (compare as numbers)
    const isDirtyVal = (newVal: string | number | undefined, oldVal: number) => {
        if (newVal === undefined) return false;
        if (newVal === "") return false;
        return Number(newVal) !== Number(oldVal);
    };

    const isVialDirty = (item: VialItem) => {
        const e = vialEdits[item.id];
        if (!e) return false;
        return isDirtyVal(e.vials, item.vials) ||
            isDirtyVal(e.mg_per_vial, item.mg_per_vial) ||
            isDirtyVal(e.bac_ml, item.bac_ml) ||
            isDirtyVal(e.half_life_hours, item.half_life_hours);
    };

    const isCapsDirty = (item: CapsuleItem) => {
        const e = capsEdits[item.id];
        if (!e) return false;
        return isDirtyVal(e.bottles, item.bottles) ||
            isDirtyVal(e.caps_per_bottle, item.caps_per_bottle) ||
            isDirtyVal(e.mg_per_cap, item.mg_per_cap) ||
            isDirtyVal(e.half_life_hours, item.half_life_hours);
    };

    const onChangeVial = (id: number, field: string, value: string) => 
        setVialEdits(p => ({ ...p, [id]: { ...(p[id] ?? {}), [field]: value } }));

    const onChangeCaps = (id: number, field: string, value: string) => 
        setCapsEdits(p => ({ ...p, [id]: { ...(p[id] ?? {}), [field]: value } }));

    const clearVial = (id: number) => setVialEdits(p => { const n = { ...p }; delete n[id]; return n; });
    const clearCaps = (id: number) => setCapsEdits(p => { const n = { ...p }; delete n[id]; return n; });

    const saveWrapper = async (key: string, fn: () => Promise<void>) => {
        setSavingIds((s) => new Set(s).add(key));
        try { await fn(); } finally { setSavingIds((s) => { const n = new Set(s); n.delete(key); return n; }); }
    };

    // Prepare payloads (convert strings back to numbers)
    const prepareVialPayload = (item: VialItem): SaveVialPayload | null => {
        const edited = vialEdits[item.id];
        if (!edited) return null;
        
        return {
            id: item.id,
            vials: edited.vials !== undefined ? Number(edited.vials) : undefined,
            mg_per_vial: edited.mg_per_vial !== undefined ? Number(edited.mg_per_vial) : undefined,
            bac_ml: edited.bac_ml !== undefined ? Number(edited.bac_ml) : undefined,
            half_life_hours: edited.half_life_hours !== undefined ? Number(edited.half_life_hours) : undefined,
        };
    };

    const prepareCapsPayload = (item: CapsuleItem): SaveCapsPayload | null => {
        const edited = capsEdits[item.id];
        if (!edited) return null;

        return {
            id: item.id,
            bottles: edited.bottles !== undefined ? Number(edited.bottles) : undefined,
            caps_per_bottle: edited.caps_per_bottle !== undefined ? Number(edited.caps_per_bottle) : undefined,
            mg_per_cap: edited.mg_per_cap !== undefined ? Number(edited.mg_per_cap) : undefined,
            half_life_hours: edited.half_life_hours !== undefined ? Number(edited.half_life_hours) : undefined,
        };
    };

    const handleSaveVial = async (item: VialItem) => {
        if (!onSaveVial) return;
        const payload = prepareVialPayload(item);
        if (!payload) return;
        await saveWrapper(`vial-${item.id}`, async () => { await onSaveVial(payload); clearVial(item.id); router.refresh(); });
    };

    const handleSaveCaps = async (item: CapsuleItem) => {
        if (!onSaveCapsule) return;
        const payload = prepareCapsPayload(item);
        if (!payload) return;
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

    return (
        <div className="space-y-10">
            {/* Vials Section */}
            <section>
                <h2 className="pp-h2 mb-4 flex items-center gap-2">
                    <Syringe className="size-5 text-blue-500" /> Vials
                </h2>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {vials.length === 0 && <p className="text-muted-foreground text-sm">No vials in inventory.</p>}
                    {vials.map((item) => {
                        const dirty = isVialDirty(item);
                        const saving = savingIds.has(`vial-${item.id}`);
                        return (
                            <Card key={item.id} className="relative group hover:border-primary/20 transition-colors">
                                <div className="flex items-start justify-between mb-5">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="size-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                                            <Syringe className="size-5" />
                                        </div>
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
                                    </div>
                                    <button
                                        onClick={() => handleDeleteVial(item.id)}
                                        className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground/50 transition-colors"
                                        disabled={saving}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <InputGroup label="Vials" value={currentVialValue(item, "vials")} onChange={(v: string) => onChangeVial(item.id, "vials", v)} disabled={saving} />
                                    <InputGroup label="mg/vial" value={currentVialValue(item, "mg_per_vial")} onChange={(v: string) => onChangeVial(item.id, "mg_per_vial", v)} disabled={saving} step={0.1} />
                                    <InputGroup label="mL BAC" value={currentVialValue(item, "bac_ml")} onChange={(v: string) => onChangeVial(item.id, "bac_ml", v)} disabled={saving} step={0.1} />
                                    
                                    {/* UPDATED LABEL */}
                                    <InputGroup label="Half-life (hrs)" value={currentVialValue(item, "half_life_hours")} onChange={(v: string) => onChangeVial(item.id, "half_life_hours", v)} disabled={saving} step={0.1} />
                                </div>

                                {dirty && (
                                    <div className="mt-4 flex items-center justify-end gap-2 animate-in fade-in slide-in-from-top-1">
                                        <button onClick={() => clearVial(item.id)} className="btn h-9 w-9 p-0 rounded-full border-muted hover:bg-muted/20">
                                            <X className="w-4 h-4" />
                                        </button>
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

            {/* Capsules Section */}
            <section>
                <h2 className="pp-h2 mb-4 flex items-center gap-2">
                    <Pill className="size-5 text-purple-500" /> Capsules
                </h2>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {capsules.length === 0 && <p className="text-muted-foreground text-sm">No capsules in inventory.</p>}
                    {capsules.map((item) => {
                        const dirty = isCapsDirty(item);
                        const saving = savingIds.has(`cap-${item.id}`);
                        return (
                            <Card key={item.id} className="relative group hover:border-primary/20 transition-colors">
                                <div className="flex items-start justify-between mb-5">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="size-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                                            <Pill className="size-5" />
                                        </div>
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
                                    </div>
                                    <button onClick={() => handleDeleteCaps(item.id)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground/50 transition-colors" disabled={saving}><Trash2 className="w-4 h-4" /></button>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <InputGroup label="Bottles" value={currentCapsValue(item, "bottles")} onChange={(v: string) => onChangeCaps(item.id, "bottles", v)} disabled={saving} />
                                    <InputGroup label="Caps/Btl" value={currentCapsValue(item, "caps_per_bottle")} onChange={(v: string) => onChangeCaps(item.id, "caps_per_bottle", v)} disabled={saving} />
                                    <InputGroup label="mg/cap" value={currentCapsValue(item, "mg_per_cap")} onChange={(v: string) => onChangeCaps(item.id, "mg_per_cap", v)} disabled={saving} step={0.1} />
                                    
                                    {/* UPDATED LABEL */}
                                    <InputGroup label="Half-life (hrs)" value={currentCapsValue(item, "half_life_hours")} onChange={(v: string) => onChangeCaps(item.id, "half_life_hours", v)} disabled={saving} step={0.1} />
                                </div>

                                {dirty && (
                                    <div className="mt-4 flex items-center justify-end gap-2 animate-in fade-in slide-in-from-top-1">
                                        <button onClick={() => clearCaps(item.id)} className="btn h-9 w-9 p-0 rounded-full border-muted hover:bg-muted/20">
                                            <X className="w-4 h-4" />
                                        </button>
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
