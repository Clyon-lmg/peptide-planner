"use client";
import React, { useState, useEffect } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { format } from "date-fns";
import { CheckCircle2, Circle, Clock, Plus } from "lucide-react";
import { toast } from "sonner";
import AddAdHocDoseModal from "@/components/calendar/AddAdHocDoseModal"; // Ensure import path is correct

// ... (keep your existing Dose type definition if defined locally) ...
type Dose = {
  id: number;
  peptide_id: number;
  dose_mg: number;
  date: string;
  time_of_day: string | null;
  status: "PENDING" | "LOGGED" | "SKIPPED";
  peptides: { canonical_name: string };
};

export default function TodayPage() {
  const [doses, setDoses] = useState<Dose[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdHoc, setShowAdHoc] = useState(false); // 🟢 State for modal

  const todayStr = new Date().toISOString().split("T")[0];

  const loadToday = async () => {
    setLoading(true);
    const sb = getSupabaseBrowser();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    const { data } = await sb
      .from("doses")
      .select("*, peptides(canonical_name)")
      .eq("user_id", user.id)
      .eq("date", todayStr)
      .order("time_of_day", { ascending: true });
    
    if (data) setDoses(data as any);
    setLoading(false);
  };

  useEffect(() => { loadToday(); }, []);

  const toggleDose = async (dose: Dose) => {
    const sb = getSupabaseBrowser();
    const newStatus = dose.status === "LOGGED" ? "PENDING" : "LOGGED";
    // Optimistic Update
    setDoses(doses.map(d => d.id === dose.id ? { ...d, status: newStatus } : d));
    
    await sb.from("doses").update({ status: newStatus }).eq("id", dose.id);
    toast.success(newStatus === "LOGGED" ? "Dose logged" : "Dose reset");
  };

  return (
    <div className="max-w-md mx-auto p-4 pb-24 space-y-6">
      <div className="flex items-center justify-between">
         <div>
            <h1 className="pp-h1">Today</h1>
            <p className="text-muted-foreground">{format(new Date(), "EEEE, MMMM do")}</p>
         </div>
         {/* 🟢 Ad-Hoc Button */}
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
            <div className="text-center py-10 text-muted-foreground">Loading...</div>
        ) : doses.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-border rounded-xl">
                <p className="text-muted-foreground">No doses scheduled for today.</p>
            </div>
        ) : (
            doses.map(dose => (
                <div 
                  key={dose.id} 
                  onClick={() => toggleDose(dose)}
                  className={`relative overflow-hidden group p-4 rounded-2xl border transition-all cursor-pointer ${
                    dose.status === "LOGGED" 
                      ? "bg-emerald-500/10 border-emerald-500/20" 
                      : "bg-card border-border hover:border-primary/50"
                  }`}
                >
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-4">
                            <div className={`transition-colors ${dose.status === "LOGGED" ? "text-emerald-500" : "text-muted-foreground"}`}>
                                {dose.status === "LOGGED" ? <CheckCircle2 className="size-7 fill-current" /> : <Circle className="size-7" />}
                            </div>
                            <div>
                                <h3 className={`font-bold text-lg ${dose.status === "LOGGED" ? "text-muted-foreground line-through" : ""}`}>
                                    {dose.peptides?.canonical_name}
                                </h3>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span className="font-medium text-foreground">{dose.dose_mg} mg</span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1"><Clock className="size-3" /> {dose.time_of_day || "Any time"}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ))
        )}
      </div>

      {/* 🟢 Render Modal */}
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
