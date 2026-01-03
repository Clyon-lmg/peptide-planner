import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createServerActionSupabase } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Sign up • Peptide Planner",
  description: "Create your Peptide Planner account.",
};

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export default function SignUpPage({ searchParams }: PageProps) {
  const signUp = async (formData: FormData) => {
    "use server";
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const username = String(formData.get("username") || "").trim();
    if (!email || !password) {
      redirect("/sign-up?error=" + encodeURIComponent("Email and password are required."));
    }

    const supabase = createServerActionSupabase();
    const redirectBase = process.env.NEXT_PUBLIC_SITE_URL;
    if (!redirectBase) {
      console.error("NEXT_PUBLIC_SITE_URL is undefined");
      throw new Error("NEXT_PUBLIC_SITE_URL is undefined");
    }
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        // FIX: Point to /callback, not /auth/callback
        emailRedirectTo: `${redirectBase}/callback?next=/today`,
      },
    });

    if (error) {
      redirect(`/sign-up?error=${encodeURIComponent(error.message)}`);
    }

    if (data?.session) {
      redirect("/today");
    }

    // Redirect to the success/verify page or dashboard
    redirect("/today");
  };

  const err = (searchParams?.error as string) || "";

  return (
    <div className="mx-auto max-w-md p-6">
      <div className="rounded-xl border p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Create account</h1>
        {err && (
                  <div className="rounded border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {decodeURIComponent(err)}
          </div>
        )}
        <form action={signUp} className="space-y-3">
          <label className="block text-sm">
            Email
            <input
              name="email"
              type="email"
              required
                          className="mt-1 w-full rounded border px-3 py-2 text-foreground bg-background"
            />
          </label>
          <label className="block text-sm">
            Password
            <input
              name="password"
              type="password"
              required
              minLength={6}
                          className="mt-1 w-full rounded border px-3 py-2 text-foreground bg-background"
            />
          </label>
          <label className="block text-sm">
            Username (optional)
            <input
              name="username"
              type="text"
                          className="mt-1 w-full rounded border px-3 py-2 text-foreground bg-background"
            />
          </label>
          <button
            type="submit"
                      className="rounded px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white w-full font-medium transition-colors"
          >
            Sign up
          </button>
        </form>
              <div className="text-xs text-muted-foreground text-center mt-4">
          Already have an account?{" "}
          <Link href="/sign-in" className="underline hover:text-foreground">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
