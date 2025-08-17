"use server"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"

export async function addCartItem(peptide_id:number, qty:number, price:number){
  const supabase=createServerComponentClient({ cookies }); const { data:{ user } }=await supabase.auth.getUser(); if(!user) throw new Error("Not auth")
  const { error } = await supabase.from("cart_items").insert({ user_id:user.id, peptide_id, qty, price })
  if(error) throw error; revalidatePath("/cart")
}
export async function updateCartQty(id:number, qty:number){
  const supabase=createServerComponentClient({ cookies }); const { data:{ user } }=await supabase.auth.getUser(); if(!user) throw new Error("Not auth")
  const { error } = await supabase.from("cart_items").update({ qty }).eq("id", id).eq("user_id", user.id); if(error) throw error; revalidatePath("/cart")
}
export async function deleteCartItem(id:number){
  const supabase=createServerComponentClient({ cookies }); const { data:{ user } }=await supabase.auth.getUser(); if(!user) throw new Error("Not auth")
  const { error } = await supabase.from("cart_items").delete().eq("id", id).eq("user_id", user.id); if(error) throw error; revalidatePath("/cart")
}
