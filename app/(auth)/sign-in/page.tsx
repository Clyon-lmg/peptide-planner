// app/(auth)/sign-in/page.tsx
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerActionSupabase } from "@/lib/supabaseServer";
import SignInForm from "./SignInForm";

export const dynamic = "force-dynamic"; // avoid static pre-render
export const revalidate = 0;

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};
type PasswordState = { error: string };

export default function SignInPage({ searchParams }: PageProps) {
  // Inline server action must return Promise<void>
  const sendMagicLink = async (formData: FormData) => {
    "use server";
    const email = String(formData.get("email") || "").trim();
    if (!email) return;

    const supabase = createServerActionSupabase();
    const hdrs = headers();
    const protocol = hdrs.get("x-forwarded-proto") || "http";
    const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "localhost:3000";
    const redirectBase =
      process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`;
    const next = String(formData.get("redirect") || "");
    const emailRedirectTo = next
      ? `${redirectBase}/auth/callback?next=${encodeURIComponent(next)}`
      : `${redirectBase}/auth/callback`;
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    });
    // No return payload (Vercel TS requirement). UI will show static message below.
  };

  const signInWithPassword = async (
    _prev: PasswordState,
    formData: FormData
  ): Promise<PasswordState> => {
    "use server";
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const next = String(formData.get("redirect") || "") || "/today";

    const supabase = createServerActionSupabase();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    redirect(next || "/today");
  };

  const err = decodeURIComponent((searchParams?.error as string) || "");
  const msg = decodeURIComponent(
    (searchParams?.message as string) ||
      "Enter your email and we’ll send you a sign-in link."
  );
  const redirectTo = (searchParams?.redirect as string) || "";
  return (
    <div className="mx-auto max-w-md p-6">
      <div className="rounded-xl border p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Sign in</h1>

        <SignInForm
          sendMagicLink={sendMagicLink}
          signInWithPassword={signInWithPassword}
          err={err}
          msg={msg}
          redirect={redirectTo}
        />
              <div className="text-xs text-muted">
          Having trouble?{" "}
          <Link href="/" className="underline">
            Go home
          </Link>
          {" or "}
          <Link href="/sign-up" className="underline">
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
