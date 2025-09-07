import { createServerComponentSupabase } from "@/lib/supabaseServer";
import Card from "@/components/layout/Card";
import SuggestionsList from "./SuggestionsList";

export const dynamic = "force-dynamic";

export default async function SuggestionsPage() {
  const supabase = createServerComponentSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <Card>Please sign in.</Card>;
  const { data: suggestions, error } = await supabase
    .from("suggestions")
    .select("id,title,type,status")
    .eq("user_id", user.id)
    .eq("status", "PENDING")
    .order("id", { ascending: false });
  if (error) return <Card>Error: {error.message}</Card>;
  return (
    <div className="p-4">
      <SuggestionsList initial={suggestions || []} />
    </div>
  );
}