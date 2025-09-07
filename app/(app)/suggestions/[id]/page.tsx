import Card from "@/components/layout/Card";
import { createServerComponentSupabase } from "@/lib/supabaseServer";
import { acceptSuggestion, rejectSuggestion } from "../server";

export const dynamic = "force-dynamic";

export default async function SuggestionDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerComponentSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <Card>Please sign in.</Card>;
  const id = Number(params.id);
  const { data: s, error } = await supabase
    .from("suggestions")
    .select("id,title,payload,type,status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !s) return <Card>Suggestion not found</Card>;
  return (
    <div className="p-4">
      <Card>
        <div className="pp-h2">{s.title}</div>
        <div className="pp-subtle">{s.type}</div>
        {s.payload?.note && (
          <p className="mt-2">{s.payload.note}</p>
        )}
        <div className="mt-4 flex gap-2">
          <form action={async () => { await acceptSuggestion(id); }}>
            <button className="btn">Accept</button>
          </form>
          <form action={async () => { await rejectSuggestion(id); }}>
            <button className="btn">Reject</button>
          </form>
        </div>
      </Card>
    </div>
  );
}