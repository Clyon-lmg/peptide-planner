"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  getTodayDosesWithUnits,
  logDose,
  resetDose,
  skipDose,
  type TodayDoseRow,
  type DoseStatus,
} from "./actions";
import { Check, X, RotateCcw, Loader2 } from "lucide-react";

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
  const [rows, setRows] = useState<TodayDoseRow[]>([]);
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

  async function mutateStatus(peptide_id: number, newStatus: DoseStatus, act: any) {
    setBusyId(peptide_id);
    
    // 🟢 OPTIMISTIC UPDATE: Update UI immediately
    setRows(prev => prev.map(r => 
        r.peptide_id === peptide_id ? { ...r, status: newStatus } : r
    ));

    try {
      await act(peptide_id, today);
      // Fetch fresh data to confirm
      const data = await getTodayDosesWithUnits(today);
      setRows(data);
    } catch (e) {
      console.error("Mutation failed", e);
      // Revert on error
      load(); 
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6 pb-20">
      <h1 className="text-2xl font-bold tracking-tight">Today</h1>

      {loading && rows.length === 0 && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="animate-spin mr-2" /> Loading schedule...
          </div>
      )}
      
      {!loading && rows.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
              No doses scheduled for today.
          </div>
      )}

      <div className="space-y-3">
        {rows.map((r) => {
            const isTaken = r.status === 'TAKEN';
            const isSkipped = r.status === 'SKIPPED';
            const isBusy = busyId === r.peptide_id;

            return (
              <div 
                key={r.peptide_id} 
                className={`relative overflow-hidden rounded-xl border p-4 transition-all ${
                    isTaken ? 'bg-emerald-50/50 border-emerald-200' : 
                    isSkipped ? 'bg-muted/50 border-border opacity-75' : 
                    'bg-card border-border shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className={`text-lg font-semibold ${isSkipped ? 'line-through text-muted-foreground' : ''}`}>
                                {r.canonical_name}
                            </h3>
                            {isTaken && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">TAKEN</span>}
                            {isSkipped && <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">SKIPPED</span>}
                        </div>
                        
                        <div className="mt-1 text-sm text-muted-foreground space-x-3">
                            <span>
                                <span className="font-mono font-medium text-foreground">{fmt(r.dose_mg)}</span> mg
                            </span>
                            <span>
                                <span className="font-mono font-medium text-foreground">{fmt(r.syringe_units, 0)}</span> units
                            </span>
                            {r.time_of_day && (
                                <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                    {r.time_of_day}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {!isTaken && (
                      <button 
                        onClick={() => mutateStatus(r.peptide_id, 'TAKEN', logDose)} 
                        disabled={isBusy} 
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                        Log Dose
                      </button>
                  )}
                  
                  {!isSkipped && !isTaken && (
                      <button 
                        onClick={() => mutateStatus(r.peptide_id, 'SKIPPED', skipDose)} 
                        disabled={isBusy} 
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        <X className="size-3" />
                        Skip
                      </button>
                  )}

                  {(isTaken || isSkipped) && (
                      <button 
                        onClick={() => mutateStatus(r.peptide_id, 'PENDING', resetDose)} 
                        disabled={isBusy} 
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        <RotateCcw className="size-3" />
                        Reset
                      </button>
                  )}
                </div>
              </div>
            );
        })}
      </div>
    </div>
  );
}
