import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
export const dynamic = "force-dynamic"
export default async function Index() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser()
  redirect(user ? "/today" : "/sign-in")
}