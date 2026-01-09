"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  getTodayDosesWithUnits,
  logDose,
  resetDose,
  type TodayDoseRow,
  type DoseStatus,
} from "./actions";
import { Check, Loader2 } from "lucide-react";

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

  const toggleDose = async (dose: TodayDoseRow) => {
    if (busyId === dose.peptide_id) return;
    setBusyId(dose.peptide_id);

    // Determine new status
    const isTaken = dose.status === 'TAKEN';
    const newStatus: DoseStatus = isTaken ? 'PENDING' : 'TAKEN';

    // 🟢 OPTIMISTIC UPDATE: Update UI instantly
    setRows(prev => prev.map(r => 
        r.peptide_id === dose.peptide_id ? { ...r, status: newStatus } : r
    ));

    try {
      if (newStatus === 'TAKEN') {
        await logDose(dose.peptide_id, today);
      } else {
        await resetDose(dose.peptide_id, today);
      }
      
      // Fetch fresh data from DB to confirm state
      // (The 'noStore' in actions ensures this isn't stale)
      const freshData = await getTodayDosesWithUnits(today);
      setRows(freshData);
    } catch (e) {
      console.error("Mutation failed", e);
      load(); // Revert on error
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Today</h1>
      </div>

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
                    isTaken ? 'bg-emerald-50 border-emerald-200' : 
                    isSkipped ? 'bg-muted border-border opacity-75' : 
                    'bg-card border-border shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className={`text-lg font-semibold truncate ${isSkipped ? 'line-through text-muted-foreground' : ''}`}>
                                {r.canonical_name}
                            </h3>
                            {isTaken && <span className="text-[10px] uppercase font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Taken</span>}
                            {isSkipped && <span className="text-[10px] uppercase font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Skipped</span>}
                        </div>
                        
                        <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                            <span className="whitespace-nowrap">
                                Dose: <span className="font-mono font-medium text-foreground">{fmt(r.dose_mg)}</span> mg
                            </span>
                            <span className="whitespace-nowrap">
                                Syringe: <span className="font-mono font-medium text-foreground">{fmt(r.syringe_units, 0)}</span> units
                            </span>
                            {r.time_of_day && (
                                <span className="text-xs bg-muted px-1.5 py-0.5 rounded self-center">
                                    {r.time_of_day}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="shrink-0">
                      <button 
                        onClick={() => toggleDose(r)} 
                        disabled={isBusy} 
                        className={`
                            relative h-12 px-6 rounded-lg font-medium transition-all flex items-center justify-center min-w-[100px]
                            ${isTaken 
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-lg' 
                                : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                            }
                            disabled:opacity-70 disabled:cursor-not-allowed
                        `}
                      >
                        {isBusy ? (
                            <Loader2 className="size-5 animate-spin" />
                        ) : isTaken ? (
                            <>
                                <Check className="size-5 mr-2" />
                                Logged
                            </>
                        ) : (
                            "Log Dose"
                        )}
                      </button>
                    </div>
                </div>
              </div>
            );
        })}
      </div>
    </div>
  );
}
