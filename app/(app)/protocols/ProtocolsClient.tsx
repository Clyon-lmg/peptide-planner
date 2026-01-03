"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Upload, FileText, ChevronRight, Trash2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import ProtocolEditor from './ProtocolEditor';
import ImportModal from '@/components/protocols/ImportModal';
import InjectionSiteListEditor from './InjectionSiteListEditor'; // Re-import this
import { deleteProtocolAction } from './actions';
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

export type Protocol = {
    id: number;
    user_id: string;
    is_active: boolean;
    name: string;
    start_date: string;
};

type InjectionSiteList = {
    id: number;
    user_id: string;
    name: string;
};

export default function ProtocolsClient({ 
    protocols = [] 
}: { 
    protocols: Protocol[] 
}) {
    const router = useRouter();
    const supabase = getSupabaseBrowser();
    
    // TABS: 'protocols' or 'sites'
    const [activeTab, setActiveTab] = useState<'protocols' | 'sites'>('protocols');
    
    // Protocol State
    const [selectedProtocolId, setSelectedProtocolId] = useState<number | null>(null);
    const [showImport, setShowImport] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Site List State
    const [siteLists, setSiteLists] = useState<InjectionSiteList[]>([]);
    const [selectedSiteListId, setSelectedSiteListId] = useState<number | null>(null);

    // Fetch Site Lists on tab change (lazy load)
    React.useEffect(() => {
        if (activeTab === 'sites') {
            (async () => {
                const { data } = await supabase.from('injection_site_lists').select('*').order('id');
                setSiteLists(data || []);
            })();
        }
    }, [activeTab, supabase]);

    const handleCreateProtocol = () => setShowImport(true);

    const handleCreateSiteList = async () => {
        const name = prompt("Name for new Rotation List (e.g. 'Stomach Rotation')");
        if (!name) return;
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('injection_site_lists')
            .insert({ user_id: user.id, name })
            .select()
            .single();
            
        if (data) {
            setSiteLists(prev => [...prev, data]);
            setSelectedSiteListId(data.id);
            toast.success("List created");
        } else {
            toast.error("Failed to create list");
        }
    };

    const handleDeleteProtocol = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (!confirm("Delete this protocol?")) return;
        setIsDeleting(true);
        try {
            await deleteProtocolAction(id);
            toast.success("Deleted");
            if (selectedProtocolId === id) setSelectedProtocolId(null);
            router.refresh();
        } catch (e) { toast.error("Failed to delete"); }
        finally { setIsDeleting(false); }
    };

    const handleDeleteSiteList = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (!confirm("Delete this site list?")) return;
        
        const { error } = await supabase.from('injection_site_lists').delete().eq('id', id);
        if (!error) {
            setSiteLists(prev => prev.filter(l => l.id !== id));
            if (selectedSiteListId === id) setSelectedSiteListId(null);
            toast.success("List deleted");
        } else {
            toast.error("Failed to delete");
        }
    };

    // Render Logic
    const selectedProtocol = protocols.find(p => p.id === selectedProtocolId);
    const selectedSiteList = siteLists.find(l => l.id === selectedSiteListId);

    return (
        <div className="flex h-[calc(100vh-4rem)]">
            
            {/* LEFT SIDEBAR */}
            <div className={`w-full md:w-80 border-r border-border bg-card/30 flex flex-col ${selectedProtocolId || selectedSiteListId ? 'hidden md:flex' : 'flex'}`}>
                
                {/* Header with Tabs */}
                <div className="p-4 border-b border-border space-y-4">
                    <div className="flex bg-muted/20 p-1 rounded-xl">
                        <button 
                            onClick={() => { setActiveTab('protocols'); setSelectedSiteListId(null); }}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${activeTab === 'protocols' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Protocols
                        </button>
                        <button 
                            onClick={() => { setActiveTab('sites'); setSelectedProtocolId(null); }}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${activeTab === 'sites' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Site Rotations
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <h2 className="font-bold text-lg">
                            {activeTab === 'protocols' ? 'My Protocols' : 'Rotations'}
                        </h2>
                        {activeTab === 'protocols' ? (
                            <div className="flex gap-2">
                                <button onClick={handleCreateProtocol} className="btn h-8 px-3 text-xs bg-primary text-primary-foreground">
                                    <Plus className="size-3.5 mr-1" /> New
                                </button>
                            </div>
                        ) : (
                            <button onClick={handleCreateSiteList} className="btn h-8 px-3 text-xs bg-primary text-primary-foreground">
                                <Plus className="size-3.5 mr-1" /> New List
                            </button>
                        )}
                    </div>
                </div>

                {/* List Content */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {activeTab === 'protocols' ? (
                        // PROTOCOLS LIST
                        protocols.length === 0 ? (
                            <div className="text-center py-10 px-4 text-muted-foreground text-sm">
                                No protocols yet.<br/>Create or import one.
                            </div>
                        ) : (
                            protocols.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => setSelectedProtocolId(p.id)}
                                    className={`w-full text-left p-3 rounded-xl transition-all border group relative cursor-pointer
                                        ${selectedProtocolId === p.id 
                                            ? "bg-primary/5 border-primary/20 shadow-sm" 
                                            : "bg-transparent border-transparent hover:bg-muted/50"
                                        }
                                    `}
                                >
                                    <div className="flex justify-between items-start pr-8">
                                        <div className="font-medium truncate">{p.name}</div>
                                        {p.is_active && <span className="shrink-0 size-2 rounded-full bg-emerald-500 mt-1.5" title="Active" />}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                        <FileText className="size-3" />
                                        <span>{p.start_date}</span>
                                    </div>
                                    <button
                                        onClick={(e) => handleDeleteProtocol(e, p.id)}
                                        className="absolute right-2 top-2 p-1.5 text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                        disabled={isDeleting}
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                    <ChevronRight className={`absolute right-3 bottom-3 size-4 text-muted-foreground/30 transition-transform ${selectedProtocolId === p.id ? 'translate-x-1 opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                                </div>
                            ))
                        )
                    ) : (
                        // SITES LIST
                        siteLists.length === 0 ? (
                            <div className="text-center py-10 px-4 text-muted-foreground text-sm">
                                No rotation lists yet.<br/>Create one (e.g. "Stomach").
                            </div>
                        ) : (
                            siteLists.map(l => (
                                <div
                                    key={l.id}
                                    onClick={() => setSelectedSiteListId(l.id)}
                                    className={`w-full text-left p-3 rounded-xl transition-all border group relative cursor-pointer
                                        ${selectedSiteListId === l.id 
                                            ? "bg-primary/5 border-primary/20 shadow-sm" 
                                            : "bg-transparent border-transparent hover:bg-muted/50"
                                        }
                                    `}
                                >
                                    <div className="font-medium truncate pr-8">{l.name}</div>
                                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                        <MapPin className="size-3" />
                                        <span>Rotation List</span>
                                    </div>
                                    <button
                                        onClick={(e) => handleDeleteSiteList(e, l.id)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                </div>
                            ))
                        )
                    )}
                </div>
            </div>

            {/* RIGHT MAIN */}
            <div className={`flex-1 flex flex-col min-w-0 bg-background ${!selectedProtocolId && !selectedSiteListId ? 'hidden md:flex' : 'flex'}`}>
                
                {/* Back Button (Mobile) */}
                {(selectedProtocolId || selectedSiteListId) && (
                    <div className="md:hidden p-4 pb-0">
                        <button 
                            onClick={() => { setSelectedProtocolId(null); setSelectedSiteListId(null); }} 
                            className="text-sm text-muted-foreground flex items-center gap-1"
                        >
                            ← Back to list
                        </button>
                    </div>
                )}

                {/* CONTENT AREA */}
                {activeTab === 'protocols' ? (
                    selectedProtocol ? (
                        <div className="h-full overflow-y-auto p-4 md:p-8">
                            <ProtocolEditor 
                                protocol={selectedProtocol} 
                                onReload={() => router.refresh()} 
                            />
                        </div>
                    ) : (
                        <EmptyState 
                            icon={FileText} 
                            title="Select a Protocol" 
                            desc="Choose from the list or create new."
                            action={<button onClick={() => setShowImport(true)} className="mt-4 btn border border-border">Import</button>}
                        />
                    )
                ) : (
                    selectedSiteList ? (
                        <div className="h-full overflow-y-auto p-4 md:p-8">
                            <InjectionSiteListEditor 
                                list={selectedSiteList} 
                                onReload={() => { /* No global reload needed for site lists usually */ }} 
                            />
                        </div>
                    ) : (
                        <EmptyState 
                            icon={MapPin} 
                            title="Select a Rotation List" 
                            desc="Define injection sites (e.g. Left/Right) to rotate through." 
                        />
                    )
                )}
            </div>

            {/* IMPORT MODAL */}
            <ImportModal 
                isOpen={showImport} 
                onClose={() => setShowImport(false)}
                onSuccess={(newId) => {
                    router.refresh();
                    setSelectedProtocolId(newId);
                    setActiveTab('protocols');
                }}
            />
        </div>
    );
}

// Helper Component for Empty States
function EmptyState({ icon: Icon, title, desc, action }: any) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
            <div className="size-16 rounded-3xl bg-muted/30 flex items-center justify-center mb-4">
                <Icon className="size-8 opacity-20" />
            </div>
            <h3 className="font-semibold text-lg text-foreground">{title}</h3>
            <p className="text-sm max-w-xs mt-2">{desc}</p>
            {action}
        </div>
    );
}
