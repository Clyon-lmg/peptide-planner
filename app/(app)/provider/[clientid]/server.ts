"use server";
import { createServerActionSupabase } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";

export async function createSuggestionForClient(clientId: string, type: string, title: string, note: string) {
  const supabase = createServerActionSupabase();
  const { error } = await supabase.from("suggestions").insert({ user_id: clientId, type, title, note, status: "PENDING" });
  if (error) throw error;
  // Revalidate suggestions page for the client if needed
  revalidatePath(`/provider/${clientId}/${type === 'protocol' ? 'protocols' : 'inventory'}`);
  revalidatePath("/suggestions");
}

export async function updateSuggestionStatus(id: number, status: string, clientId: string) {
  const supabase = createServerActionSupabase();
  const { error } = await supabase.from("suggestions").update({ status }).eq("id", id).eq("user_id", clientId);
  if (error) throw error;
  revalidatePath("/suggestions");
}