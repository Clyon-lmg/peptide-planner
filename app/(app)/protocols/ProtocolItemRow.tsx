"use client";
import React from "react";
import { Trash2, Clock, Syringe, Check, Pill, FlaskConical } from "lucide-react";

// Updated type to include 'kind'
export type InventoryPeptide = { 
    id: number; 
    canonical_name: string; 
    half_life_hours: number;
    kind?: 'vial' | 'capsule' | 'both'; 
};

export type SiteList = { id: number; name: string };

export type ProtocolItemState = {
    id?: number;
    peptide_id: number | null;
    site_list_id: number | null;
    dose_mg_per_administration: number;
    schedule: "EVERYDAY" | "WEEKDAYS" | "CUSTOM" | "EVERY_N_DAYS";
    custom_days: number[];
    cycle_on_weeks: number;
    cycle_off_weeks: number;
    every_n_days?: number | null;
    titration_interval_days?: number | null;
    titration_amount_mg?: number | null;
    color: string;
    time_of_day?: string | null;
};

export default function ProtocolItemRow({
    value,
    peptides,
    siteLists,
    onChange,
    onDelete,
}: {
    value: ProtocolItemState;
    peptides: InventoryPeptide[];
    siteLists: SiteList[];
    onChange: (v: ProtocolItemState) => void;
    onDelete: () => void;
}) {
    const v = value;
    const isTitrating = (v.titration_interval_days || 0) > 0 || (v.titration_amount_mg || 0) > 0;

    // Helper to find the current selected peptide's kind
    const selectedPeptide = peptides.find(p => p.id === v.peptide_id);
    const kindIcon = selectedPeptide?.kind === 'capsule' ? <Pill className="size-5" /> : <FlaskConical className="size-5" />;

    const InputGroup = ({ label, children, className = "" }: { label: string, children: React.ReactNode, className?: string }) => (
        <div className={`flex flex-col gap-1.5 min-w-0 ${className}`}>
            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider whitespace-nowrap truncate">{label}</label>
            {children}
        </div>
    );

    return (
        <div className="pp-card p-4 mb-3 relative group hover:border-primary/30 transition-all shadow-sm">
            {/* 1. Header Row: Icon + Peptide + Color + Delete */}
            <div className="flex items-center gap-3 mb-5">
                <div className="size-10 md:size-11 rounded-xl shrink-0 flex items-center justify-center shadow-inner" style={{ backgroundColor: v.color + '20', color: v.color }}>
                    {/* Dynamic Icon based on inventory type */}
                    {kindIcon}
                </div>

                <div className="flex-1 grid grid-cols-[1fr_auto_auto] gap-2 items-center min-w-0">
                    <select
                        className="input font-medium truncate pr-8 w-full"
                        value={v.peptide_id ?? ""}
                        onChange={(e) => onChange({ ...v, peptide_id: e.target.value ? Number(e.target.value) : null })}
                    >
                        <option value="">Select Peptide...</option>
                        {peptides.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.canonical_name} {p.kind === 'capsule' ? '(Cap)' : ''}
                            </option>
                        ))}
                    </select>

                    <input
                        type="color"
                        className="h-10 w-10 md:h-11 md:w-11 rounded-xl border border-border cursor-pointer p-1 bg-card shrink-0"
                        value={v.color}
                        onChange={(e) => onChange({ ...v, color: e.target.value })}
                        title="Label Color"
                    />

                    <button
                        type="button"
                        onClick={onDelete}
                        className="h-10 w-10 md:h-11 md:w-11 flex items-center justify-center rounded-xl border border-transparent text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                        title="Remove Item"
                    >
                        <Trash2 className="size-5" />
                    </button>
                </div>
            </div>

            {/* 2. Main Controls Grid */}
            <div className="grid grid-cols-2 md:grid-cols-12 gap-x-4 gap-y-5">

                {/* Dose */}
                <div className="col-span-1 md:col-span-2">
                    <InputGroup label="Dose (mg)">
                        <input
                            type="number"
                            step="0.01"
                            className="input w-full"
                            value={v.dose_mg_per_administration}
                            onChange={(e) => onChange({ ...v, dose_mg_per_administration: Number(e.target.value || 0) })}
                        />
                    </InputGroup>
                </div>

                {/* Time */}
                <div className="col-span-1 md:col-span-3">
                    <InputGroup label="Time">
                        <input
                            type="time"
                            className="input w-full"
                            value={v.time_of_day ?? ""}
                            onChange={(e) => onChange({ ...v, time_of_day: e.target.value || null })}
                        />
                    </InputGroup>
                </div>

                {/* Schedule */}
                <div className="col-span-2 md:col-span-3">
                    <InputGroup label="Schedule">
                        <select
                            className="input w-full"
                            value={v.schedule}
                            onChange={(e) => onChange({ ...v, schedule: e.target.value as any })}
                        >
                            <option value="EVERYDAY">Every Day</option>
                            <option value="WEEKDAYS">Weekdays</option>
                            <option value="EVERY_N_DAYS">Every N Days</option>
                            <option value="CUSTOM">Custom Days</option>
                        </select>
                    </InputGroup>
                </div>

                {/* Site List */}
                <div className="col-span-2 md:col-span-4">
                    <InputGroup label="Site List">
                        <select
                            className="input w-full"
                            value={v.site_list_id ?? ""}
                            onChange={(e) => onChange({ ...v, site_list_id: e.target.value ? Number(e.target.value) : null })}
                        >
                            <option value="">None</option>
                            {siteLists.map((l) => (
                                <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                        </select>
                    </InputGroup>
                </div>

                {/* Conditional: Frequency */}
                {v.schedule === "EVERY_N_DAYS" && (
                    <div className="col-span-2 md:col-span-4 md:col-start-6">
                        <InputGroup label="Frequency">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground whitespace-nowrap">Every</span>
                                <input
                                    type="number"
                                    min={1}
                                    className="input text-center w-full"
                                    value={v.every_n_days ?? 1}
                                    onChange={(e) => onChange({ ...v, every_n_days: Number(e.target.value || 1) })}
                                />
                                <span className="text-sm text-muted-foreground whitespace-nowrap">days</span>
                            </div>
                        </InputGroup>
                    </div>
                )}

                {/* Cycles */}
                <div className="col-span-1 md:col-span-2">
                    <InputGroup label="On (Wks)">
                        <input
                            type="number"
                            className="input w-full"
                            placeholder="∞"
                            value={v.cycle_on_weeks || ""}
                            onChange={(e) => onChange({ ...v, cycle_on_weeks: Number(e.target.value || 0) })}
                        />
                    </InputGroup>
                </div>
                <div className="col-span-1 md:col-span-2">
                    <InputGroup label="Off (Wks)">
                        <input
                            type="number"
                            className="input w-full"
                            placeholder="0"
                            value={v.cycle_off_weeks || ""}
                            onChange={(e) => onChange({ ...v, cycle_off_weeks: Number(e.target.value || 0) })}
                        />
                    </InputGroup>
                </div>
            </div>

            {/* Footer: Titration & Custom Days */}
            {(v.schedule === "CUSTOM" || isTitrating || true) && (
                <div className="mt-5 pt-4 border-t border-border/50 flex flex-col gap-4">

                    {/* Custom Days */}
                    {v.schedule === "CUSTOM" && (
                        <div>
                            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2 block">Active Days</label>
                            <div className="flex flex-wrap gap-1.5">
                                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => {
                                    const isActive = v.custom_days?.includes(idx);
                                    return (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() => {
                                                const set = new Set(v.custom_days || []);
                                                if (isActive) set.delete(idx); else set.add(idx);
                                                onChange({ ...v, custom_days: Array.from(set).sort() });
                                            }}
                                            className={`
                                        h-9 px-3.5 rounded-lg text-xs font-semibold transition-all border
                                        ${isActive
                                                    ? "bg-[rgb(var(--ring))] border-[rgb(var(--ring))] text-white shadow-md ring-2 ring-[rgb(var(--ring))]/20"
                                                    : "bg-[rgb(var(--card))] border-[rgb(var(--border))] text-[rgb(var(--muted))] hover:border-[rgb(var(--ring))]/50 hover:text-[rgb(var(--foreground))]"
                                                }
                                    `}
                                        >
                                            {day}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Titration */}
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-muted/10 p-3 rounded-xl">
                        <label className="inline-flex items-center gap-2.5 cursor-pointer select-none shrink-0">
                            <input
                                type="checkbox"
                                className="rounded-md border-muted-foreground/30 w-4 h-4 text-[rgb(var(--ring))] focus:ring-[rgb(var(--ring))]/50"
                                checked={isTitrating}
                                onChange={(e) => {
                                    if (!e.target.checked) {
                                        onChange({ ...v, titration_interval_days: null, titration_amount_mg: null });
                                    } else {
                                        onChange({ ...v, titration_interval_days: 7, titration_amount_mg: 0.5 });
                                    }
                                }}
                            />
                            <span className="text-xs font-medium">Auto-Titrate (Ramp up)</span>
                        </label>

                        {isTitrating && (
                            <div className="flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-left-2 text-sm">
                                <span className="text-muted-foreground">Every</span>
                                <input
                                    className="w-14 h-8 rounded-lg border border-border px-1 text-center text-sm bg-background shadow-sm focus:border-primary focus:ring-1 focus:ring-primary"
                                    type="number"
                                    value={v.titration_interval_days ?? 7}
                                    onChange={(e) => onChange({ ...v, titration_interval_days: Number(e.target.value) })}
                                />
                                <span className="text-muted-foreground">days, add</span>
                                <input
                                    className="w-16 h-8 rounded-lg border border-border px-1 text-center text-sm bg-background shadow-sm focus:border-primary focus:ring-1 focus:ring-primary"
                                    type="number"
                                    step="0.01"
                                    value={v.titration_amount_mg ?? 0}
                                    onChange={(e) => onChange({ ...v, titration_amount_mg: Number(e.target.value) })}
                                />
                                <span className="text-muted-foreground">mg</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
