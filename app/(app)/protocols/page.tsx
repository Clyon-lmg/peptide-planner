"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Upload, FileText, ChevronRight } from 'lucide-react';
import ProtocolEditor from './ProtocolEditor';
import ImportModal from '@/components/protocols/ImportModal'; // Import the new modal

// You'll need to define or import your Protocol type here if not global
type Protocol = {
    id: number;
    user_id: string;
    is_active: boolean;
    name: string;
    start_date: string;
};

export default function ProtocolsPage({ 
    protocols = [] // Assuming you pass data or fetch it here
}: { 
    protocols?: Protocol[] 
}) {
    const router = useRouter();
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [showImport, setShowImport] = useState(false);

    // Find selected protocol object
    const selectedProtocol = protocols.find(p => p.id === selectedId);

    const handleCreate = async () => {
        // Your existing create logic (or redirect to a create action)
        // For now, let's assume it creates a blank one and refreshes
        // router.refresh();
    };

    return (
        <div className="flex h-[calc(100vh-4rem)]">
            {/* LEFT SIDEBAR: List */}
            <div className={`w-full md:w-80 border-r border-border bg-card/30 flex flex-col ${selectedId ? 'hidden md:flex' : 'flex'}`}>
                
                {/* Header */}
                <div className="p-4 border-b border-border space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="font-bold text-lg">Protocols</h2>
                        <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">{protocols.length}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                        {/* NEW: Import Button */}
                        <button 
                            onClick={() => setShowImport(true)}
                            className="btn h-9 text-xs border border-border bg-background hover:bg-muted/50 text-muted-foreground hover:text-foreground flex items-center justify-center gap-2"
                        >
                            <Upload className="size-3.5" /> Import
                        </button>
                        
                        <button 
                            onClick={handleCreate}
                            className="btn h-9 text-xs bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2"
                        >
                            <Plus className="size-3.5" /> New
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {protocols.length === 0 ? (
                        <div className="text-center py-10 px-4 text-muted-foreground text-sm">
                            No protocols yet.<br/>Create one or import to get started.
                        </div>
                    ) : (
                        protocols.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setSelectedId(p.id)}
                                className={`w-full text-left p-3 rounded-xl transition-all border group relative
                                    ${selectedId === p.id 
                                        ? "bg-primary/5 border-primary/20 shadow-sm" 
                                        : "bg-transparent border-transparent hover:bg-muted/50"
                                    }
                                `}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="font-medium truncate pr-4">{p.name}</div>
                                    {p.is_active && <span className="shrink-0 size-2 rounded-full bg-emerald-500 mt-1.5" title="Active" />}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                    <FileText className="size-3" />
                                    <span>{p.start_date}</span>
                                </div>
                                <ChevronRight className={`absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/30 transition-transform ${selectedId === p.id ? 'translate-x-1 opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* RIGHT MAIN: Editor or Empty State */}
            <div className={`flex-1 flex flex-col min-w-0 bg-background ${!selectedId ? 'hidden md:flex' : 'flex'}`}>
                {selectedProtocol ? (
                    <div className="h-full overflow-y-auto p-4 md:p-8">
                        {/* Mobile Back Button */}
                        <button 
                            onClick={() => setSelectedId(null)} 
                            className="md:hidden mb-4 text-sm text-muted-foreground flex items-center gap-1"
                        >
                            ← Back to list
                        </button>
                        
                        <ProtocolEditor 
                            protocol={selectedProtocol} 
                            onReload={() => router.refresh()} 
                        />
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                        <div className="size-16 rounded-3xl bg-muted/30 flex items-center justify-center mb-4">
                            <FileText className="size-8 opacity-20" />
                        </div>
                        <h3 className="font-semibold text-lg text-foreground">Select a Protocol</h3>
                        <p className="text-sm max-w-xs mt-2">Choose a protocol from the sidebar to edit, or create a new one to get started.</p>
                        
                        <button 
                            onClick={() => setShowImport(true)}
                            className="mt-6 btn border border-border hover:bg-muted/50 text-sm px-6"
                        >
                            Import from Markdown
                        </button>
                    </div>
                )}
            </div>

            {/* IMPORT MODAL */}
            <ImportModal 
                isOpen={showImport} 
                onClose={() => setShowImport(false)}
                onSuccess={(newId) => {
                    router.refresh();
                    setSelectedId(newId); // Auto-select the new protocol
                }}
            />
        </div>
    );
}
