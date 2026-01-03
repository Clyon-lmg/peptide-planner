import { NextResponse } from "next/server";
import { createServerActionSupabase } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  const supabase = createServerActionSupabase();
  
  // Sign out from Supabase (clears cookies)
  await supabase.auth.signOut();

  // Redirect to sign-in page
  return NextResponse.redirect(new URL("/sign-in", new URL(req.url).origin));
}

// Fallback: If someone tries to visit /api/auth/signout directly in the browser
export async function GET(req: Request) {
  return NextResponse.redirect(new URL("/sign-in", new URL(req.url).origin));
}
