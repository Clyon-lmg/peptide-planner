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

    const parseLine = (line: string): ImportItem | null => {
        // 1. CLEANUP
        line = line.trim();
        if (!line || line.startsWith("|---") || line.toLowerCase().startsWith("peptide")) return null;

        // 2. TRY STANDARD MARKDOWN (Pipe Separated)
        if (line.includes("|")) {
            const parts = line.split("|").map(s => s.trim()).filter(s => s);
            // Handle optional leading/trailing empty strings from pipes
            if (parts.length < 3) return null;
            
            // Heuristic for columns
            let name = parts[0];
            let typeRaw = "vial";
            let doseRaw = "";
            let schedRaw = "";

            const isType = (s: string) => ["vial", "capsule", "cap", "mixed"].some(k => s.toLowerCase().includes(k));

            if (isType(parts[1])) {
                typeRaw = parts[1];
                doseRaw = parts[2];
                schedRaw = parts[3] || "";
            } else {
                doseRaw = parts[1];
                schedRaw = parts[2] || "";
            }

            return buildItem(name, typeRaw, doseRaw, schedRaw);
        }

        // 3. TRY SMART RESCUE (Mangled Text)
        // Regex looks for: [Name][Type][Dose][Unit][Schedule]@[Time]
        // Example: "SS-31Vial1.5 mgDaily@ 08:00"
        const mangledRegex = /^(.+?)(Vial|Capsule|Cap|Mixed)([\d\.]+)\s*(mg|mcg)(.+?)(@\s*\d{1,2}:\d{2})?$/i;
        const match = line.match(mangledRegex);

        if (match) {
            // match[1] = Name "SS-31"
            // match[2] = Type "Vial"
            // match[3] = Dose "1.5"
            // match[4] = Unit "mg"
            // match[5] = Schedule "Daily"
            // match[6] = Time "@ 08:00" (optional)
            return buildItem(match[1], match[2], match[3] + match[4], match[5]);
        }

        return null;
    };

    const buildItem = (name: string, typeRaw: string, doseRaw: string, schedRaw: string): ImportItem => {
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

        return { name: name.trim(), kind, dose, schedule, every_n_days: every_n, custom_days };
    };

    const handleImport = async () => {
        setLoading(true);
        try {
            const nameMatch = text.match(/\*\*Protocol:\s*(.*?)\*\*/);
            const protocolName = nameMatch ? nameMatch[1].trim() : "Imported Protocol";

            const items: ImportItem[] = [];
            const lines = text.split("\n");

            for (const line of lines) {
                const item = parseLine(line);
                if (item) items.push(item);
            }

            if (items.length === 0) throw new Error("No recognized items found. Ensure text includes 'Vial' or 'Cap' and dosages.");

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
                        Paste text from Reddit or Markdown. <br/>
                        <span className="text-xs opacity-70">We can now read "mangled" text (e.g. "BPC-157Vial5mg") copied from browsers.</span>
                    </p>
                    <textarea
                        className="w-full h-48 input font-mono text-xs p-3 leading-relaxed"
                        placeholder="Paste here..."
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
