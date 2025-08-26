"use client";
import React from "react";

export type InventoryPeptide = { id: number; canonical_name: string; half_life_hours: number };

export type ProtocolItemState = {
  id?: number;
  peptide_id: number | null;
  dose_mg_per_administration: number;
  schedule: "EVERYDAY" | "WEEKDAYS" | "CUSTOM" | "EVERY_N_DAYS";
  custom_days: number[];
  cycle_on_weeks: number;
  cycle_off_weeks: number;
  every_n_days?: number | null;
  color: string;
  };

export default function ProtocolItemRow({
  value,
  peptides,
  onChange,
  onDelete,
}: {
  value: ProtocolItemState;
  peptides: InventoryPeptide[];
  onChange: (v: ProtocolItemState) => void;
  onDelete: () => void;
}) {
  const v = value;

  return (
    <div className="border rounded-xl p-3 mb-2">
      <div className="grid grid-cols-12 gap-3 items-end">
        {/* Peptide */}
        <div className="col-span-12 md:col-span-4">
          <label className="block text-xs text-gray-600 mb-1">Peptide</label>
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={v.peptide_id ?? ""}
            onChange={(e) => onChange({ ...v, peptide_id: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Select peptide…</option>
            {peptides.map(p => (
              <option key={p.id} value={p.id}>{p.canonical_name}</option>
            ))}
          </select>
        </div>

        {/* Dose (mg) */}
        <div className="col-span-6 md:col-span-2">
          <label className="block text-xs text-gray-600 mb-1">Dose (mg)</label>
          <input
            type="number"
            step="0.01"
            className="w-full border rounded-lg px-3 py-2"
            value={v.dose_mg_per_administration}
            onChange={(e) => onChange({ ...v, dose_mg_per_administration: Number(e.target.value || 0) })}
          />
        </div>

        {/* Schedule */}
        <div className="col-span-6 md:col-span-2">
        <div className="col-span-6 md:col-span-3">
          <label className="block text-xs text-gray-600 mb-1">Schedule</label>
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={v.schedule}
            onChange={(e) => onChange({ ...v, schedule: e.target.value as any })}
          >
            <option value="EVERYDAY">Every day</option>
            <option value="WEEKDAYS">Weekdays</option>
            <option value="CUSTOM">Custom</option>
            <option value="EVERY_N_DAYS">Every N days</option>
          </select>
            {v.schedule === "EVERY_N_DAYS" && (
            <input
              type="number"
              min={1}
              className="w-full border rounded-lg px-3 py-2 mt-2"
              value={v.every_n_days ?? 1}
              onChange={(e) => onChange({ ...v, every_n_days: Number(e.target.value || 1) })}
            />
          )}
        </div>
                {/* Color */}
        <div className="col-span-6 md:col-span-2">
          <label className="block text-xs text-gray-600 mb-1">Color</label>
          <input
            type="color"
            className="w-full border rounded-lg px-3 py-2 h-10"
            value={v.color}
            onChange={(e) => onChange({ ...v, color: e.target.value })}
          />
        </div>

        {/* Delete button aligned far right */}
        <div className="col-span-12 md:col-span-2 flex md:justify-end">
          <button
            type="button"
            className="mt-6 px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700"
            onClick={onDelete}
          >
            Delete
          </button>
        </div>

        {/* Custom days */}
        {v.schedule === "CUSTOM" && (
          <div className="col-span-12">
            <label className="block text-xs text-gray-600 mb-1">Custom days</label>
            <div className="flex flex-wrap gap-2">
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((label, idx) => {
                const checked = v.custom_days?.includes(idx) ?? false;
                return (
                  <label key={idx} className={"px-3 py-2 rounded border cursor-pointer " + (checked ? "bg-emerald-50 border-emerald-300" : "")}>
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={checked}
                      onChange={(e) => {
                        const set = new Set(v.custom_days || []);
                        if (e.target.checked) set.add(idx); else set.delete(idx);
                        onChange({ ...v, custom_days: Array.from(set).sort() });
                      }}
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Cycles */}
        <div className="col-span-6 md:col-span-3">
          <label className="block text-xs text-gray-600 mb-1">On (weeks)</label>
          <input
            type="number"
            className="w-full border rounded-lg px-3 py-2"
            value={v.cycle_on_weeks}
            onChange={(e) => onChange({ ...v, cycle_on_weeks: Number(e.target.value || 0) })}
          />
        </div>
        <div className="col-span-6 md:col-span-3">
          <label className="block text-xs text-gray-600 mb-1">Off (weeks)</label>
          <input
            type="number"
            className="w-full border rounded-lg px-3 py-2"
            value={v.cycle_off_weeks}
            onChange={(e) => onChange({ ...v, cycle_off_weeks: Number(e.target.value || 0) })}
          />
        </div>
      </div>
    </div>
  );
}
