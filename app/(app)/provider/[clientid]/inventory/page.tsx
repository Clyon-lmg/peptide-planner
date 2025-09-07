// app/provider/[clientId]/inventory/page.tsx
import Card from "@/components/layout/Card";
import SuggestButton from "@/components/SuggestButton";
import { createServerComponentSupabase } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export default async function ProviderInventoryPage({ params }: { params: { clientId: string } }) {
  const supabase = createServerComponentSupabase();
  const clientId = params.clientId;
  const { data: vials } = await supabase
    .from("inventory_items")
    .select("id, peptide_id, vials, mg_per_vial")
    .eq("user_id", clientId);
  const { data: caps } = await supabase
    .from("inventory_capsules")
    .select("id, peptide_id, bottles, caps_per_bottle, mg_per_cap")
    .eq("user_id", clientId);

  const suggestInventory = async (fd: FormData) => {
    "use server"; const a = await import("../server");
    await a.createSuggestionForClient(
      clientId,
      "inventory",
      String(fd.get("title") || ""),
      String(fd.get("note") || "")
    );
  };

  return (
    <div className="p-4 grid gap-6">
      <Card>
        <div className="pp-h2 mb-2">Inventory (read-only)</div>
        <div className="space-y-2">
          {(vials || []).map((v: any) => (
            <div key={`v-${v.id}`} className="pp-subtle">
              Peptide {v.peptide_id}: {v.vials} vials @ {v.mg_per_vial} mg
            </div>
          ))}
          {(caps || []).map((c: any) => (
            <div key={`c-${c.id}`} className="pp-subtle">
              Peptide {c.peptide_id}: {c.bottles} bottles ({c.caps_per_bottle} caps) @ {c.mg_per_cap} mg
            </div>
          ))}
        </div>
        <div className="mt-4">
          <SuggestButton action={suggestInventory} />
        </div>
      </Card>
    </div>
  );
}