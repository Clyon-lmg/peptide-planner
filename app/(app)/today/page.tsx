// app/(app)/today/page.tsx

"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { Clock, Syringe, Loader2, Check, Target } from "lucide-react";
import { toast } from "sonner";
import AddAdHocDoseModal from "@/components/calendar/AddAdHocDoseModal";
import { getTodayDosesWithUnits, logDose, resetDose, type TodayDoseRow, type DoseStatus } from "./actions";

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
  const [doses, setDoses] = useState<TodayDoseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdHoc, setShowAdHoc] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const todayStr = useMemo(localISODate, []);

  const loadToday = useCallback(async () => {
    setLoading(true);
    try {
        const data = await getTodayDosesWithUnits(todayStr);
        setDoses(data);
    } catch (e) {
        console.error(e);
        toast.error("Failed to load schedule");
    } finally {
        setLoading(false);
    }
  }, [todayStr]);

  useEffect(() => { loadToday(); }, [loadToday]);

  const handleToggleLog = async (dose: TodayDoseRow) => {
    if (busyId === dose.peptide_id) return;
    setBusyId(dose.peptide_id);

    const isTaken = dose.status === 'TAKEN';
    const newStatus: DoseStatus = isTaken ? 'PENDING' : 'TAKEN';

    // Optimistic Update
    setDoses(prev => prev.map(d => 
        d.peptide_id === dose.peptide_id ? { ...d, status: newStatus } : d
    ));

    try {
        if (newStatus === 'TAKEN') {
            await logDose(dose.peptide_id, todayStr);
            toast.success("Dose logged");
        } else {
            await resetDose(dose.peptide_id, todayStr);
            toast.success("Dose reset");
        }
        
        const freshData = await getTodayDosesWithUnits(todayStr);
        setDoses(freshData);
    } catch (e) {
        console.error(e);
        toast.error("Failed to update status");
        loadToday();
    } finally {
        setBusyId(null);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 pb-24 space-y-6">
      <div className="flex items-start justify-between gap-4">
         <div>
            <h1 className="text-2xl font-bold tracking-tight">Today</h1>
            <p className="text-muted-foreground">{format(new Date(), "EEEE, MMMM do")}</p>
         </div>
      </div>

      <div className="space-y-3">
        {loading ? (
            <div className="text-center py-10 text-muted-foreground">Loading...</div>
        ) : doses.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-border rounded-xl">
                <p className="text-muted-foreground">No doses scheduled for today.</p>
            </div>
        ) : (
            doses.map(dose => {
                const isTaken = dose.status === 'TAKEN';
                const isBusy = busyId === dose.peptide_id;

                return (
                <div 
                  key={dose.peptide_id} 
                  className={`relative overflow-hidden group p-4 rounded-2xl border transition-all select-none ${
                    isTaken
                      ? "bg-emerald-50/50 border-emerald-200" 
                      : "bg-card border-border shadow-sm hover:border-primary/50"
                  }`}
                >
                    <div className="flex items-center justify-between gap-4 relative z-10">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3 mb-1">
                                <h3 className={`font-bold text-lg truncate ${isTaken ? "text-muted-foreground line-through" : ""}`}>
                                    {dose.canonical_name}
                                </h3>
                            </div>
                            
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">{fmt(dose.dose_mg)} mg</span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <Syringe className="size-3" /> {fmt(dose.syringe_units, 0)} units
                                </span>
                                {dose.site_label && (
                                    <>
                                        <span>•</span>
                                        <span className="flex items-center gap-1">
                                            <Target className="size-3" /> {dose.site_label}
                                        </span>
                                    </>
                                )}
                                {dose.time_of_day && (
                                    <>
                                        <span>•</span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="size-3" /> {dose.time_of_day}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="shrink-0">
                            <button 
                                onClick={() => handleToggleLog(dose)}
                                disabled={isBusy}
                                className={`
                                    size-12 rounded-full flex items-center justify-center transition-all shadow-sm
                                    ${isTaken 
                                        ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md" 
                                        : "bg-primary/10 text-primary hover:bg-primary/20"
                                    }
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                `}
                            >
                                {isBusy ? <Loader2 className="size-5 animate-spin" /> : (
                                    <Check className={`size-6 transition-transform ${isTaken ? "scale-100" : "scale-0 opacity-0"}`} />
                                )}
                                {!isBusy && !isTaken && (
                                    <div className="size-3 bg-current rounded-full absolute" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )})
        )}
      </div>

      {showAdHoc && (
        <AddAdHocDoseModal 
          date={todayStr}
          onClose={() => setShowAdHoc(false)}
          onSuccess={() => {
            setShowAdHoc(false);
            loadToday();
          }}
        />
      )}
    </div>
  );
}
