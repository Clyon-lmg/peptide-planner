"use server"
import { revalidatePath } from "next/cache";
import { createServerActionSupabase } from "@/lib/supabaseServer";

export async function addProtocolItem(
  protocol_id: number,
  peptide_id: number,
  dose_mg_per_administration: number,
  schedule: string,
  every_n_days?: number | null,
  titration_interval_days?: number | null,
  titration_amount_mg?: number | null,
  color: string = '#000000',
  time_of_day?: string | null,
  site_list_id: number | null = null,
){
  const supabase = createServerActionSupabase();
  const { data:{ user } }=await supabase.auth.getUser()
  if(!user) throw new Error("Not authenticated")
  const { error } = await supabase.from("protocol_items").insert({ protocol_id, peptide_id, dose_mg_per_administration, schedule, every_n_days, titration_interval_days, titration_amount_mg, cycle_on_weeks:0, cycle_off_weeks:0, color, time_of_day, site_list_id })
  if(error) throw error
  revalidatePath("/protocol")
}
export async function removeProtocolItem(id:number){
  const supabase = createServerActionSupabase();
  const { data:{ user } }=await supabase.auth.getUser()
  if(!user) throw new Error("Not authenticated")
  const { error } = await supabase.from("protocol_items").delete().eq("id", id)
  if(error) throw error
  revalidatePath("/protocol")
}