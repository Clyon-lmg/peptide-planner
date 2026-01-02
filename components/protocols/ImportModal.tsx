"use client";

import React, { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { createImportedProtocolAction, type ImportItem } from '@/app/(app)/protocols/actions';

export default function ImportModal({ 
    isOpen, 
    onClose, 
    onSuccess 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    onSuccess?: (id: number) => void; 
}) {
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleImport = async () => {
        setLoading(true);
        try {
            // 1. Extract Name (e.g. "**Protocol: Bulking**")
            const nameMatch = text.match(/\*\*Protocol:\s*(.*?)\*\*/);
            const protocolName = nameMatch ? nameMatch[1].trim() : "Imported Protocol";

            // 2. Parse Items
            const items: ImportItem[] = [];
            const lines = text.split("\n");

            for (const line of lines) {
                if (!line.includes("|") || line.includes("---|---")) continue;
                const parts = line.split("|").map(s => s.trim()).filter(s => s);
                if (parts.length < 3) continue;
                if (parts[0].toLowerCase() === "peptide") continue; // Skip Header

                // Parse columns: | Name | Type | Dose | Schedule |
                // Supports both "Name | Type | Dose" (New) and "Name | Dose | Schedule" (Old)
                let name = parts[0];
                let typeRaw = "vial";
                let doseRaw = "";
                let schedRaw = "";

                // Heuristic: Check if col 2 is "Vial"/"Cap" (New Format) or Dose (Old Format)
                const isType = (s: string) => ["vial", "capsule", "cap", "mixed"].some(k => s.toLowerCase().includes(k));

                if (isType(parts[1])) {
                    typeRaw = parts[1];
                    doseRaw = parts[2];
                    schedRaw = parts[3] || "";
                } else {
                    doseRaw = parts[1];
                    schedRaw = parts[2] || "";
                }

                // Parse Fields
                const kind = typeRaw.toLowerCase().includes("cap") ? 'capsule' : 'peptide';
                const dose = parseFloat(doseRaw.replace(/[^0-9.]/g, "")) || 0;
                
                let schedule = "EVERYDAY";
                let every_n: number | undefined = undefined;
                let custom_days: number[] | undefined = undefined;

                const s = schedRaw.toLowerCase();
                if (s.includes("mon-fri") || s.includes("weekdays")) schedule = "WEEKDAYS";
                else if (s.match(/e(\d+)d/)) {
                    schedule = "EVERY_N_DAYS";
                    const match = s.match(/e(\d+)d/);
                    if (match) every_n = parseInt(match[1]);
                } else if (s.includes(",")) {
                    schedule = "CUSTOM";
                    const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
                    custom_days = DAYS.map((d, i) => s.includes(d) ? i : -1).filter(i => i !== -1);
                }

                items.push({ name, kind, dose, schedule, every_n_days: every_n, custom_days });
            }

            if (items.length === 0) throw new Error("No valid items found.");

            // 3. Call Server Action
            const newProto = await createImportedProtocolAction(protocolName, items);
            
            toast.success(`Created "${newProto.name}" with ${items.length} items.`);
            setText("");
            if (onSuccess) onSuccess(newProto.id);
            onClose();

        } catch (e: any) {
            toast.error(e.message || "Import failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <h3 className="font-bold text-lg">Import Protocol</h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button>
                </div>
                <div className="p-4 flex-1 overflow-y-auto">
                    <p className="text-sm text-muted-foreground mb-3">
                        Paste a Markdown table below. A new protocol will be created.
                    </p>
                    <div className="bg-muted/30 p-3 rounded-xl mb-3 text-xs font-mono text-muted-foreground border border-border/50">
                        **Protocol: Bulking Stack**<br/><br/>
                        | Peptide | Type | Dose | Schedule |<br/>
                        | BPC-157 | Vial | 500mcg | Daily |<br/>
                        | 5-Amino | Cap | 50mg | E2D |
                    </div>
                    <textarea
                        className="w-full h-48 input font-mono text-xs p-3 leading-relaxed"
                        placeholder="Paste markdown here..."
                        value={text}
                        onChange={e => setText(e.target.value)}
                    />
                </div>
                <div className="p-4 border-t border-border flex justify-end gap-2 bg-muted/5">
                    <button onClick={onClose} className="btn hover:bg-muted text-sm">Cancel</button>
                    <button 
                        onClick={handleImport} 
                        className="btn bg-primary text-primary-foreground hover:bg-primary/90 text-sm flex items-center gap-2"
                        disabled={loading}
                    >
                        {loading ? "Creating..." : <><Upload className="size-4" /> Import & Create</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
