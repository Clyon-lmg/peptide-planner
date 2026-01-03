import { NextResponse } from "next/server";
import { createServerActionSupabase } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  // The URL contains the "code" sent by Supabase
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  
  // if "next" is in the URL, use it, otherwise default to /today
  const next = searchParams.get("next") ?? "/today";

  if (code) {
    const supabase = createServerActionSupabase();
    
    // CRITICAL STEP: Exchange the code for a user session
    // This sets the auth cookies so you stay logged in
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // Success! Forward the user to the dashboard
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If the code was invalid or missing, send back to login with error
  return NextResponse.redirect(`${origin}/sign-in?error=Invalid%20login%20link`);
}
