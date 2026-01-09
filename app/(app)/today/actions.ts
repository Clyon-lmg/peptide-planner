"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  getTodayDosesWithUnits,
  logDose,
  resetDose,
  skipDose,
  type TodayDoseRow,
} from "./actions";

function fmt(n: number | null | undefined, digits = 2) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toFixed(digits);
}

function localISODate(): string {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split('T')[0];
}

type Row = TodayDoseRow & {
  remainingDoses?: number | null;
  reorderDateISO?: string | null;
};

export default function TodayPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(localISODate, []); 

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTodayDosesWithUnits(today);
      setRows(data as Row[]);
      setError(null);
    } catch (err) {
      console.error('Failed to load doses', err);
      setError(err instanceof Error ? err.message : 'Failed to load doses');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => { load(); }, [load]);

  async function mutateStatus(
    peptide_id: number,
    act: (id: number, d: string) => Promise<any>
  ) {
    setBusyId(peptide_id);
    try {
      await act(peptide_id, today);
      setRows((prev) =>
        (prev ?? []).map((r) =>
          r.peptide_id === peptide_id
            ? {
                ...r,
                status: act === logDose ? "TAKEN" : act === skipDose ? "SKIPPED" : "PENDING",
              }
            : r
        )
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6 pb-20">
      <h1 className="text-2xl font-semibold">Today</h1>

      {loading && <div>Loading…</div>}
      {!loading && error && <div className="text-sm text-destructive">{error}</div>}
      {!loading && !error && (rows?.length ?? 0) === 0 && (
              <div className="text-sm text-muted-foreground">No doses scheduled for today.</div>
      )}

      {!loading && rows && rows.length > 0 && (
        <div className="space-y-3">
          {rows.map((r) => {
            const needsSetup = !r.mg_per_vial || r.mg_per_vial <= 0 || !r.bac_ml || r.bac_ml <= 0;

            return (
              <div key={r.peptide_id} className="rounded-xl border p-4 bg-card shadow-sm space-y-3 relative">
                <div className="absolute right-3 top-3">
                  <StatusBadge status={r.status} />
                </div>

                <div className="flex items-center justify-between pr-24">
                  <div className="min-w-0">
                    <div className="text-lg font-medium truncate">{r.canonical_name}</div>
                    <div className="text-xs text-muted-foreground">
                      Dose: <span className="font-mono font-bold text-foreground">{fmt(r.dose_mg)}</span>{" "}
                      mg  •  Syringe:{" "}
                      {/* 🟢 FIX: Round to 0 digits */}
                      <span className="font-mono font-bold text-foreground">{fmt(r.syringe_units, 0)}</span>{" "}
                      units
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Time: {r.time_of_day ?? "—"}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Inventory: {fmt(r.mg_per_vial)} mg/vial • {fmt(r.bac_ml)} mL BAC
                </div>
                {needsSetup && (
                    <div className="text-xs text-amber-500 font-medium">Set mg/vial &amp; BAC in Inventory</div>
                )}

                <div className="pt-1 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === r.peptide_id}
                    onClick={() => mutateStatus(r.peptide_id, logDose)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      r.status === "TAKEN"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "hover:bg-muted"
                    }`}
                  >
                    Log
                  </button>

                  <button
                    type="button"
                    disabled={busyId === r.peptide_id}
                    onClick={() => mutateStatus(r.peptide_id, skipDose)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      r.status === "SKIPPED"
                        ? "bg-red-600 text-white border-red-600"
                        : "hover:bg-muted"
                    }`}
                  >
                    Skip
                  </button>

                  <button
                    type="button"
                    disabled={busyId === r.peptide_id}
                    onClick={() => mutateStatus(r.peptide_id, resetDose)}
                    className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
                  >
                    Reset
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: TodayDoseRow["status"] }) {
  const base = "text-[10px] uppercase font-bold px-2 py-1 rounded-full border tracking-wide";
    if (status === "TAKEN") return <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700`}>Taken</span>;
    if (status === "SKIPPED") return <span className={`${base} border-red-200 bg-red-50 text-red-700`}>Skipped</span>;
    return <span className={`${base} border-gray-200 bg-gray-50 text-gray-500`}>Pending</span>;
}
