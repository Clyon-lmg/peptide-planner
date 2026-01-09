"use client";
import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { toast } from "sonner";

export default function AddAdHocDoseModal({ 
  date, 
  onClose, 
  onSuccess 
}: { 
  date: string, 
  onClose: () => void, 
  onSuccess: () => void 
}) {
  const [loading, setLoading] = useState(false);
  const [peptides, setPeptides] = useState<any[]>([]);
  const [selectedPeptideId, setSelectedPeptideId] = useState("");
  const [dose, setDose] = useState("");
  const [time, setTime] = useState("08:00");

  useEffect(() => {
    // Load inventory to let user pick
    const load = async () => {
      const sb = getSupabaseBrowser();
      const { data } = await sb.from("inventory_items").select("*, peptides(*)");
      if (data) setPeptides(data.map((i: any) => i.peptides));
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!selectedPeptideId || !dose) return;
    setLoading(true);
    const sb = getSupabaseBrowser();
    const { data: { user } } = await sb.auth.getUser();

    if (!user) {
        toast.error("Not authenticated");
        setLoading(false);
        return;
    }

    // 1. Get Active Protocol ID (Fixes DB Constraint Error)
    const { data: protocol } = await sb
        .from('protocols')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

    // 2. Insert with Protocol Link
    const { error } = await sb.from("doses").insert({
      user_id: user.id,
      protocol_id: protocol?.id || null, // Link to active protocol if exists
      peptide_id: Number(selectedPeptideId),
      dose_mg: Number(dose),
      date: date,
      date_for: date,
      time_of_day: time,
      status: "TAKEN", 
    });

    setLoading(false);
    if (error) {
        console.error("Ad-Hoc Insert Error:", error);
        toast.error("Failed to add dose");
    } else {
      toast.success("Dose added");
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-sm rounded-2xl shadow-xl border border-border p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">Add Dose for {date}</h3>
          <button onClick={onClose}><X className="size-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase font-bold text-muted-foreground">Peptide</label>
            <select 
              className="input w-full mt-1 h-10 px-3 rounded-md border bg-background"
              value={selectedPeptideId}
              onChange={e => setSelectedPeptideId(e.target.value)}
            >
              <option value="">Select...</option>
              {peptides.map(p => (
                <option key={p.id} value={p.id}>{p.canonical_name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase font-bold text-muted-foreground">Amount (mg)</label>
              <input 
                type="number" 
                className="input w-full mt-1 h-10 px-3 rounded-md border bg-background"
                placeholder="0.5"
                value={dose}
                onChange={e => setDose(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs uppercase font-bold text-muted-foreground">Time</label>
              <input 
                type="time" 
                className="input w-full mt-1 h-10 px-3 rounded-md border bg-background"
                value={time}
                onChange={e => setTime(e.target.value)}
              />
            </div>
          </div>

          <button 
            onClick={handleSave} 
            disabled={loading}
            className="btn w-full bg-primary text-primary-foreground h-10 rounded-md mt-2 font-medium hover:bg-primary/90 transition-colors"
          >
            {loading ? "Saving..." : "Log Dose"}
          </button>
        </div>
      </div>
    </div>
  );
}
