export const dynamic = "force-dynamic";
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

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: sub?.stripe_customer_id ?? undefined,
    customer_email: sub?.stripe_customer_id ? undefined : user.email,
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/today?subscribed=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/subscribe`,
    metadata: { user_id: user.id },
  });

  return NextResponse.json({ url: session.url });
}
