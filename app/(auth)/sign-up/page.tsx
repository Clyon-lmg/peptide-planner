﻿import { cookies, headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createServerActionClient } from "@supabase/auth-helpers-nextjs";

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

    const supabase = createServerActionClient({ cookies });
    const hdrs = headers();
    const protocol = hdrs.get("x-forwarded-proto") || "http";
    const host = hdrs.get("x-forwarded-host") || hdrs.get("host");
    const redirectBase =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
      `${protocol}://${host}`;
      const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: `${redirectBase}/auth/callback?next=/today`,
      },
    });

    if (error) {
      redirect(`/sign-up?error=${encodeURIComponent(error.message)}`);
    }

    if (data?.session) {
      redirect("/today");
    }

    redirect("/auth/callback?next=/today");
  };

  const err = (searchParams?.error as string) || "";

  return (
    <div className="mx-auto max-w-md p-6">
      <div className="rounded-xl border p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Create account</h1>
        {err && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
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
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Password
            <input
              name="password"
              type="password"
              required
              minLength={6}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Username (optional)
            <input
              name="username"
              type="text"
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="rounded px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white"
          >
            Sign up
          </button>
        </form>
        <div className="text-xs text-gray-600">
          Already have an account?{" "}
          <Link href="/sign-in" className="underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}