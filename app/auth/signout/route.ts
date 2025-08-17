import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
export async function POST(req:Request){ const supabase=createRouteHandlerClient({ cookies }); await supabase.auth.signOut(); return NextResponse.redirect(new URL("/sign-in", new URL(req.url).origin)) }
