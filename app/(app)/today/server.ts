"use server"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
type DoseStatus = "LOGGED" | "SKIPPED"
export async function markDose(doseId:number, status:DoseStatus){
  const supabase=createServerComponentClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if(!user) throw new Error("Not authenticated")
  const { error } = await supabase.from("doses").update({ status }).eq("id", doseId).eq("user_id", user.id)
  if(error) throw error
  revalidatePath("/today"); revalidatePath("/calendar")
}
