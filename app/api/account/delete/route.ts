import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerActionSupabase } from "@/lib/supabaseServer";

export async function DELETE() {
  // Get the authenticated user via cookie session
  const supabase = createServerActionSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = user.id;

  // Admin client with service role — bypasses RLS and can delete auth users
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Delete user data from all tables (most cascade from auth.users but we
  // delete explicitly in case RLS or cascade isn't set up on every table)
  const tables = [
    "doses",
    "inventory_items",
    "inventory_capsules",
    "protocol_items",
    "protocols",
    "weight_logs",
    "suggestions",
    "injection_sites",
    "injection_site_lists",
    "consultations",
    "subscriptions",
  ];

  for (const table of tables) {
    await admin.from(table).delete().eq("user_id", userId);
  }

  // Delete the auth user — this is permanent and removes login credentials
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
