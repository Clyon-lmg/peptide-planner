export const dynamic = "force-dynamic"
import { cookies } from "next/headers"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import AppShell from "@/components/layout/AppShell"
export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = createServerComponentClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  return <AppShell userEmail={user?.email ?? null}>{children}</AppShell>
}
