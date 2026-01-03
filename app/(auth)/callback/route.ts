import { NextResponse } from "next/server";
import { createServerActionSupabase } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  
  // if "next" is in the URL, use it, otherwise default to /today
  const next = searchParams.get("next") ?? "/today";

  if (code) {
    const supabase = createServerActionSupabase();
    
    // CRITICAL: Exchange the code for a session (sets the cookie)
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If error or no code, redirect to sign-in
  return NextResponse.redirect(`${origin}/sign-in?error=Invalid%20login%20link`);
}
