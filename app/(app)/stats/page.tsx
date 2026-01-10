import { createServerActionSupabase } from "@/lib/supabaseServer";
import { Activity, Scale, CalendarRange } from "lucide-react";
import SerumChart from "./SerumChart";
import WeightClient from "./WeightClient";
import InventoryForecast from "./InventoryForecast";
import { getDosesForRange } from "../calendar/actions";

export const metadata = { title: "Stats & Forecast" };

export default async function StatsPage() {
  const supabase = createServerActionSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div>Please sign in.</div>;

  console.log("--- STATS PAGE DEBUG START ---");

  // 1. Fetch Inventory First (To get Half-Life settings)
  // We need to fetch this first so we can attach the user's custom half-life to the peptide
  const { data: vialInv } = await supabase.from("inventory_items").select("*, peptides(canonical_name)").eq("user_id", user.id);
  const { data: capInv } = await supabase.from("inventory_capsules").select("*, peptides(canonical_name)").eq("user_id", user.id);
  
  const fullInventory = [...(vialInv || []), ...(capInv || [])];
  
  // Create a Map for fast lookup: PeptideID -> HalfLife
  const halfLifeMap = new Map<number, number>();
  fullInventory.forEach((item: any) => {
    if (item.peptide_id && item.half_life_hours) {
      halfLifeMap.set(Number(item.peptide_id), Number(item.half_life_hours));
    }
  });

  // 2. Fetch Doses (History + Future Schedule)
  const now = new Date();
  const start = new Date(now); start.setDate(start.getDate() - 60);
  const end = new Date(now); end.setDate(end.getDate() + 30);
  
  const startIso = start.toISOString().split('T')[0];
  const endIso = end.toISOString().split('T')[0];

  console.log(`Fetching doses from ${startIso} to ${endIso}...`);
  const doses = await getDosesForRange(startIso, endIso);
  console.log(`Doses fetched: ${doses.length}`);

  // 3. Identify Active Peptides
  const activeIds = new Set<number>();
  doses.forEach(d => {
    if (d.peptide_id) activeIds.add(Number(d.peptide_id));
  });

  // 4. Fetch Peptide Names (WITHOUT half_life_hours column)
  let relevantPeptides: any[] = [];
  if (activeIds.size > 0) {
      const { data: pData, error } = await supabase
        .from("peptides")
        .select("id, canonical_name") // REMOVED half_life_hours
        .in("id", Array.from(activeIds));
      
      if (error) {
        console.error("Error fetching peptides:", error);
      } else {
        // Merge DB data with Inventory Half-Life data
        relevantPeptides = (pData || []).map(p => ({
          ...p,
          half_life_hours: halfLifeMap.get(Number(p.id)) || 24 // Default to 24h if not set in inventory
        }));
      }
  }

  console.log(`Relevant Peptides Loaded: ${relevantPeptides.length}`);
  // Log one to verify it has half_life_hours now
  if (relevantPeptides.length > 0) {
    console.log("Sample Peptide w/ HalfLife:", relevantPeptides[0]);
  }

  // 5. Other Stats
  const { data: weights } = await supabase.from("weight_logs").select("*").eq("user_id", user.id).order("date", { ascending: true });
  const { data: fullProtocols } = await supabase.from("protocols").select("*, protocol_items(*)").eq("user_id", user.id).eq("is_active", true);

  console.log("--- STATS PAGE DEBUG END ---");

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-8 pb-32">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Performance & Forecast</h1>
      </header>

      <section className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="size-5 text-blue-600" />
          <h2 className="text-lg font-bold">Serum Levels</h2>
        </div>
        <SerumChart doses={doses} peptides={relevantPeptides} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-2 mb-6"><CalendarRange className="size-5 text-purple-600" /><h2 className="text-lg font-bold">Run-out Forecast</h2></div>
            <InventoryForecast inventory={fullInventory} activeProtocols={fullProtocols || []} />
          </section>

          <section className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-2 mb-6"><Scale className="size-5 text-emerald-600" /><h2 className="text-lg font-bold">Weight Tracker</h2></div>
            <WeightClient initialEntries={weights || []} />
          </section>
      </div>
    </div>
  );
}
