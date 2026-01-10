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

  // 1. Fetch Doses (History + Future Schedule)
  // We fetch a wide range (-60 to +30 days) so the chart has enough history 
  // to calculate decay curves properly, and enough future for the forecast.
  const now = new Date();
  const start = new Date(now); start.setDate(start.getDate() - 60);
  const end = new Date(now); end.setDate(end.getDate() + 30);
  
  const startIso = start.toISOString().split('T')[0];
  const endIso = end.toISOString().split('T')[0];

  // This action unifies DB doses with the protocol schedule and handles 'time_of_day' lookup
  const doses = await getDosesForRange(startIso, endIso);

  // 2. Fetch Peptide Info (Active + Historical)
  // We extract all peptide IDs referenced in the dose history/schedule to get their half-lives
  const activeIds = new Set<number>();
  doses.forEach(d => activeIds.add(Number(d.peptide_id)));

  let relevantPeptides: any[] = [];
  if (activeIds.size > 0) {
      const { data: pData } = await supabase
        .from("peptides")
        .select("id, canonical_name, half_life_hours")
        .in("id", Array.from(activeIds));
      relevantPeptides = pData || [];
  }

  // 3. Other Stats (Inventory, Weights)
  const { data: weights } = await supabase.from("weight_logs").select("*").eq("user_id", user.id).order("date", { ascending: true });
  
  const { data: vialInv } = await supabase.from("inventory_items").select("*, peptides(canonical_name)").eq("user_id", user.id);
  const { data: capInv } = await supabase.from("inventory_capsules").select("*, peptides(canonical_name)").eq("user_id", user.id);
  const fullInventory = [...(vialInv || []), ...(capInv || [])];

  const { data: fullProtocols } = await supabase.from("protocols").select("*, protocol_items(*)").eq("user_id", user.id).eq("is_active", true);

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
        {/* Pass the unified dose list to the chart */}
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
