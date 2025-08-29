"use server"
import { revalidatePath } from "next/cache";
import { createServerActionSupabase } from "@/lib/supabaseServer";

export async function createOrder(vendor:string, status:string, total:number){
  const supabase = createServerActionSupabase(); const { data:{ user } }=await supabase.auth.getUser(); if(!user) throw new Error("Not auth")
  const { error } = await supabase.from("orders").insert({ user_id:user.id, vendor, status, total })
  if(error) throw error; revalidatePath("/orders")
}
export async function updateOrderStatus(id:number, status:string){
  const supabase = createServerActionSupabase(); const { data:{ user } }=await supabase.auth.getUser(); if(!user) throw new Error("Not auth")
  const { error } = await supabase.from("orders").update({ status }).eq("id", id).eq("user_id", user.id)
  if(error) throw error; revalidatePath("/orders")
}
export async function deleteOrder(id:number){
  const supabase = createServerActionSupabase(); const { data:{ user } }=await supabase.auth.getUser(); if(!user) throw new Error("Not auth")
  const { error } = await supabase.from("orders").delete().eq("id", id).eq("user_id", user.id)
  if(error) throw error; revalidatePath("/orders")
}