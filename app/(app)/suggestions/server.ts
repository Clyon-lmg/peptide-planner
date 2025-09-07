"use server";
import { revalidatePath } from "next/cache";
import { createServerActionSupabase } from "@/lib/supabaseServer";

export async function acceptSuggestion(id:number){
  const supabase = createServerActionSupabase(); const { data:{ user } } = await supabase.auth.getUser(); if(!user) throw new Error("Not auth");
  const { error } = await supabase.from("suggestions").update({ status: "ACCEPTED" }).eq("id", id).eq("user_id", user.id);
  if(error) throw error; revalidatePath("/suggestions");
}
export async function rejectSuggestion(id:number){
  const supabase = createServerActionSupabase(); const { data:{ user } } = await supabase.auth.getUser(); if(!user) throw new Error("Not auth");
  const { error } = await supabase.from("suggestions").update({ status: "REJECTED" }).eq("id", id).eq("user_id", user.id);
  if(error) throw error; revalidatePath("/suggestions");
}