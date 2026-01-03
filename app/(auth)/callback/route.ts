import { NextResponse } from "next/server";
import { createServerActionSupabase } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/today";

  if (code) {
    const supabase = createServerActionSupabase();
    
    // Exchange the code for a session (logs the user in)
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If something went wrong, send them back to sign-in with an error
  return NextResponse.redirect(`${origin}/sign-in?error=Invalid%20login%20link`);
}
