import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import SignInClient from "@/components/auth/SignInClient"
export const dynamic = "force-dynamic"
export default async function SignInPage() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect("/today")
  return <SignInClient />
}
