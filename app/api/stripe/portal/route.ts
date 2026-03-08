import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServerActionSupabase } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

const serviceSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

export async function POST() {
  const supabase = createServerActionSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const svc = serviceSupabase();
  const { data: sub } = await svc
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: "No billing account found" }, { status: 400 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/today`,
  });

  return NextResponse.json({ url: session.url });
}
