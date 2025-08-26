"use server"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"

export async function addProtocolItem(protocol_id:number, peptide_id:number, dose_mg_per_administration:number, schedule:string, every_n_days?: number | null, color:string = '#000000'){
  const supabase=createServerComponentClient({ cookies })
  const { data:{ user } }=await supabase.auth.getUser()
  if(!user) throw new Error("Not authenticated")
  const { error } = await supabase.from("protocol_items").insert({ protocol_id, peptide_id, dose_mg_per_administration, schedule, every_n_days, cycle_on_weeks:0, cycle_off_weeks:0, color })
  if(error) throw error
  revalidatePath("/protocol")
}
export async function removeProtocolItem(id:number){
  const supabase=createServerComponentClient({ cookies })
  const { data:{ user } }=await supabase.auth.getUser()
  if(!user) throw new Error("Not authenticated")
  const { error } = await supabase.from("protocol_items").delete().eq("id", id)
  if(error) throw error
  revalidatePath("/protocol")
}
