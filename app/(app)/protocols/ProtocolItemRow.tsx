"use client";
import React from "react";

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

  return (
    <div className="pp-card p-3 mb-2">
      <div className="grid grid-cols-12 gap-3 items-end">
        {/* Peptide */}
        <div className="col-span-12 md:col-span-3">
          <label className="block text-xs text-muted mb-1">Peptide</label>
          <select
            className="input"
            value={v.peptide_id ?? ""}
            onChange={(e) =>
              onChange({ ...v, peptide_id: e.target.value ? Number(e.target.value) : null })
            }
          >
            <option value="">Select peptide…</option>
            {peptides.map((p) => (
              <option key={p.id} value={p.id}>
                {p.canonical_name}
              </option>
            ))}
          </select>
        </div>

        {/* Color */}
        <div className="col-span-6 md:col-span-1">
          <label className="block text-xs text-muted mb-1">Color</label>
          <input
            type="color"
            className="input h-10"
            value={v.color}
            onChange={(e) => onChange({ ...v, color: e.target.value })}
          />
        </div>

        {/* Dose (mg) */}
        <div className="col-span-6 md:col-span-1">
          <label className="block text-xs text-muted mb-1">Dose (mg)</label>
          <input
            type="number"
            step="0.01"
            className="mt-1 input !max-w-[15ch]"
            value={v.dose_mg_per_administration}
            onChange={(e) =>
              onChange({ ...v, dose_mg_per_administration: Number(e.target.value || 0) })
            }
          />
        </div>

        {/* Titrate */}
        <div className="col-span-6 md:col-span-1">
          <label className="inline-flex items-center mt-6 text-xs text-muted">
            <input
              type="checkbox"
              className="mr-2"
              checked={
                v.titration_interval_days != null && v.titration_amount_mg != null
              }
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? {
                        ...v,
                        titration_interval_days: v.titration_interval_days ?? 7,
                        titration_amount_mg: v.titration_amount_mg ?? 0,
                      }
                    : {
                        ...v,
                        titration_interval_days: null,
                        titration_amount_mg: null,
                      }
                )
              }
            />
            Titrate
          </label>
        </div>

        {/* Time of day */}
        <div className="col-span-6 md:col-span-2">
          <label className="block text-xs text-muted mb-1">Time</label>
          <input
            type="time"
className="mt-1 input !max-w-[15ch]"
value={v.time_of_day ?? ""}
            onChange={(e) => onChange({ ...v, time_of_day: e.target.value || null })}
          />
        </div>

        {/* Schedule */}
        <div className="col-span-6 md:col-span-1">
          <label className="block text-xs text-muted mb-1">Schedule</label>
          <select
            className="input"
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
              className="input mt-2"
              value={v.every_n_days ?? 1}
              onChange={(e) =>
                onChange({ ...v, every_n_days: Number(e.target.value || 1) })
              }
            />
          )}
        </div>

        {/* Delete button aligned far right */}
        <div className="col-span-12 md:col-span-1 flex md:justify-end">
          <button
            type="button"
            className="btn mt-6 bg-destructive hover:bg-destructive/90 text-white"
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
        {v.titration_interval_days != null && v.titration_amount_mg != null && (
          <>
            <div className="col-span-6 md:col-span-2 md:col-start-7 md:row-start-2">
              <label className="block text-xs text-muted mb-1">
                Titration interval (days)
              </label>
              <input
                type="number"
                min={1}
                className="mt-1 input !max-w-[15ch]"
                value={v.titration_interval_days ?? 1}
                onChange={(e) =>
                  onChange({
                    ...v,
                    titration_interval_days: Number(e.target.value || 0),
                  })
                }
              />
            </div>
            <div className="col-span-6 md:col-span-2 md:col-start-9 md:row-start-2">
              <label className="block text-xs text-muted mb-1">
                Titration amount (mg)
              </label>
              <input
                type="number"
                step="0.01"
                className="mt-1 input !max-w-[15ch]"
                value={v.titration_amount_mg ?? 0}
                onChange={(e) =>
                  onChange({
                    ...v,
                    titration_amount_mg: Number(e.target.value || 0),
                  })
                }
              />
            </div>
          </>
        )}

        {/* Custom days */}
        {v.schedule === "CUSTOM" && (
          <div className="col-span-12">
            <label className="block text-xs text-muted mb-1">Custom days</label>
            <div className="flex flex-wrap gap-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                (label, idx) => {
                  const checked = v.custom_days?.includes(idx) ?? false;
                  return (
                    <label
                      key={idx}
                      className={
                        "px-3 py-2 rounded border cursor-pointer " +
                        (checked ? "bg-success/10 border-success/20" : "")
                      }
                    >
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={checked}
                        onChange={(e) => {
                          const set = new Set(v.custom_days || []);
                          if (e.target.checked) set.add(idx);
                          else set.delete(idx);
                          onChange({ ...v, custom_days: Array.from(set).sort() });
                        }}
                      />
                      {label}
                    </label>
                  );
                }
              )}
            </div>
          </div>
        )}

        {/* Cycles */}
        <div className="col-span-6 md:col-span-3">
          <label className="block text-xs text-muted mb-1">On (weeks)</label>
          <input
            type="number"
className="mt-1 input !max-w-[15ch]"
value={v.cycle_on_weeks}
            onChange={(e) =>
              onChange({ ...v, cycle_on_weeks: Number(e.target.value || 0) })
            }
          />
        </div>
        <div className="col-span-6 md:col-span-3">
        <div className="col-span-6 md:col-span-3 md:col-start-4">
          <input
            type="number"
            className="mt-1 input !max-w-[15ch]"
            value={v.cycle_off_weeks}
            onChange={(e) =>
              onChange({ ...v, cycle_off_weeks: Number(e.target.value || 0) })
            }
          />
        </div>

        {/* Site list */}
        <div className="col-span-6 md:col-span-3 md:col-start-7">
          <label className="block text-xs text-muted mb-1">Site list</label>
          <select
            className="input"
            value={v.site_list_id ?? ""}
            onChange={(e) =>
              onChange({
                ...v,
                site_list_id: e.target.value ? Number(e.target.value) : null,
              })
            }
          >
            <option value="">None</option>
            {siteLists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}