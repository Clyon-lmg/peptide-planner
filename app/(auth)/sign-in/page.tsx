// app/(auth)/sign-in/page.tsx
"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function SignInPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") || "/today";
  const errorParam = params.get("error");

  const [email, setEmail] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [clientError, setClientError] = React.useState<string | null>(null);
  const [cooldownSec, setCooldownSec] = React.useState(0);

  // If we were redirected with an error (e.g., rate limit earlier), show it.
  React.useEffect(() => {
    if (errorParam) {
      setClientError(decodeURIComponent(errorParam));
    }
  }, [errorParam]);

  // Simple 60s cooldown after requesting a magic link to reduce rate‑limit trips
  React.useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = setInterval(() => setCooldownSec((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [cooldownSec]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);

    if (!email || !email.includes("@")) {
      setClientError("Please enter a valid email address.");
      return;
    }

    setSending(true);
    try {
      // Build redirect URL for the email link to bring users right back into the app
      const baseUrl =
        typeof window !== "undefined"
          ? window.location.origin
          : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${baseUrl}${redirectTo}`,
        },
      });

      if (error) {
        // common: request rate limit; surface the message cleanly and start cooldown
        setClientError(
          error.message.includes("rate limit")
            ? "Too many requests for magic links. Please try again in a minute."
            : error.message
        );
        setCooldownSec(60);
        return;
      }

      setSentTo(email);
      setCooldownSec(60);
    } catch (err: any) {
      setClientError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const onContinue = () => {
    // If the session is already present (e.g., user clicked the email link and came back),
    // head to the destination. If not, this simply refreshes the page after they sign in.
    router.replace(redirectTo);
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
      <h1 className="text-2xl font-semibold mb-2">Sign in</h1>
      <p className="text-sm text-muted-foreground mb-6">
        We’ll email you a magic link to access your account.
      </p>

      {clientError ? (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
          {clientError}
        </div>
      ) : null}

      {sentTo ? (
        <div className="space-y-4">
          <div className="rounded-md border bg-muted p-3 text-sm">
            We sent a sign-in link to <span className="font-medium">{sentTo}</span>.
            <br />
            Please check your inbox (and spam folder). {cooldownSec > 0 ? `You can request another link in ${cooldownSec}s.` : ""}
          </div>

          <button
            onClick={onContinue}
            className="w-full rounded-md px-4 py-2 border bg-primary text-primary-foreground disabled:opacity-50"
          >
            I clicked the link – continue
          </button>
          <button
            onClick={() => {
              setSentTo(null);
              setEmail("");
            }}
            className="w-full rounded-md px-4 py-2 border bg-background"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              className="w-full rounded-md border bg-background px-3 py-2 outline-none"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={sending || cooldownSec > 0}
            />
          </div>

          <button
            type="submit"
            disabled={sending || cooldownSec > 0}
            className="w-full rounded-md px-4 py-2 border bg-primary text-primary-foreground disabled:opacity-50"
          >
            {sending ? "Sending…" : cooldownSec > 0 ? `Wait ${cooldownSec}s` : "Send magic link"}
          </button>

          <p className="text-xs text-muted-foreground">
            By continuing, you agree to our Terms and Privacy Policy.
          </p>
        </form>
      )}
    </div>
  );
}
