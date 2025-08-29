import { redirect } from "next/navigation";
import { createServerComponentSupabase } from "@/lib/supabaseServer";
export const dynamic = "force-dynamic"
export default async function Index() {
  const supabase = createServerComponentSupabase();
  const { data: { user } } = await supabase.auth.getUser()
  redirect(user ? "/today" : "/sign-in")
}