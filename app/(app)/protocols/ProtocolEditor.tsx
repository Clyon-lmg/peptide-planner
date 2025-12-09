"use client";
import React, { useEffect, useState } from "react";
import { Plus, Save, Play, AlertTriangle } from "lucide-react";
import ProtocolItemRow, {
    ProtocolItemState,
    InventoryPeptide,
    SiteList,
} from "./ProtocolItemRow";
import ProtocolGraph from "./ProtocolGraph";
import { onProtocolUpdated, setActiveProtocolAndRegenerate } from "@/lib/protocolEngine";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { toast } from "sonner";

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

    useEffect(() => {
        (async () => {
            const { data: rawItems, error: itemsErr } = await supabase
                .from("protocol_items")
                .select("*")
                .eq("protocol_id", protocol.id)
                .order("id", { ascending: true });
            if (itemsErr) console.error(itemsErr);

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

            const [{ data: vialInv }, { data: capInv }, { data: listData }] =
                await Promise.all([
                    supabase.from("inventory_items").select("peptide_id, half_life_hours, peptides:peptide_id ( id, canonical_name )"),
                    supabase.from("inventory_capsules").select("peptide_id, half_life_hours, peptides:peptide_id ( id, canonical_name )"),
                    supabase.from("injection_site_lists").select("id, name").order("id", { ascending: true }),
                ]);

            const merged: Record<number, InventoryPeptide> = {};
            const process = (rows: any[]) => rows?.forEach((r: any) => {
                if (r.peptides) merged[r.peptides.id] = { id: r.peptides.id, canonical_name: r.peptides.canonical_name, half_life_hours: Number(r.half_life_hours || 0) };
            });
            process(vialInv || []);
            process(capInv || []);

            setPeptides(Object.values(merged).sort((a, b) => a.canonical_name.localeCompare(b.canonical_name)));
            setSiteLists(listData || []);
        })();
    }, [protocol.id, supabase]);

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

            {/* Floating Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t border-border z-40 lg:pl-[280px]">
                <div className="max-w-5xl mx-auto flex items-center justify-end gap-3">
                    <button
                        onClick={activate}
                        disabled={activating}
                        className={`btn bg-emerald-600 hover:bg-emerald-700 text-white border-transparent ${activating ? "opacity-50" : ""}`}
                    >
                        {activating ? "Activating..." : "Set Active & Generate"}
                    </button>
                    <button
                        onClick={save}
                        disabled={saving}
                        className="btn bg-primary text-primary-foreground hover:bg-primary/90 min-w-[100px]"
                    >
                        {saving ? "Saving..." : <><Save className="size-4 mr-2" /> Save</>}
                    </button>
                </div>
            </div>
        </div>
    );
}