"use server"
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabaseServer";

export async function createSuggestion(title:string, note:string){
  const supabase = createServerSupabase(); const { data:{ user } }=await supabase.auth.getUser(); if(!user) throw new Error("Not auth")
  const { error } = await supabase.from("suggestions").insert({ user_id:user.id, title, note, status:"OPEN" })
  if(error) throw error; revalidatePath("/suggestions")
}
export async function updateSuggestionStatus(id:number, status:string){
  const supabase = createServerSupabase(); const { data:{ user } }=await supabase.auth.getUser(); if(!user) throw new Error("Not auth")
  const { error } = await supabase.from("suggestions").update({ status }).eq("id", id).eq("user_id", user.id)
  if(error) throw error; revalidatePath("/suggestions")
}
export async function deleteSuggestion(id:number){
  const supabase = createServerSupabase(); const { data:{ user } }=await supabase.auth.getUser(); if(!user) throw new Error("Not auth")
  const { error } = await supabase.from("suggestions").delete().eq("id", id).eq("user_id", user.id)
  if(error) throw error; revalidatePath("/suggestions")
}