"use client";
import React, { useState } from "react";
import { X, Check, Trash2, Syringe } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { toast } from "sonner";
import AddAdHocDoseModal from "./AddAdHocDoseModal";
import { logDose, resetDose } from "@/app/(app)/today/actions";

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

  const toggleStatus = async (dose: any) => {
    const isTaken = dose.status === "TAKEN";
    const idKey = dose.peptide_id.toString();
    
    setProcessing(idKey);
    try {
      if (isTaken) {
        await resetDose(dose.peptide_id, date);
        toast.success("Dose reset");
      } else {
        await logDose(dose.peptide_id, date);
        toast.success("Dose logged");
      }
      onUpdate();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update status");
    } finally {
      setProcessing(null);
    }
  };

  const deleteDose = async (id: number) => {
    if (!id) return; 
    if (!confirm("Delete this dose record?")) return;
    
    const sb = getSupabaseBrowser();
    await sb.from("doses").delete().eq("id", id);
    onUpdate();
  };

  if (showAdd) {
    return (
      <AddAdHocDoseModal 
        date={date} 
        onClose={() => setShowAdd(false)} 
        onSuccess={() => { setShowAdd(false); onUpdate(); }} 
      />
    );
  }

  const dateObj = new Date(date + 'T12:00:00');
  const dateLabel = dateObj.toDateString();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-border flex justify-between items-center bg-muted/20 rounded-t-2xl">
          <div>
             <h3 className="font-bold text-lg">{dateLabel}</h3>
             <p className="text-xs text-muted-foreground">{doses.length} scheduled events</p>
          </div>
          <button onClick={onClose}><X className="size-5" /></button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {doses.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No doses.</p>}
          {doses.map((dose, idx) => {
               const isTaken = dose.status === "TAKEN";
               const key = dose.id ? `dose-${dose.id}` : `virt-${dose.peptide_id}-${idx}`;

               return (
                 <div key={key} className={`flex items-center justify-between p-3 rounded-xl border ${isTaken ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-card border-border'}`}>
                    <div className="flex items-center gap-3">
                       <div className={`size-10 rounded-full flex items-center justify-center ${isTaken ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
                          {isTaken ? <Check className="size-5" /> : <Syringe className="size-5" />}
                       </div>
                       <div>
                          <p className="font-bold text-sm">{dose.canonical_name || dose.peptides?.canonical_name}</p>
                          <p className="text-xs text-muted-foreground">{dose.dose_mg} mg</p>
                       </div>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => toggleStatus(dose)} 
                        disabled={processing === dose.peptide_id.toString()} 
                        className={`btn text-xs h-8 px-3 border transition-colors ${isTaken ? 'bg-background hover:bg-muted' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                      >
                        {isTaken ? "Unlog" : "Log"}
                      </button>
                      
                      {dose.id && (
                        <button onClick={() => deleteDose(dose.id)} className="p-2 text-muted-foreground hover:text-red-500">
                            <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                 </div>
               );
          })}
        </div>
      </div>
    </div>
  );
}
