import { NextResponse } from "next/server";
import { createServerActionSupabase } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  const supabase = createServerActionSupabase();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/sign-in", new URL(req.url).origin));
}