// lib/supabaseBrowser.ts
import { createBrowserClient } from '@supabase/ssr';

export function getSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  // Do not pass a custom cookies object in the browser.
  // @supabase/ssr will read/write document.cookie for you.
  return createBrowserClient(url, anonKey);
}
