import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerActionSupabase } from "@/lib/supabaseServer";
import AuthUI from "./AuthUI"; 

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

type PasswordState = { error: string };

export default function SignInPage({ searchParams }: PageProps) {
  
  // --- SERVER ACTION: Magic Link ---
  const sendMagicLink = async (formData: FormData) => {
    "use server";
    const email = String(formData.get("email") || "").trim();
    if (!email) return;

    const supabase = createServerActionSupabase();
    const hdrs = headers();
    const protocol = hdrs.get("x-forwarded-proto") || "http";
    const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "localhost:3000";
    
    // Construct the base URL safely
    const redirectBase = process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`;
    
    // CRITICAL FIX: Point to /callback, NOT /auth/callback
    const next = String(formData.get("redirect") || "");
    const emailRedirectTo = next
      ? `${redirectBase}/callback?next=${encodeURIComponent(next)}`
      : `${redirectBase}/callback`;

    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    });
  };

  // --- SERVER ACTION: Password ---
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

  // --- PARSE PARAMS ---
  const err = decodeURIComponent((searchParams?.error as string) || "");
  const msg = decodeURIComponent(
    (searchParams?.message as string) || ""
  );
  const redirectTo = (searchParams?.redirect as string) || "";

  // --- RENDER THE NEW UI ---
  return (
    <AuthUI 
      sendMagicLink={sendMagicLink}
      signInWithPassword={signInWithPassword}
      redirectUrl={redirectTo}
      errorMessage={err}
      message={msg}
    />
  );
}
