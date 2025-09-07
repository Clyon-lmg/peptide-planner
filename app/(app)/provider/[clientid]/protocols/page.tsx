// app/provider/[clientId]/protocols/page.tsx
import Card from "@/components/layout/Card";
import SuggestButton from "@/components/SuggestButton";
import { createServerComponentSupabase } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export default async function ProviderProtocolsPage({ params }: { params: { clientId: string } }) {
  const supabase = createServerComponentSupabase();
  const clientId = params.clientId;
  const { data: proto } = await supabase
    .from("protocols")
    .select("id,name")
    .eq("user_id", clientId)
    .eq("is_active", true)
    .maybeSingle();
  let items: any[] = [];
  if (proto?.id) {
    const { data } = await supabase
      .from("protocol_items")
      .select("id,peptide_id,dose_mg_per_administration")
      .eq("protocol_id", proto.id);
    items = data || [];
  }

  const suggestProtocol = async (fd: FormData) => {
    "use server"; const a = await import("../server");
    await a.createSuggestionForClient(
      clientId,
      "protocol",
      String(fd.get("title") || ""),
      String(fd.get("note") || "")
    );
  };

  return (
    <div className="p-4 grid gap-6">
      <Card>
        <div className="pp-h2 mb-2">Protocol (read-only)</div>
        {proto ? (
          <div className="space-y-2">
            {items.map((i) => (
              <div key={i.id} className="pp-subtle">
                Peptide {i.peptide_id}: {i.dose_mg_per_administration} mg
              </div>
            ))}
          </div>
        ) : (
          <div className="pp-subtle">No active protocol</div>
        )}
        <div className="mt-4">
          <SuggestButton action={suggestProtocol} />
        </div>
      </Card>
    </div>
  );
}