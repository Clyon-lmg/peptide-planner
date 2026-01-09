"use client";
import React, { useState } from "react";
import { X, Check, Trash2, PlusCircle, Syringe } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { toast } from "sonner";
import AddAdHocDoseModal from "./AddAdHocDoseModal";

export default function DayDetailModal({ 
  date, 
  doses, 
  onClose, 
  onUpdate 
}: { 
  date: string, 
  doses: any[], 
  onClose: () => void, 
  onUpdate: () => void 
}) {
  const [processing, setProcessing] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // Toggle dose status (Pending <-> Logged)
  const toggleStatus = async (dose: any) => {
    setProcessing(dose.id);
    const sb = getSupabaseBrowser();
    const newStatus = dose.status === "LOGGED" ? "PENDING" : "LOGGED";
    
    try {
      await sb.from("doses").update({ status: newStatus }).eq("id", dose.id);
      onUpdate();
    } catch (e) {
      toast.error("Failed to update status");
    } finally {
      setProcessing(null);
    }
  };

  // Delete a dose
  const deleteDose = async (id: number) => {
    if (!confirm("Delete this dose?")) return;
    setProcessing(String(id));
    const sb = getSupabaseBrowser();
    await sb.from("doses").delete().eq("id", id);
    onUpdate();
    setProcessing(null);
  };

  // 🟢 If user clicks "Add Ad-Hoc", show that modal instead
  if (showAdd) {
    return (
      <AddAdHocDoseModal 
        date={date} 
        onClose={() => setShowAdd(false)} 
        onSuccess={() => {
          setShowAdd(false);
          onUpdate();
        }} 
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border flex flex-col max-h-[90vh]">
        
        <div className="p-4 border-b border-border flex justify-between items-center bg-muted/20 rounded-t-2xl">
          <div>
             <h3 className="font-bold text-lg">{new Date(date).toDateString()}</h3>
             <p className="text-xs text-muted-foreground">{doses.length} scheduled events</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-full transition-colors"><X className="size-5" /></button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {doses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No doses scheduled for this day.
            </div>
          ) : (
            doses.map((dose) => {
               const isLogged = dose.status === "LOGGED";
               return (
                 <div key={dose.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isLogged ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-card border-border hover:border-primary/30'}`}>
                    <div className="flex items-center gap-3">
                       <div className={`size-10 rounded-full flex items-center justify-center ${isLogged ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
                          {isLogged ? <Check className="size-5" /> : <Syringe className="size-5" />}
                       </div>
                       <div>
                          <p className="font-bold text-sm">{dose.peptides?.canonical_name || "Unknown Peptide"}</p>
                          <p className="text-xs text-muted-foreground">{dose.dose_mg} mg • {dose.time_of_day || "Any time"}</p>
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => toggleStatus(dose)}
                        disabled={!!processing}
                        className={`btn text-xs h-8 px-3 rounded-lg border ${isLogged ? 'bg-background border-border hover:bg-muted' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                      >
                        {isLogged ? "Unlog" : "Log"}
                      </button>
                      <button 
                         onClick={() => deleteDose(dose.id)}
                         className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                 </div>
               );
            })
          )}
        </div>

        {/* 🟢 Footer with Add Button */}
        <div className="p-4 border-t border-border bg-muted/20 rounded-b-2xl">
           <button 
             onClick={() => setShowAdd(true)}
             className="btn w-full flex items-center justify-center gap-2 bg-card border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary transition-all h-12 rounded-xl"
           >
             <PlusCircle className="size-5" />
             <span>Add Ad-Hoc Dose</span>
           </button>
        </div>
      </div>
    </div>
  );
}
