import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

function createClient(cookieStore: ReturnType<typeof cookies>, writable: boolean): SupabaseClient {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookies) {
          if (!writable) return;
          cookies?.forEach((cookie) => cookieStore.set(cookie));
        },
      },
    }
  );
}

export function createServerComponentSupabase(): SupabaseClient {
  const cookieStore = cookies();
  return createClient(cookieStore, false);
}

export function createServerActionSupabase(): SupabaseClient {
  const cookieStore = cookies();
  return createClient(cookieStore, true);
}

export async function getUserOrNull() {
  const supabase = createServerComponentSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}

export async function getUserIdOrThrow() {
  const user = await getUserOrNull();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}
