"use client";
import React, { useState, useEffect } from "react";
import { CheckCircle2, Circle, Clock, Plus, Syringe } from "lucide-react";
import { toast } from "sonner";
import AddAdHocDoseModal from "@/components/calendar/AddAdHocDoseModal";
// 🟢 Import Server Actions
import { getTodayDosesWithUnits, logDose, resetDose, type TodayDoseRow } from "./actions";

export default function TodayPage() {
  const [doses, setDoses] = useState<TodayDoseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdHoc, setShowAdHoc] = useState(false);

  const today = new Date();
  const todayStr = today.toLocaleDateString("en-CA"); // YYYY-MM-DD
  const displayDate = today.toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric' });

  const loadToday = async () => {
    setLoading(true);
    try {
        const data = await getTodayDosesWithUnits(todayStr);
        setDoses(data);
    } catch (e) {
        console.error("Failed to load today", e);
        toast.error("Could not load schedule");
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => { loadToday(); }, []);

  const toggleDose = async (dose: TodayDoseRow) => {
    const isTaken = dose.status === "TAKEN";
    const newStatus = isTaken ? "PENDING" : "TAKEN";
    
    setDoses(doses.map(d => d.peptide_id === dose.peptide_id ? { ...d, status: newStatus } : d));

    try {
        if (newStatus === "TAKEN") {
            await logDose(dose.peptide_id, todayStr);
            toast.success("Dose taken");
        } else {
            await resetDose(dose.peptide_id, todayStr);
            toast.success("Dose reset");
        }
    } catch (e) {
        toast.error("Failed to update status");
        loadToday();
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 pb-24 space-y-6">
      <div className="flex items-center justify-between">
         <div>
            <h1 className="text-2xl font-bold tracking-tight">Today</h1>
            <p className="text-muted-foreground">{displayDate}</p>
         </div>
         <button 
           onClick={() => setShowAdHoc(true)}
           className="p-2 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-colors"
           title="Add Unscheduled Dose"
         >
           <Plus className="size-6" />
         </button>
      </div>

      <div className="space-y-3">
        {loading ? (
            <div className="text-center py-10 text-muted-foreground">Loading schedule...</div>
        ) : doses.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-border rounded-xl">
                <p className="text-muted-foreground">No doses scheduled for today.</p>
            </div>
        ) : (
            doses.map(dose => {
                const isTaken = dose.status === "TAKEN";
                const displayDose = Number(dose.dose_mg.toFixed(2));

                return (
                <div 
                  key={dose.peptide_id} 
                  onClick={() => toggleDose(dose)}
                  className={`relative overflow-hidden group p-4 rounded-2xl border transition-all cursor-pointer ${
                    isTaken
                      ? "bg-emerald-500/10 border-emerald-500/20" 
                      : "bg-card border-border hover:border-primary/50"
                  }`}
                >
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-4">
                            <div className={`transition-colors ${isTaken ? "text-emerald-500" : "text-muted-foreground"}`}>
                                {isTaken ? <CheckCircle2 className="size-7 fill-current" /> : <Circle className="size-7" />}
                            </div>
                            <div>
                                <h3 className={`font-bold text-lg ${isTaken ? "text-muted-foreground line-through" : ""}`}>
                                    {dose.canonical_name}
                                </h3>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span className="font-medium text-foreground">{displayDose} mg</span>
                                    <span>•</span>
                                    {dose.syringe_units ? (
                                        <span className="flex items-center gap-1 text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded text-xs font-mono">
                                            <Syringe className="size-3" /> {dose.syringe_units} units
                                        </span>
                                    ) : (
                                        <span className="text-xs opacity-50">No units</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        {!isTaken && dose.time_of_day && (
                            <div className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-lg">
                                {dose.time_of_day}
                            </div>
                        )}
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
