"use client";

import React, { useState, useEffect } from "react";
import { X, Search, Plus } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { toast } from "sonner";
import { ensurePeptideAndInventory, importInventoryItemAction } from "@/app/(app)/inventory/actions";
import { useRouter } from "next/navigation";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function InventoryAddModal({ isOpen, onClose, onSuccess }: Props) {
  const supabase = getSupabaseBrowser();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: number; canonical_name: string }[]>([]);
  const [selectedName, setSelectedName] = useState("");
  
  // Form State
  const [kind, setKind] = useState<"peptide" | "capsule">("peptide");
  const [stock, setStock] = useState("");       
  const [conc, setConc] = useState("");         
  const [conc2, setConc2] = useState("");       
  const [loading, setLoading] = useState(false);

  // 1. Search Peptides (Debounced)
  useEffect(() => {
    if (!query) { setResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('peptides')
        .select('id, canonical_name')
        .ilike('canonical_name', `%${query}%`)
        .limit(5);
      setResults(data || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, supabase]);

  const handleSelect = (name: string) => {
    setSelectedName(name);
    setStep(2);
  };

  const handleCustom = () => {
    if (!query.trim()) return;
    setSelectedName(query.trim()); 
    setStep(2);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Calls your server action to safe-create
      await importInventoryItemAction(
          selectedName,
          kind,
          Number(stock),
          Number(conc),
          Number(conc2)
      );
      
      toast.success(`Added ${selectedName}`);
      onSuccess(); // Triggers router.refresh() in parent
      handleClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to add item");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
      setStep(1); 
      setQuery(""); 
      setSelectedName(""); 
      setStock(""); 
      setConc(""); 
      setConc2("");
      onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-bold text-lg">Add Inventory</h3>
            <button onClick={handleClose}><X className="size-5 text-muted-foreground" /></button>
        </div>

        {step === 1 && (
            <div className="p-4 space-y-4">
                <p className="text-sm text-muted-foreground">Search for a peptide or type a new name.</p>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input 
                        className="input pl-10" 
                        placeholder="e.g. BPC-157" 
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCustom(); }}
                    />
                </div>
                <div className="space-y-1">
                    {results.map(r => (
                        <button key={r.id} onClick={() => handleSelect(r.canonical_name)} className="w-full text-left px-4 py-2 hover:bg-muted/50 rounded-lg text-sm transition-colors">
                            {r.canonical_name}
                        </button>
                    ))}
                    {query && !results.find(r => r.canonical_name.toLowerCase() === query.toLowerCase()) && (
                        <button onClick={handleCustom} className="w-full text-left px-4 py-2 text-blue-500 hover:bg-blue-500/10 rounded-lg text-sm flex items-center gap-2">
                            <Plus className="size-4" /> Use "{query}"
                        </button>
                    )}
                </div>
            </div>
        )}

        {step === 2 && (
            <div className="p-4 space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-xl">{selectedName}</h4>
                    <button onClick={() => setStep(1)} className="text-xs text-muted-foreground hover:underline">Change</button>
                </div>
                <div className="bg-muted/20 p-1 rounded-lg flex mb-4">
                    <button onClick={() => setKind('peptide')} className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${kind === 'peptide' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>Vial (Injectable)</button>
                    <button onClick={() => setKind('capsule')} className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${kind === 'capsule' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>Capsule (Oral)</button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs uppercase text-muted-foreground font-bold">Quantity</label>
                        <input type="number" className="input mt-1" placeholder={kind === 'peptide' ? "Vials" : "Bottles"} value={stock} onChange={e => setStock(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs uppercase text-muted-foreground font-bold">Concentration</label>
                        <input type="number" className="input mt-1" placeholder={kind === 'peptide' ? "mg / vial" : "mg / cap"} value={conc} onChange={e => setConc(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs uppercase text-muted-foreground font-bold">{kind === 'peptide' ? "BAC Water (ml)" : "Caps / Bottle"}</label>
                        <input type="number" className="input mt-1" placeholder={kind === 'peptide' ? "2.0" : "60"} value={conc2} onChange={e => setConc2(e.target.value)} />
                    </div>
                </div>
                <button onClick={handleSubmit} disabled={loading || !stock || !conc} className="w-full btn bg-primary text-primary-foreground mt-4">
                    {loading ? "Adding..." : "Add to Inventory"}
                </button>
            </div>
        )}
      </div>
    </div>
  );
}
