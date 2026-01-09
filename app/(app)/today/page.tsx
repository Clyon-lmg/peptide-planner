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

export default function TodayPage() {
  const [rows, setRows] = useState<TodayDoseRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const today = useMemo(localISODate, []); 

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTodayDosesWithUnits(today);
      setRows(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => { load(); }, [load]);

  async function mutateStatus(peptide_id: number, act: any) {
    setBusyId(peptide_id);
    try {
      await act(peptide_id, today);
      const data = await getTodayDosesWithUnits(today);
      setRows(data);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6 pb-20">
      <h1 className="text-2xl font-semibold">Today</h1>

      {loading && <div>Loading…</div>}
      {!loading && (rows?.length ?? 0) === 0 && (
          <div className="text-sm text-muted-foreground">No doses scheduled for today.</div>
      )}

      {!loading && rows && rows.length > 0 && (
        <div className="space-y-3">
          {rows.map((r) => (
              <div key={r.peptide_id} className="rounded-xl border p-4 bg-card shadow-sm space-y-3 relative">
                <div className="absolute right-3 top-3">
                  <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full border ${
                      r.status === 'TAKEN' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      r.status === 'SKIPPED' ? 'bg-red-50 text-red-700 border-red-200' :
                      'bg-gray-50 text-gray-500 border-gray-200'
                  }`}>{r.status}</span>
                </div>

                <div>
                    <div className="text-lg font-medium">{r.canonical_name}</div>
                    <div className="text-xs text-muted-foreground">
                      Dose: <span className="font-mono font-bold text-foreground">{fmt(r.dose_mg)}</span> mg • 
                      Syringe: <span className="font-mono font-bold text-foreground">{fmt(r.syringe_units, 0)}</span> units
                    </div>
                </div>

                <div className="pt-1 flex gap-2">
                  <button onClick={() => mutateStatus(r.peptide_id, logDose)} disabled={busyId === r.peptide_id} className="btn border bg-card hover:bg-emerald-50 hover:text-emerald-600 h-8 text-xs">Log</button>
                  <button onClick={() => mutateStatus(r.peptide_id, skipDose)} disabled={busyId === r.peptide_id} className="btn border bg-card hover:bg-red-50 hover:text-red-600 h-8 text-xs">Skip</button>
                  <button onClick={() => mutateStatus(r.peptide_id, resetDose)} disabled={busyId === r.peptide_id} className="btn border bg-card hover:bg-muted h-8 text-xs">Reset</button>
                </div>
              </div>
          ))}
        </div>
      )}
    </div>
  );
}
