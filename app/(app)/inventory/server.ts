"use server"
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabaseServer";

export async function addVialItem(peptide_id:number, vials:number, mg_per_vial:number, bac_ml:number){
  const supabase = createServerSupabase(); const { data:{ user } }=await supabase.auth.getUser(); if(!user) throw new Error("Not auth")
  const { error } = await supabase.from("inventory_items").insert({ user_id:user.id, peptide_id, vials, mg_per_vial, bac_ml })
  if(error) throw error; revalidatePath("/inventory")
}
export async function addCapsItem(peptide_id:number, bottles:number, caps_per_bottle:number, mg_per_cap:number){
  const supabase = createServerSupabase(); const { data:{ user } }=await supabase.auth.getUser(); if(!user) throw new Error("Not auth")
  const { error } = await supabase.from("inventory_capsules").insert({ user_id:user.id, peptide_id, bottles, caps_per_bottle, mg_per_cap })
  if(error) throw error; revalidatePath("/inventory")
}
export async function updateVialQty(id:number, vials:number){
  const supabase = createServerSupabase(); const { data:{ user } }=await supabase.auth.getUser(); if(!user) throw new Error("Not auth")
  const { error } = await supabase.from("inventory_items").update({ vials }).eq("id", id).eq("user_id", user.id); if(error) throw error; revalidatePath("/inventory")
}
export async function deleteVial(id:number){
  const supabase = createServerSupabase(); const { data:{ user } }=await supabase.auth.getUser(); if(!user) throw new Error("Not auth")
  const { error } = await supabase.from("inventory_items").delete().eq("id", id).eq("user_id", user.id); if(error) throw error; revalidatePath("/inventory")
}
export async function deleteCaps(id:number){
  const supabase = createServerSupabase(); const { data:{ user } }=await supabase.auth.getUser(); if(!user) throw new Error("Not auth")
  const { error } = await supabase.from("inventory_capsules").delete().eq("id", id).eq("user_id", user.id); if(error) throw error; revalidatePath("/inventory")
}