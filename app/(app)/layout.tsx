export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";
import { createServerComponentSupabase } from "@/lib/supabaseServer";
import AppShell from "@/components/layout/AppShell";

const serviceSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = createServerComponentSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  // Subscription gate — disabled until launch
  // To enable: uncomment the block below and import { headers } from "next/headers" and { redirect } from "next/navigation"
  //
  // const pathname = headers().get("x-pathname") ?? "";
  // if (user && pathname !== "/subscribe") {
  //   const svc = serviceSupabase();
  //   const { data: sub } = await svc
  //     .from("subscriptions")
  //     .select("status, trial_ends_at")
  //     .eq("user_id", user.id)
  //     .single();
  //   const now = new Date();
  //   const hasAccess =
  //     sub &&
  //     ((sub.status === "trialing" && new Date(sub.trial_ends_at) > now) ||
  //       sub.status === "active");
  //   if (!hasAccess) redirect("/subscribe");
  // }

  void serviceSupabase; // referenced above, retained for when gate is enabled

  return <AppShell userEmail={user?.email ?? null}>{children}</AppShell>;
}
