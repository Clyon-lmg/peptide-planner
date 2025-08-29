import "server-only";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export function createServerSupabase(): SupabaseClient {
  const cookieStore = cookies();
  const headerList = headers();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) =>
          cookieStore.set({ name, value, ...options }),
        remove: (name, options) => cookieStore.delete({ name, ...options }),
      },
      headers: {
        get: (name) => headerList.get(name),
      },
    }  );
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
