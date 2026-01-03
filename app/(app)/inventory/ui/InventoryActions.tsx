"use client";

import React, { useState } from 'react';
import { Copy, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { importInventoryItemAction } from "../actions";

export default function InventoryActions({ vials, capsules }: { vials: any[], capsules: any[] }) {
    const [showImport, setShowImport] = useState(false);
    const [importText, setImportText] = useState("");
    const [loading, setLoading] = useState(false);

    const handleExport = async () => {
        let md = `**Inventory List**\n\n`;
        // Pipe-less format for Reddit compatibility
        md += `Name | Type | Stock | Conc | Note\n`;
        md += `---|---|---|---|---\n`;
        
        vials.forEach(v => {
            md += `${v.name} | Vial | ${v.vials} | ${v.mg_per_vial} mg/vial | ${v.bac_ml}ml BAC\n`;
        });
        capsules.forEach(c => {
            md += `${c.name} | Capsule | ${c.bottles} | ${c.mg_per_cap} mg/cap | ${c.caps_per_bottle} caps/btl\n`;
        });
        
        try {
            await navigator.clipboard.writeText(md);
            toast.success("Copied Inventory List!");
        } catch (e) { toast.error("Failed to copy"); }
    };

    const handleImport = async () => {
        setLoading(true);
        try {
            const lines = importText.split("\n");
            let count = 0;
            for (const line of lines) {
                if (!line.includes("|") || line.includes("---|---")) continue;
                const parts = line.split("|").map(s => s.trim()).filter(s => s);
                // Adjust for optional empty strings if they paste a pipe-formatted table
                // parts might look like ["Name", "Type", ...] or ["", "Name", "Type", ..., ""]
                
                // Remove empty start/end if present
                if (parts.length > 0 && parts[0] === "") parts.shift();
                if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();

                if (parts.length < 3) continue;
                if (parts[0].toLowerCase() === "name") continue;

                const name = parts[0];
                const typeRaw = parts[1].toLowerCase();
                
                const stock = parseFloat(parts[2]?.replace(/[^0-9.]/g, "") || "0");
                const conc = parseFloat(parts[3]?.replace(/[^0-9.]/g, "") || "0");
                
                let conc2 = 0;
                if (parts[4]) conc2 = parseFloat(parts[4].replace(/[^0-9.]/g, ""));

                const kind = (typeRaw.includes("cap") || typeRaw.includes("mixed")) ? "capsule" : "peptide";
                
                await importInventoryItemAction(
                    name, 
                    kind, 
                    isNaN(stock) ? 0 : stock, 
                    isNaN(conc) ? 0 : conc, 
                    isNaN(conc2) ? 0 : conc2
                );
                count++;
            }
            toast.success(`Imported/Updated ${count} items`);
            setShowImport(false);
            setImportText("");
        } catch (e: any) {
            toast.error("Import failed: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="flex gap-2">
                <button onClick={handleExport} className="btn h-9 px-3 text-xs bg-card border-border hover:bg-muted text-muted-foreground hover:text-foreground flex items-center gap-2">
                    <Copy className="size-4" /> Export Inventory List
                </button>
                <button onClick={() => setShowImport(true)} className="btn h-9 px-3 text-xs bg-card border-border hover:bg-muted text-muted-foreground hover:text-foreground flex items-center gap-2">
                    <Upload className="size-4" /> Import Inventory Item
                </button>
            </div>

             {showImport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-border flex items-center justify-between">
                            <h3 className="font-bold">Import Inventory</h3>
                            <button onClick={() => setShowImport(false)}><X className="size-5" /></button>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto">
                            <p className="text-sm text-muted-foreground mb-2">Paste a Markdown table row to update stock.</p>
                            <div className="bg-muted/30 p-2 rounded mb-2 text-xs font-mono text-muted-foreground">
                                Name | Type | Stock | Conc | Note/Vol<br/>
                                BPC-157 | Vial | 5 | 5mg | 3ml<br/>
                                5-Amino | Capsule | 2 | 50mg | 60
                            </div>
                            <textarea 
                                className="w-full h-48 input font-mono text-xs" 
                                placeholder="Name | Type | Stock | Conc | Note"
                                value={importText}
                                onChange={e => setImportText(e.target.value)}
                            />
                        </div>
                        <div className="p-4 border-t border-border flex justify-end gap-2">
                            <button onClick={() => setShowImport(false)} className="btn hover:bg-muted">Cancel</button>
                            <button onClick={handleImport} className="btn bg-primary text-primary-foreground" disabled={loading}>
                                {loading ? "Importing..." : "Process"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
