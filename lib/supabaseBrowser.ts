// lib/supabaseBrowser.ts
// Use the official SSR helpers so we share cookies/session with the rest of the app.
import { createBrowserClient } from "@supabase/ssr";

export function getSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createBrowserClient(url, anon, {
    cookies: {
      get(name: string) {
        if (typeof document === "undefined") return "";
        const match = document.cookie.split("; ").find((row) => row.startsWith(name + "="));
        return match?.split("=")[1] ?? "";
      },
    },
  });
}
