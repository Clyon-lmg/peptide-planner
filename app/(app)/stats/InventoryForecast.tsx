import { AlertTriangle, Calendar, CheckCircle, Package } from "lucide-react";
import { baseFreqPerWeek, effectiveFreqPerWeek } from "@/lib/forecast";

type ForecastItem = {
    name: string;
    onHandMg: number;
    weeklyUsageMg: number;
    daysRemaining: number;
    depletionDate: string | null;
    status: 'ok' | 'low' | 'empty';
};

export default function InventoryForecast({ 
    inventory, 
    activeProtocols 
}: { 
    inventory: any[], 
    activeProtocols: any[] 
}) {
    // 1. Map Inventory per Peptide
    const stockMap = new Map<number, number>(); // peptide_id -> total mg
    
    inventory.forEach((item: any) => {
        const pid = item.peptide_id;
        const existing = stockMap.get(pid) || 0;
        
        let mg = 0;
        if (item.mg_per_vial) { // Vial
            mg = (item.vials || 0) * item.mg_per_vial;
        } else if (item.mg_per_cap) { // Capsule
            mg = (item.bottles || 0) * (item.caps_per_bottle || 0) * item.mg_per_cap;
        }
        stockMap.set(pid, existing + mg);
    });

    // 2. Map Usage per Peptide (Weekly mg)
    const usageMap = new Map<number, number>(); // peptide_id -> weekly mg
    
    // Flatten all items from all active protocols
    const allItems = activeProtocols.flatMap((p: any) => p.protocol_items || []);
    
    allItems.forEach((item: any) => {
        if (!item.peptide_id) return;
        const pid = item.peptide_id;
        
        const base = baseFreqPerWeek(item.schedule, item.custom_days, item.every_n_days);
        const effFreq = effectiveFreqPerWeek(base, item.cycle_on_weeks, item.cycle_off_weeks);
        const weeklyMg = (item.dose_mg_per_administration || 0) * effFreq;
        
        const existing = usageMap.get(pid) || 0;
        usageMap.set(pid, existing + weeklyMg);
    });

    // 3. Generate Forecast
    const forecasts: ForecastItem[] = [];

    // Iterate over peptides that have STOCK or USAGE
    const allPeptideIds = new Set([...stockMap.keys(), ...usageMap.keys()]);
    
    // We need peptide names, lookup from inventory or protocols
    const getName = (pid: number) => {
        const invMatch = inventory.find((i: any) => i.peptide_id === pid);
        if (invMatch?.peptides?.canonical_name) return invMatch.peptides.canonical_name;
        const protoMatch = allItems.find((i: any) => i.peptide_id === pid);
        return `Peptide #${pid}`; 
    };

    allPeptideIds.forEach(pid => {
        const stock = stockMap.get(pid) || 0;
        const usage = usageMap.get(pid) || 0;
        const name = getName(pid);

        if (usage === 0) return; // No usage, lasts forever

        const weeksRemaining = stock / usage;
        const daysRemaining = Math.floor(weeksRemaining * 7);
        
        let depletionDate: string | null = null;
        if (daysRemaining < 3650) { // Cap at 10 years
            const d = new Date();
            d.setDate(d.getDate() + daysRemaining);
            depletionDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        }

        let status: ForecastItem['status'] = 'ok';
        if (daysRemaining <= 0) status = 'empty';
        else if (daysRemaining < 21) status = 'low';

        forecasts.push({
            name,
            onHandMg: stock,
            weeklyUsageMg: usage,
            daysRemaining,
            depletionDate,
            status
        });
    });

    if (forecasts.length === 0) {
        return <div className="p-4 text-sm text-muted-foreground text-center">No active usage detected.</div>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {forecasts.map((item, idx) => (
                <div key={idx} className={`border rounded-xl p-3 flex flex-col justify-between ${
                    // 🟢 FIX: Improved contrast using opacity-based colors
                    item.status === 'empty' ? 'bg-red-500/10 border-red-500/20' :
                    item.status === 'low' ? 'bg-amber-500/10 border-amber-500/20' : 
                    'bg-card border-border'
                }`}>
                    <div>
                        <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-sm truncate">{item.name}</span>
                            {item.status === 'empty' && <AlertTriangle className="size-4 text-red-500" />}
                            {item.status === 'low' && <Package className="size-4 text-amber-500" />}
                            {item.status === 'ok' && <CheckCircle className="size-4 text-emerald-500" />}
                        </div>
                        <div className="text-xs text-muted-foreground mb-3">
                            Usage: {item.weeklyUsageMg.toFixed(1)} mg/wk
                        </div>
                    </div>
                    
                    <div className="mt-2 pt-2 border-t border-foreground/5 flex justify-between items-end">
                        <div>
                            <div className="text-[10px] uppercase font-bold text-muted-foreground">Runs Out</div>
                            <div className={`font-mono font-medium ${
                                item.status === 'empty' ? 'text-red-500' : 
                                item.status === 'low' ? 'text-amber-500' : 'text-foreground'
                            }`}>
                                {item.depletionDate || "—"}
                            </div>
                        </div>
                        <div className="text-right">
                             <div className="text-[10px] uppercase font-bold text-muted-foreground">Days</div>
                             <div className="font-bold">{item.daysRemaining}</div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
