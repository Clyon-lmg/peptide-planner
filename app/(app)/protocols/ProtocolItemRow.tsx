"use client";
import React from "react";
import { Trash2, Clock, Calendar, Syringe } from "lucide-react";

export type InventoryPeptide = { id: number; canonical_name: string; half_life_hours: number };
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

    // Helper for clean input groups
    const InputGroup = ({ label, children, className = "" }: { label: string, children: React.ReactNode, className?: string }) => (
        <div className={`flex flex-col gap-1.5 ${className}`}>
            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{label}</label>
            {children}
        </div>
    );

    return (
        <div className="pp-card p-4 mb-3 relative group hover:border-primary/20 transition-all">
            {/* Header: Peptide Select + Color + Delete */}
            <div className="flex items-start gap-3 mb-4">
                <div className="size-10 rounded-xl shrink-0 flex items-center justify-center" style={{ backgroundColor: v.color + '20', color: v.color }}>
                    <Syringe className="size-5" />
                </div>

                <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                    <select
                        className="input h-10 font-medium"
                        value={v.peptide_id ?? ""}
                        onChange={(e) => onChange({ ...v, peptide_id: e.target.value ? Number(e.target.value) : null })}
                    >
                        <option value="">Select Peptide...</option>
                        {peptides.map((p) => (
                            <option key={p.id} value={p.id}>{p.canonical_name}</option>
                        ))}
                    </select>

                    <div className="flex gap-2">
                        <input
                            type="color"
                            className="h-10 w-14 rounded-lg border border-border cursor-pointer p-1 bg-card"
                            value={v.color}
                            onChange={(e) => onChange({ ...v, color: e.target.value })}
                            title="Label Color"
                        />
                        <button
                            type="button"
                            onClick={onDelete}
                            className="h-10 w-10 flex items-center justify-center rounded-lg border border-transparent text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Remove Item"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Settings Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">

                <InputGroup label="Dose (mg)">
                    <input
                        type="number"
                        step="0.01"
                        className="input h-9"
                        value={v.dose_mg_per_administration}
                        onChange={(e) => onChange({ ...v, dose_mg_per_administration: Number(e.target.value || 0) })}
                    />
                </InputGroup>

                <InputGroup label="Time">
                    <div className="relative">
                        <input
                            type="time"
                            className="input h-9 pl-8"
                            value={v.time_of_day ?? ""}
                            onChange={(e) => onChange({ ...v, time_of_day: e.target.value || null })}
                        />
                        <Clock className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                    </div>
                </InputGroup>

                <InputGroup label="Schedule" className="col-span-2 sm:col-span-2">
                    <select
                        className="input h-9"
                        value={v.schedule}
                        onChange={(e) => onChange({ ...v, schedule: e.target.value as any })}
                    >
                        <option value="EVERYDAY">Every Day</option>
                        <option value="WEEKDAYS">Weekdays (M-F)</option>
                        <option value="EVERY_N_DAYS">Every N Days</option>
                        <option value="CUSTOM">Custom Days</option>
                    </select>
                </InputGroup>

                {/* Conditional Schedule Inputs */}
                {v.schedule === "EVERY_N_DAYS" && (
                    <InputGroup label="Frequency (Days)">
                        <input
                            type="number"
                            min={1}
                            className="input h-9"
                            placeholder="e.g. 3"
                            value={v.every_n_days ?? 1}
                            onChange={(e) => onChange({ ...v, every_n_days: Number(e.target.value || 1) })}
                        />
                    </InputGroup>
                )}

                <InputGroup label="Site List">
                    <select
                        className="input h-9"
                        value={v.site_list_id ?? ""}
                        onChange={(e) => onChange({ ...v, site_list_id: e.target.value ? Number(e.target.value) : null })}
                    >
                        <option value="">None</option>
                        {siteLists.map((l) => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                    </select>
                </InputGroup>

                {/* Cycles (Optional - only show if non-zero or user wants to edit) */}
                <div className="contents">
                    <InputGroup label="On (Wks)">
                        <input
                            type="number"
                            className="input h-9"
                            placeholder="∞"
                            value={v.cycle_on_weeks || ""}
                            onChange={(e) => onChange({ ...v, cycle_on_weeks: Number(e.target.value || 0) })}
                        />
                    </InputGroup>
                    <InputGroup label="Off (Wks)">
                        <input
                            type="number"
                            className="input h-9"
                            placeholder="0"
                            value={v.cycle_off_weeks || ""}
                            onChange={(e) => onChange({ ...v, cycle_off_weeks: Number(e.target.value || 0) })}
                        />
                    </InputGroup>
                </div>
            </div>

            {/* Titration & Custom Days Area */}
            {(v.schedule === "CUSTOM" || isTitrating || true) && ( // Always rendering container for spacing, logic inside
                <div className="mt-4 pt-3 border-t border-border space-y-3">

                    {/* Custom Days Selector */}
                    {v.schedule === "CUSTOM" && (
                        <div>
                            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2 block">Active Days</label>
                            <div className="flex flex-wrap gap-1">
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
                                        h-8 px-3 rounded-lg text-xs font-medium transition-all
                                        ${isActive
                                                    ? "bg-primary text-primary-foreground shadow-sm"
                                                    : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
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

                    {/* Titration Toggle & Inputs */}
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                className="rounded border-border w-4 h-4 text-primary focus:ring-primary"
                                checked={isTitrating}
                                onChange={(e) => {
                                    if (!e.target.checked) {
                                        onChange({ ...v, titration_interval_days: null, titration_amount_mg: null });
                                    } else {
                                        onChange({ ...v, titration_interval_days: 7, titration_amount_mg: 0.5 });
                                    }
                                }}
                            />
                            <span className="text-xs font-medium">Enable Titration (Ramp up)</span>
                        </label>

                        {isTitrating && (
                            <div className="flex gap-2 animate-in fade-in slide-in-from-left-2">
                                <div className="flex items-center gap-2 bg-muted/10 px-2 py-1 rounded-lg">
                                    <span className="text-xs text-muted-foreground">Every</span>
                                    <input
                                        className="w-12 h-7 rounded border border-border px-1 text-center text-xs bg-background"
                                        type="number"
                                        value={v.titration_interval_days ?? 7}
                                        onChange={(e) => onChange({ ...v, titration_interval_days: Number(e.target.value) })}
                                    />
                                    <span className="text-xs text-muted-foreground">days, add</span>
                                    <input
                                        className="w-12 h-7 rounded border border-border px-1 text-center text-xs bg-background"
                                        type="number"
                                        step="0.01"
                                        value={v.titration_amount_mg ?? 0}
                                        onChange={(e) => onChange({ ...v, titration_amount_mg: Number(e.target.value) })}
                                    />
                                    <span className="text-xs text-muted-foreground">mg</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}