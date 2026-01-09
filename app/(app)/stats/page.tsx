import { createServerActionSupabase } from "@/lib/supabaseServer";
import { Activity, Scale, CalendarRange } from "lucide-react";
import SerumChart from "./SerumChart";
import WeightClient from "./WeightClient";
import InventoryForecast from "./InventoryForecast";

export const metadata = { title: "Stats & Forecast" };

export default async function StatsPage() {
  const supabase = createServerActionSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div>Please sign in.</div>;

  // 1. Fetch Doses (Taken only)
  const { data: doses } = await supabase
    .from("doses")
    .select("date_for, date, time_of_day, dose_mg, peptide_id, status")
    .eq("user_id", user.id)
    .eq("status", "TAKEN")
    .order("date_for", { ascending: true });

  // 2. Fetch Active Protocols
  const { data: protocols } = await supabase
    .from("protocols")
    .select("id, protocol_items(peptide_id)")
    .eq("user_id", user.id)
    .eq("is_active", true);

  // 3. Get Relevant Peptide IDs (Active + History)
  const activeIds = new Set<number>();
  protocols?.forEach(p => p.protocol_items.forEach((pi: any) => activeIds.add(Number(pi.peptide_id))));
  doses?.forEach(d => activeIds.add(Number(d.peptide_id)));

  // 4. Fetch All Peptides
  const { data: allPeptides } = await supabase.from("peptides").select("id, canonical_name, half_life_hours");
  const relevantPeptides = allPeptides?.filter(p => activeIds.has(Number(p.id))) || [];

  // 5. Other Stats
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
        <SerumChart doses={doses || []} peptides={relevantPeptides} />
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
