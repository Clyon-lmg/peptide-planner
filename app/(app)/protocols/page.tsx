"use client";
import React from "react";
import { Plus, Trash2, Edit2, List, ChevronRight } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import ProtocolEditor from "./ProtocolEditor";
import InjectionSiteListEditor from "./InjectionSiteListEditor";
import { toast } from "sonner";
import Card from "@/components/layout/Card"; // Ensure we use the Card component for consistency

type Protocol = {
    id: number;
    user_id: string;
    is_active: boolean;
    name: string;
    start_date: string;
};

type SiteList = {
    id: number;
    user_id: string;
    name: string;
};

export default function ProtocolsPage() {
    const supabase = React.useMemo(() => getSupabaseBrowser(), []);
    const [protocols, setProtocols] = React.useState<Protocol[]>([]);
    const [siteLists, setSiteLists] = React.useState<SiteList[]>([]);
    const [selectedId, setSelectedId] = React.useState<number | null>(null);
    const [selectedListId, setSelectedListId] = React.useState<number | null>(null);

    // Mobile: Toggle visibility of the list
    const [showListOnMobile, setShowListOnMobile] = React.useState(true);

    const reload = React.useCallback(async () => {
        const [protoRes, listRes] = await Promise.all([
            supabase.from("protocols").select("*").order("id", { ascending: true }),
            supabase.from("injection_site_lists").select("*").order("id", { ascending: true }),
        ]);
        if (protoRes.data) setProtocols(protoRes.data);
        if (listRes.data) setSiteLists(listRes.data);

        // Auto-select first if nothing selected
        if (!selectedId && !selectedListId) {
            if (protoRes.data?.length) setSelectedId(protoRes.data[0].id);
        }
    }, [supabase, selectedId, selectedListId]);

    React.useEffect(() => {
        reload();
    }, [reload]);

    const createProtocol = async () => {
        const name = prompt("Protocol Name:");
        if (!name) return;
        const { error } = await supabase.from("protocols").insert([{ name, is_active: false }]);
        if (error) toast.error(error.message);
        else {
            await reload();
            toast.success("Protocol created");
        }
    };

    const deleteProtocol = async (id: number) => {
        if (!confirm("Delete this protocol?")) return;
        await supabase.from("protocols").delete().eq("id", id);
        await reload();
        setSelectedId(null);
    };

    const renameProtocol = async (p: Protocol) => {
        const name = prompt("Rename protocol:", p.name);
        if (!name || name === p.name) return;
        await supabase.from("protocols").update({ name }).eq("id", p.id);
        await reload();
    };

    const createSiteList = async () => {
        const { data, error } = await supabase.from("injection_site_lists").insert([{ name: "New Site List" }]).select().single();
        if (error) toast.error(error.message);
        else {
            await reload();
            setSelectedListId(data.id);
            setSelectedId(null);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-100px)]">

            {/* SIDEBAR LIST */}
            <aside className={`lg:w-80 shrink-0 space-y-6 ${showListOnMobile ? 'block' : 'hidden lg:block'}`}>

                {/* Protocols Section */}
                <Card className="p-0 overflow-hidden border-border/60">
                    <div className="p-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Your Protocols</h3>
                        <button
                            onClick={createProtocol}
                            className="text-primary hover:bg-primary/10 p-1.5 rounded-lg transition-colors"
                            title="New Protocol"
                        >
                            <Plus className="size-4" />
                        </button>
                    </div>

                    <div className="p-2 space-y-1">
                        {protocols.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">No protocols yet.</div>}
                        {protocols.map(p => {
                            const isSelected = selectedId === p.id;
                            return (
                                <div
                                    key={p.id}
                                    onClick={() => { setSelectedId(p.id); setSelectedListId(null); setShowListOnMobile(false); }}
                                    className={`
                                    group relative flex items-center justify-between px-3 py-3 rounded-lg cursor-pointer transition-all
                                    ${isSelected
                                            ? "bg-primary/10 text-primary font-medium"
                                            : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                                        }
                                `}
                                >
                                    <div className="min-w-0 flex flex-col">
                                        <span className="truncate">{p.name}</span>
                                        {p.is_active && <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wide">Active</span>}
                                    </div>

                                    {/* Hover Actions */}
                                    <div className={`flex items-center gap-1 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); renameProtocol(p); }}
                                            className="p-1.5 rounded-md hover:bg-background/50 text-muted-foreground hover:text-foreground"
                                        >
                                            <Edit2 className="size-3.5" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteProtocol(p.id); }}
                                            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                        >
                                            <Trash2 className="size-3.5" />
                                        </button>
                                    </div>
                                    {isSelected && <div className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r-full" />}
                                </div>
                            )
                        })}
                    </div>
                </Card>

                {/* Site Lists Section */}
                <Card className="p-0 overflow-hidden border-border/60">
                    <div className="p-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Site Lists</h3>
                        <button
                            onClick={createSiteList}
                            className="text-primary hover:bg-primary/10 p-1.5 rounded-lg transition-colors"
                            title="New Site List"
                        >
                            <Plus className="size-4" />
                        </button>
                    </div>

                    <div className="p-2 space-y-1">
                        {siteLists.map(l => {
                            const isSelected = selectedListId === l.id;
                            return (
                                <div
                                    key={l.id}
                                    onClick={() => { setSelectedListId(l.id); setSelectedId(null); setShowListOnMobile(false); }}
                                    className={`
                                    group flex items-center justify-between px-3 py-3 rounded-lg cursor-pointer transition-all
                                    ${isSelected
                                            ? "bg-primary/10 text-primary font-medium"
                                            : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                                        }
                                `}
                                >
                                    <span className="truncate">{l.name}</span>
                                    {isSelected && <ChevronRight className="size-4 opacity-50" />}
                                </div>
                            )
                        })}
                    </div>
                </Card>
            </aside>

            {/* MAIN EDITOR AREA */}
            <main className="flex-1 min-w-0">
                {/* Mobile "Back to Menu" button */}
                <div className="lg:hidden mb-4">
                    <button
                        onClick={() => setShowListOnMobile(!showListOnMobile)}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors font-medium px-2 py-2 rounded-lg hover:bg-muted/30"
                    >
                        <List className="size-4" /> {showListOnMobile ? "Hide Menu" : "Back to List"}
                    </button>
                </div>

                {!showListOnMobile && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {selectedId && protocols.find(p => p.id === selectedId) && (
                            <ProtocolEditor
                                protocol={protocols.find(p => p.id === selectedId)!}
                                onReload={reload}
                            />
                        )}
                        {selectedListId && siteLists.find(l => l.id === selectedListId) && (
                            <InjectionSiteListEditor
                                list={siteLists.find(l => l.id === selectedListId)!}
                                onReload={reload}
                            />
                        )}
                        {!selectedId && !selectedListId && (
                            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/60 rounded-2xl bg-muted/5">
                                <p>Select a protocol to edit</p>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}