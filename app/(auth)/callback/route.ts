import { NextResponse } from "next/server";

export async function GET(req: Request) {
  // Supabase handles cookies on its own through the client helpers in pages/actions.
  // This route simply bounces users to their intended next page (if present).
  const { searchParams } = new URL(req.url);
  const next = searchParams.get("next") || "/today";
  return NextResponse.redirect(new URL(next, req.url));
}
