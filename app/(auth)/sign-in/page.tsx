// app/(auth)/sign-in/page.tsx
import { cookies } from "next/headers";
import Link from "next/link";
import { createServerActionClient } from "@supabase/auth-helpers-nextjs";

export const dynamic = "force-dynamic"; // avoid static pre-render
export const revalidate = 0;

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export default function SignInPage({ searchParams }: PageProps) {
  // Inline server action must return Promise<void>
  const sendMagicLink = async (formData: FormData) => {
    "use server";
    const email = String(formData.get("email") || "").trim();
    if (!email) return;

    const supabase = createServerActionClient({ cookies });
    const redirectBase =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const emailRedirectTo = `${redirectBase}/auth/callback`;

    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    });
    // No return payload (Vercel TS requirement). UI will show static message below.
  };

  const err = (searchParams?.error as string) || "";
  const msg =
    (searchParams?.message as string) ||
    "Enter your email and we’ll send you a sign-in link.";

  return (
    <div className="mx-auto max-w-md p-6">
      <div className="rounded-xl border p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Sign in</h1>

        {err ? (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {decodeURIComponent(err)}
          </div>
        ) : (
          <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            {decodeURIComponent(msg)}
          </div>
        )}

        <form action={sendMagicLink} className="space-y-3">
          <label className="block text-sm">
            Email
            <input
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="rounded px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white"
          >
            Send magic link
          </button>
        </form>

        <div className="text-xs text-gray-600">
          Having trouble?{" "}
          <Link href="/" className="underline">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
