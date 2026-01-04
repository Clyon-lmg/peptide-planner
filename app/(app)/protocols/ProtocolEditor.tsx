"use client";
import React, { useEffect, useState } from "react";
import { Plus, Save, Play, Copy, Upload, X } from "lucide-react";
import ProtocolItemRow, {
    ProtocolItemState,
    InventoryPeptide,
    SiteList,
} from "./ProtocolItemRow";
import ProtocolGraph from "./ProtocolGraph";
import { onProtocolUpdated, setActiveProtocolAndRegenerate } from "@/lib/protocolEngine";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { toast } from "sonner";
import { ensurePeptideAndInventory } from "@/app/(app)/inventory/actions";

const COLOR_PALETTE = [
    "#f87171", "#60a5fa", "#34d399", "#fbbf24",
    "#a78bfa", "#f472b6", "#38bdf8", "#fb923c",
];

type Protocol = {
    id: number;
    user_id: string;
    is_active: boolean;
    name: string;
    start_date: string;
};

export default function ProtocolEditor({ protocol, onReload }: {
    protocol: Protocol;
    onReload: () => void;
}) {
    const supabase = React.useMemo(() => getSupabaseBrowser(), []);
    const [items, setItems] = useState<ProtocolItemState[]>([]);
    const [peptides, setPeptides] = useState<InventoryPeptide[]>([]);
    const [siteLists, setSiteLists] = useState<SiteList[]>([]);
    const [saving, setSaving] = useState(false);
    const [activating, setActivating] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [importText, setImportText] = useState("");

    useEffect(() => {
        (async () => {
            const { data: rawItems } = await supabase
                .from("protocol_items")
                .select("*")
                .eq("protocol_id", protocol.id)
                .order("id", { ascending: true });

            const mapped: ProtocolItemState[] = (rawItems || []).map((r: any, idx: number) => ({
                id: r.id,
                peptide_id: r.peptide_id,
                site_list_id: r.site_list_id ?? null,
                dose_mg_per_administration: Number(r.dose_mg_per_administration || 0),
                schedule: (r.schedule || "EVERYDAY") as any,
                custom_days: r.custom_days || [],
                cycle_on_weeks: Number(r.cycle_on_weeks || 0),
                cycle_off_weeks: Number(r.cycle_off_weeks || 0),
                every_n_days: r.every_n_days ? Number(r.every_n_days) : null,
                titration_interval_days: r.titration_interval_days ? Number(r.titration_interval_days) : null,
                titration_amount_mg: r.titration_amount_mg ? Number(r.titration_amount_mg) : null,
                color: r.color || COLOR_PALETTE[idx % COLOR_PALETTE.length],
                time_of_day: r.time_of_day || null,
            }));
            setItems(mapped);

            loadInventory();
        })();
    }, [protocol.id, supabase]);

    const loadInventory = async () => {
        const [{ data: vialInv }, { data: capInv }, { data: listData }] =
            await Promise.all([
                supabase.from("inventory_items").select("peptide_id, half_life_hours, peptides:peptide_id ( id, canonical_name )"),
                supabase.from("inventory_capsules").select("peptide_id, half_life_hours, peptides:peptide_id ( id, canonical_name )"),
                supabase.from("injection_site_lists").select("id, name").order("id", { ascending: true }),
            ]);

        const merged: Record<number, InventoryPeptide> = {};
        
        vialInv?.forEach((r: any) => {
            if (r.peptides) {
                merged[r.peptides.id] = { 
                    id: r.peptides.id, 
                    canonical_name: r.peptides.canonical_name, 
                    half_life_hours: Number(r.half_life_hours || 0),
                    kind: 'vial'
                };
            }
        });

        capInv?.forEach((r: any) => {
            if (r.peptides) {
                const existing = merged[r.peptides.id];
                merged[r.peptides.id] = { 
                    id: r.peptides.id, 
                    canonical_name: r.peptides.canonical_name, 
                    half_life_hours: Number(r.half_life_hours || 0),
                    kind: existing ? 'both' : 'capsule'
                };
            }
        });

        setPeptides(Object.values(merged).sort((a, b) => a.canonical_name.localeCompare(b.canonical_name)));
        setSiteLists(listData || []);
    };

    const addItem = () => {
        setItems(prev => [
            ...prev,
            {
                peptide_id: null,
                site_list_id: null,
                dose_mg_per_administration: 0,
                schedule: "EVERYDAY",
                custom_days: [],
                cycle_on_weeks: 0,
                cycle_off_weeks: 0,
                every_n_days: 1,
                color: COLOR_PALETTE[prev.length % COLOR_PALETTE.length],
                time_of_day: "08:00",
            },
        ]);
    };

    const save = async () => {
        setSaving(true);
        try {
            await supabase.from("protocol_items").delete().eq("protocol_id", protocol.id);

            const rows = items.filter(i => i.peptide_id).map(i => ({
                protocol_id: protocol.id,
                peptide_id: i.peptide_id,
                dose_mg_per_administration: i.dose_mg_per_administration,
                schedule: i.schedule,
                custom_days: i.schedule === "CUSTOM" ? i.custom_days : null,
                every_n_days: i.schedule === "EVERY_N_DAYS" ? i.every_n_days : null,
                cycle_on_weeks: i.cycle_on_weeks || 0,
                cycle_off_weeks: i.cycle_off_weeks || 0,
                titration_interval_days: i.titration_interval_days,
                titration_amount_mg: i.titration_amount_mg,
                color: i.color,
                time_of_day: i.time_of_day,
                site_list_id: i.site_list_id,
            }));

            if (rows.length) {
                const { error } = await supabase.from("protocol_items").insert(rows);
                if (error) throw error;
            }

            const { data: userRes } = await supabase.auth.getSession();
            if (userRes?.session?.user?.id) await onProtocolUpdated(protocol.id, userRes.session.user.id);

            toast.success("Protocol saved");
            onReload();
        } catch (e: any) {
            toast.error(e.message || "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    const activate = async () => {
        setActivating(true);
        try {
            const { data: userRes } = await supabase.auth.getSession();
            const userId = userRes?.session?.user?.id;
            if (!userId) throw new Error("No session");

            const result = await setActiveProtocolAndRegenerate(protocol.id, userId);
            if (result?.leftover) toast.warning(`${result.leftover} old doses could not be removed.`);
            else toast.success("Protocol active! Calendar generated.");

            onReload();
        } catch (e: any) {
            toast.error(e.message || "Activation failed");
        } finally {
            setActivating(false);
        }
    };

    // Export Logic
    const copyToReddit = async () => {
        const pepMap = new Map(peptides.map(p => [p.id, p]));
        const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const headers = ["Peptide", "Type", "Dose", "Schedule", "Notes"];
        const rows: string[][] = [];

        for (const item of items) {
            if (!item.peptide_id) continue;
            const p = pepMap.get(item.peptide_id);
            const name = p?.canonical_name || "Unknown";
            const typeLabel = p?.kind === 'capsule' ? 'Capsule' : (p?.kind === 'both' ? 'Mixed' : 'Vial');
            const dose = `${item.dose_mg_per_administration} mg`;

            let sched = "";
            if (item.schedule === "EVERYDAY") sched = "Daily";
            else if (item.schedule === "WEEKDAYS") sched = "Mon-Fri";
            else if (item.schedule === "EVERY_N_DAYS") sched = `E${item.every_n_days}D`;
            else if (item.schedule === "CUSTOM") {
                sched = (item.custom_days || []).map(d => DAYS[d]).join(", ");
            }

            const notesParts = [];
            if (item.time_of_day) notesParts.push(`@ ${item.time_of_day}`);
            if (item.cycle_on_weeks > 0) notesParts.push(`${item.cycle_on_weeks} wks ON / ${item.cycle_off_weeks} OFF`);
            if ((item.titration_interval_days || 0) > 0) {
                notesParts.push(`Titrate +${item.titration_amount_mg}mg / ${item.titration_interval_days} days`);
            }
            const notes = notesParts.join(", ") || "-";

            rows.push([name, typeLabel, dose, sched, notes]);
        }

        let md = `**Protocol: ${protocol.name}**\n\n`;
        md += `| ${headers.join(" | ")} |\n`;
        md += `| ${headers.map(()=>"---").join(" | ")} |\n`;
        rows.forEach(r => md += `| ${r.join(" | ")} |\n`);
        md += `\n*Generated via Peptide Planner*`;

        let html = `
            <html><body><p><strong>Protocol: ${protocol.name}</strong></p>
            <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; border: 1px solid #ccc; font-family: sans-serif;">
                <thead><tr style="background-color: #f0f0f0;">${headers.map(h => `<th style="border: 1px solid #ccc; padding: 8px;">${h}</th>`).join("")}</tr></thead>
                <tbody>${rows.map(row => `<tr>${row.map(c => `<td style="border: 1px solid #ccc; padding: 8px;">${c}</td>`).join("")}</tr>`).join("")}</tbody>
            </table><p><em>Generated via Peptide Planner</em></p></body></html>
        `;

        try {
            const blobHtml = new Blob([html], { type: "text/html" });
            const blobText = new Blob([md], { type: "text/plain" });
            const data = [new ClipboardItem({ "text/html": blobHtml, "text/plain": blobText })];
            await navigator.clipboard.write(data);
            toast.success("Table copied! Paste directly into Reddit.");
        } catch (err) {
            try {
                await navigator.clipboard.writeText(md);
                toast.warning("Rich text copy failed. Copied Markdown.");
            } catch (e) { toast.error("Clipboard access denied."); }
        }
    };

    const handleImport = async () => {
        setSaving(true);
        try {
            const newItems: ProtocolItemState[] = [];
            let cleanText = importText
                .replace(/Protocol:.*?(?:\n|$)/gi, "")
                .replace(/PeptideTypeDoseScheduleNotes/gi, "")
                .replace(/Peptide\s*\|\s*Type\s*\|\s*Dose/gi, "")
                .replace(/[\r\n]+/g, " ");

            const blobRegex = /(?<name>.+?)(?<type>Vial|Capsule|Cap|Mixed)(?<dose>[\d\.]+)\s*(?<unit>mg|mcg)(?<schedule>.+?)(?<time>@\s*\d{1,2}:\d{2})/gi;
            const matches = [...cleanText.matchAll(blobRegex)];

            for (const match of matches) {
                if (!match.groups) continue;
                const { name, type, dose, unit, schedule } = match.groups;
                const cleanName = name.replace(/Notes$/i, "").trim();

                if (cleanName && type && dose) {
                    await addItemToState(cleanName, type, dose + unit, schedule);
                }
            }

            async function addItemToState(name: string, typeRaw: string, doseRaw: string, schedRaw: string) {
                const kind = typeRaw.toLowerCase().includes("cap") ? 'capsule' : 'peptide';
                const dose = parseFloat(doseRaw.replace(/[^0-9.]/g, ""));
                
                let schedule: any = "EVERYDAY";
                let every_n: number | null = null;
                let custom_days: number[] = [];
                const s = schedRaw.toLowerCase();

                if (s.includes("daily") || s.includes("everyday")) schedule = "EVERYDAY";
                else if (s.includes("mon-fri") || s.includes("weekdays")) schedule = "WEEKDAYS";
                else if (s.match(/e(\d+)d/)) {
                    schedule = "EVERY_N_DAYS";
                    const match = s.match(/e(\d+)d/);
                    if (match) every_n = parseInt(match[1]);
                } else if (s.includes(",")) {
                    schedule = "CUSTOM";
                    const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
                    custom_days = DAYS.map((d, i) => s.includes(d) ? i : -1).filter(i => i !== -1);
                }

                const { peptideId } = await ensurePeptideAndInventory(name, kind as "peptide" | "capsule");
                newItems.push({
                    peptide_id: peptideId,
                    site_list_id: null,
                    dose_mg_per_administration: isNaN(dose) ? 0 : dose,
                    schedule,
                    every_n_days: every_n,
                    custom_days,
                    cycle_on_weeks: 0,
                    cycle_off_weeks: 0,
                    color: COLOR_PALETTE[newItems.length % COLOR_PALETTE.length],
                    time_of_day: "08:00"
                });
            }

            if (newItems.length > 0) {
                setItems(prev => [...prev, ...newItems]);
                await loadInventory();
                toast.success(`Imported ${newItems.length} items`);
                setShowImport(false);
                setImportText("");
            } else {
                toast.error("No valid items recognized.");
            }
        } catch (e: any) {
            toast.error("Import failed: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 pb-32">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="pp-h2">{protocol.name}</h2>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                        {protocol.is_active ? (
                            <span className="text-emerald-500 font-medium flex items-center gap-1"><Play className="size-3 fill-current" /> Active</span>
                        ) : (
                            <span className="text-muted-foreground">Inactive</span>
                        )}
                        <span>• {items.length} items</span>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {items.map((it, idx) => (
                    <ProtocolItemRow
                        key={idx}
                        value={it}
                        peptides={peptides}
                        siteLists={siteLists}
                        onChange={(v) => {
                            const next = [...items];
                            next[idx] = v;
                            setItems(next);
                        }}
                        onDelete={() => {
                            const next = [...items];
                            next.splice(idx, 1);
                            setItems(next);
                        }}
                    />
                ))}
            </div>

            <button
                onClick={addItem}
                className="w-full py-4 border-2 border-dashed border-border rounded-2xl text-muted-foreground hover:text-foreground hover:bg-muted/5 hover:border-muted transition-colors flex items-center justify-center gap-2 font-medium"
            >
                <Plus className="size-5" /> Add Peptide
            </button>

            <ProtocolGraph items={items} peptides={peptides} />

            {showImport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-border flex items-center justify-between">
                            <h3 className="font-bold">Import Protocol</h3>
                            <button onClick={() => setShowImport(false)}><X className="size-5" /></button>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto">
                            <p className="text-sm text-muted-foreground mb-2">Paste text (Normal or Mangled)</p>
                            <textarea
                                className="w-full h-64 input font-mono text-xs"
                                placeholder="Paste here..."
                                value={importText}
                                onChange={e => setImportText(e.target.value)}
                            />
                        </div>
                        <div className="p-4 border-t border-border flex justify-end gap-2">
                            <button onClick={() => setShowImport(false)} className="btn hover:bg-muted">Cancel</button>
                            <button onClick={handleImport} className="btn bg-primary text-primary-foreground" disabled={saving}>
                                {saving ? "Importing..." : "Parse & Import"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 🟢 FIXED: z-[60] ensures this floats ABOVE the Mobile Navigation bar (z-50) */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t border-border z-[60] lg:pl-[340px]">
                <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
                    <div className="flex gap-2">
                        <button onClick={copyToReddit} className="btn border-border bg-card hover:bg-muted/20 text-muted-foreground hover:text-foreground text-xs h-10 px-3 flex items-center gap-2">
                            <Copy className="size-4" /><span className="hidden sm:inline">Export</span>
                        </button>
                        <button onClick={() => setShowImport(true)} className="btn border-border bg-card hover:bg-muted/20 text-muted-foreground hover:text-foreground text-xs h-10 px-3 flex items-center gap-2">
                            <Upload className="size-4" /><span className="hidden sm:inline">Import</span>
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={activate} disabled={activating} className={`btn bg-emerald-600 hover:bg-emerald-700 text-white border-transparent ${activating ? "opacity-50" : ""}`}>
                            {activating ? "Activating..." : "Set Active & Generate"}
                        </button>
                        <button onClick={save} disabled={saving} className="btn bg-primary text-primary-foreground hover:bg-primary/90 min-w-[100px]">
                            {saving ? "Saving..." : <><Save className="size-4 mr-2" /> Save</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
