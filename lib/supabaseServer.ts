import "server-only";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

export function createServerSupabase() {
  return createServerComponentClient({ cookies });
}

export async function getUserOrNull() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}

export async function getUserIdOrThrow() {
  const user = await getUserOrNull();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}
