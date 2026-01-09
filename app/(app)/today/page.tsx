"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { CheckCircle2, Circle, Clock, Syringe, Loader2 } from "lucide-react"; // Removed Plus
import { toast } from "sonner";
// import AddAdHocDoseModal from "@/components/calendar/AddAdHocDoseModal"; // Keeping code but unused
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
  // const [showAdHoc, setShowAdHoc] = useState(false); // Unused
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
      <div className="flex items-center justify-between">
         <div>
            <h1 className="text-2xl font-bold tracking-tight">Today</h1>
            <p className="text-muted-foreground">{format(new Date(), "EEEE, MMMM do")}</p>
         </div>
         {/* Ad-Hoc Button Removed */}
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
                                <button 
                                    onClick={() => handleToggleLog(dose)}
                                    disabled={isBusy}
                                    className={`
                                        shrink-0 transition-all transform hover:scale-110 active:scale-95 rounded-full outline-none
                                        ${isTaken ? "text-emerald-500" : "text-muted-foreground hover:text-primary"}
                                        ${isBusy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                                    `}
                                    title={isTaken ? "Reset to Pending" : "Log as Taken"}
                                >
                                    {isBusy ? (
                                        <Loader2 className="size-7 animate-spin text-primary" />
                                    ) : isTaken ? (
                                        <CheckCircle2 className="size-7 fill-current" />
                                    ) : (
                                        <Circle className="size-7" />
                                    )}
                                </button>

                                <h3 className={`font-bold text-lg truncate ${isTaken ? "text-muted-foreground line-through" : ""}`}>
                                    {dose.canonical_name}
                                </h3>
                            </div>
                            
                            <div className="pl-10 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">{fmt(dose.dose_mg)} mg</span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <Syringe className="size-3" /> {fmt(dose.syringe_units, 0)} units
                                </span>
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
                    </div>
                </div>
            )})
        )}
      </div>
      {/* Modal Removed */}
    </div>
  );
}
