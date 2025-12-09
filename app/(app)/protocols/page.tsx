"use client";
import React from "react";
import { Plus, Edit2, Trash2, List } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import ProtocolEditor from "./ProtocolEditor";
import InjectionSiteListEditor from "./InjectionSiteListEditor";
import { toast } from "sonner";

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
        setSelectedId(null); // Clear selection
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

            {/* SIDEBAR LIST (Collapsible on mobile) */}
            <aside className={`lg:w-72 shrink-0 space-y-6 ${showListOnMobile ? 'block' : 'hidden lg:block'}`}>

                {/* Protocols Section */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Protocols</h3>
                        <button onClick={createProtocol} className="text-primary hover:bg-primary/10 p-1 rounded"><Plus className="size-4" /></button>
                    </div>

                    <div className="space-y-1">
                        {protocols.map(p => (
                            <div
                                key={p.id}
                                onClick={() => { setSelectedId(p.id); setSelectedListId(null); setShowListOnMobile(false); }}
                                className={`
                                group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all
                                ${selectedId === p.id
                                        ? "bg-primary text-primary-foreground shadow-md"
                                        : "hover:bg-muted/50 text-foreground"
                                    }
                            `}
                            >
                                <div className="min-w-0">
                                    <div className="font-medium truncate">{p.name}</div>
                                    {p.is_active && <div className="text-[10px] opacity-80 font-bold uppercase tracking-wide">Active</div>}
                                </div>

                                {/* Delete Action (only visible on hover or selection) */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); deleteProtocol(p.id); }}
                                    className={`
                                    p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity
                                    ${selectedId === p.id ? "hover:bg-black/20 text-white" : "hover:bg-destructive/10 hover:text-destructive text-muted-foreground"}
                                `}
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Site Lists Section */}
                <div className="space-y-3 pt-4 border-t border-border">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Site Lists</h3>
                        <button onClick={createSiteList} className="text-primary hover:bg-primary/10 p-1 rounded"><Plus className="size-4" /></button>
                    </div>

                    <div className="space-y-1">
                        {siteLists.map(l => (
                            <div
                                key={l.id}
                                onClick={() => { setSelectedListId(l.id); setSelectedId(null); setShowListOnMobile(false); }}
                                className={`
                                group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all
                                ${selectedListId === l.id
                                        ? "bg-muted text-foreground font-medium ring-1 ring-border"
                                        : "hover:bg-muted/50 text-foreground"
                                    }
                            `}
                            >
                                <span className="truncate">{l.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </aside>

            {/* MAIN EDITOR AREA */}
            <main className="flex-1 min-w-0">
                {/* Mobile "Back to Menu" button */}
                <div className="lg:hidden mb-4">
                    <button
                        onClick={() => setShowListOnMobile(!showListOnMobile)}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                        <List className="size-4" /> {showListOnMobile ? "Hide Menu" : "Show Menu"}
                    </button>
                </div>

                {!showListOnMobile && (
                    <>
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
                            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-2xl">
                                <p>Select a protocol to edit</p>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}