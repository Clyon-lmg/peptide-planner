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
            // 1. Extract Protocol Name (if present)
            const nameMatch = text.match(/Protocol:\s*(.*?)(?:\n|$)/i);
            const protocolName = nameMatch ? nameMatch[1].trim() : "Imported Protocol";

            const items: ImportItem[] = [];
            const lines = text.split("\n");

            // 2. PARSE LINE BY LINE
            for (const line of lines) {
                const l = line.trim();
                if (!l) continue;

                // SKIP HEADERS: Ignore lines that look like table headers
                if (l.match(/^(Peptide|Protocol|Type|Dose|Schedule)/i)) continue;
                if (l.includes("---|---")) continue;

                // STRATEGY A: Standard Markdown (Pipe Separated)
                if (l.includes("|")) {
                    const parts = l.split("|").map(s => s.trim()).filter(s => s);
                    if (parts.length >= 3) {
                         // Check if column 1 is Type (Vial/Cap)
                         const isType = (s: string) => ["vial", "capsule", "cap", "mixed"].some(k => s.toLowerCase().includes(k));
                         if (isType(parts[1])) {
                             items.push(buildItem(parts[0], parts[1], parts[2], parts[3]||""));
                         } else {
                             items.push(buildItem(parts[0], "vial", parts[1], parts[2]||""));
                         }
                    }
                    continue; // Done with this line
                }

                // STRATEGY B: Flexible Column Regex (Tabs/Spaces)
                // Looks for: [Name] [Type] [Dose] [Unit] [Schedule] [Time (Optional)]
                // \s+ handles tabs or spaces
                const colRegex = /^(?<name>.+?)\s+(?<type>Vial|Capsule|Cap|Mixed)\s+(?<dose>[\d\.]+)\s*(?<unit>mg|mcg)\s+(?<schedule>.+?)(\s+(?<time>@\s*\d{1,2}:\d{2}))?$/i;
                
                const match = l.match(colRegex);
                if (match && match.groups) {
                    const { name, type, dose, unit, schedule } = match.groups;
                    items.push(buildItem(name, type, dose + unit, schedule));
                }
            }

            // 3. FALLBACK: If line-by-line failed (e.g. copy-paste stripped newlines)
            if (items.length === 0) {
                // "Blob" Regex for mashed text
                const blobRegex = /(?<name>.+?)(?<type>Vial|Capsule|Cap|Mixed)(?<dose>[\d\.]+)\s*(?<unit>mg|mcg)(?<schedule>.+?)(?<time>@\s*\d{1,2}:\d{2})/gi;
                // Pre-clean garbage headers
                const cleanText = text.replace(/PeptideTypeDoseScheduleNotes/gi, "").replace(/[\r\n]+/g, " ");
                
                const matches = [...cleanText.matchAll(blobRegex)];
                for (const match of matches) {
                    if (!match.groups) continue;
                    let { name, type, dose, unit, schedule } = match.groups;
                    name = name.replace(/Protocol:.*?Notes/i, "").trim();
                    items.push(buildItem(name, type, dose + unit, schedule));
                }
            }

            if (items.length === 0) throw new Error("No recognized items found.");

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
                        <span className="text-xs opacity-70">Works with tables, tabs, or copy-pasted text.</span>
                    </p>
                    <textarea
                        className="w-full h-48 input font-mono text-xs p-3 leading-relaxed whitespace-pre"
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
