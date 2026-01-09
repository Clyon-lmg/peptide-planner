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

  const toggleStatus = async (dose: any) => {
    setProcessing(String(dose.id));
    const sb = getSupabaseBrowser();
    const newStatus = dose.status === "LOGGED" ? "PENDING" : "LOGGED";
    await sb.from("doses").update({ status: newStatus }).eq("id", dose.id);
    setProcessing(null);
    onUpdate();
  };

  const deleteDose = async (id: number) => {
    if (!confirm("Delete this dose?")) return;
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-border flex justify-between items-center bg-muted/20 rounded-t-2xl">
          <div>
             <h3 className="font-bold text-lg">{new Date(date + 'T12:00:00').toDateString()}</h3>
             <p className="text-xs text-muted-foreground">{doses.length} scheduled events</p>
          </div>
          <button onClick={onClose}><X className="size-5" /></button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {doses.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No doses.</p>}
          {doses.map((dose) => {
               const isLogged = dose.status === "LOGGED";
               return (
                 <div key={dose.id} className={`flex items-center justify-between p-3 rounded-xl border ${isLogged ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-card border-border'}`}>
                    <div className="flex items-center gap-3">
                       <div className={`size-10 rounded-full flex items-center justify-center ${isLogged ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
                          {isLogged ? <Check className="size-5" /> : <Syringe className="size-5" />}
                       </div>
                       <div>
                          <p className="font-bold text-sm">{dose.canonical_name || dose.peptides?.canonical_name}</p>
                          <p className="text-xs text-muted-foreground">{dose.dose_mg} mg</p>
                       </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => toggleStatus(dose)} disabled={!!processing} className="btn text-xs h-8 px-2 border">{isLogged ? "Unlog" : "Log"}</button>
                      <button onClick={() => deleteDose(dose.id)} className="p-2 text-muted-foreground hover:text-red-500"><Trash2 className="size-4" /></button>
                    </div>
                 </div>
               );
          })}
        </div>

        <div className="p-4 border-t border-border bg-muted/20 rounded-b-2xl">
           <button onClick={() => setShowAdd(true)} className="btn w-full flex items-center justify-center gap-2 border-dashed border-border h-12">
             <PlusCircle className="size-5" /> Add Ad-Hoc Dose
           </button>
        </div>
      </div>
    </div>
  );
}
