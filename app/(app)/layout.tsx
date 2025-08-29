export const dynamic = "force-dynamic";
import { createServerSupabase } from "@/lib/supabaseServer";
import AppShell from "@/components/layout/AppShell";
export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return <AppShell userEmail={user?.email ?? null}>{children}</AppShell>;
}