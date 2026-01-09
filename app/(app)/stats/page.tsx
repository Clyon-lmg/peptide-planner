import { createServerActionSupabase } from "@/lib/supabaseServer";
import { Activity, Scale, CalendarRange } from "lucide-react";
import SerumChart from "./SerumChart";
import WeightClient from "./WeightClient";
import InventoryForecast from "./InventoryForecast";

export const metadata = {
  title: "Stats & Forecast",
};

export default async function StatsPage() {
  const supabase = createServerActionSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return <div>Please sign in.</div>;

  // --- DATA FETCHING ---
  
  // 1. Serum Data: Doses + Peptides
  // 🟢 FIX: Select 'date_for' instead of 'date'
  const { data: doses } = await supabase
    .from("doses")
    .select("date_for, time_of_day, dose_mg, peptide_id, status")
    .eq("user_id", user.id)
    .order("date_for", { ascending: true });

  const { data: peptides } = await supabase
    .from("peptides")
    .select("id, canonical_name, half_life_hours")
    .order("canonical_name");

  // 2. Weight Data
  const { data: weights } = await supabase
    .from("weight_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: true });

  // 3. Forecast Data: Inventory + Active Protocols
  const { data: vialInv } = await supabase
    .from("inventory_items") 
    .select("peptide_id, vials, mg_per_vial, peptides(canonical_name)")
    .eq("user_id", user.id);

  const { data: capInv } = await supabase
    .from("inventory_capsules")
    .select("peptide_id, bottles, caps_per_bottle, mg_per_cap, peptides(canonical_name)")
    .eq("user_id", user.id);
    
  const fullInventory = [...(vialInv || []), ...(capInv || [])];

  const { data: activeProtocols } = await supabase
    .from("protocols")
    .select(`
        id, 
        is_active, 
        protocol_items (
            peptide_id, 
            dose_mg_per_administration, 
            schedule, 
            every_n_days, 
            custom_days, 
            cycle_on_weeks, 
            cycle_off_weeks
        )
    `)
    .eq("user_id", user.id)
    .eq("is_active", true);


  return (
    <div className="max-w-5xl mx-auto p-4 space-y-8 pb-32">
      <header className="mb-8">
        <h1 className="pp-h1">Performance & Forecast</h1>
        <p className="text-muted-foreground">Physiological metrics and inventory planning.</p>
      </header>

      {/* 1. SERUM CHART */}
      <section className="pp-card p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg">
            <Activity className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold leading-none">Serum Levels</h2>
            <p className="text-xs text-muted-foreground mt-1">Estimated concentration based on half-life.</p>
          </div>
        </div>
        
        <SerumChart doses={doses || []} peptides={peptides || []} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* 2. INVENTORY FORECAST */}
          <section className="pp-card p-6 flex flex-col h-full">
            <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-purple-500/10 text-purple-600 rounded-lg">
                    <CalendarRange className="size-5" />
                </div>
                <div>
                    <h2 className="text-lg font-bold leading-none">Run-out Forecast</h2>
                    <p className="text-xs text-muted-foreground mt-1">Based on active protocol usage.</p>
                </div>
            </div>
            
            <InventoryForecast 
                inventory={fullInventory} 
                activeProtocols={activeProtocols || []} 
            />
          </section>

          {/* 3. WEIGHT TRACKER */}
          <section className="pp-card p-6 flex flex-col h-full">
            <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
                    <Scale className="size-5" />
                </div>
                <div>
                    <h2 className="text-lg font-bold leading-none">Weight Tracker</h2>
                    <p className="text-xs text-muted-foreground mt-1">Log and track progress.</p>
                </div>
            </div>
            
            <WeightClient initialEntries={weights || []} />
          </section>
      </div>
    </div>
  );
}
