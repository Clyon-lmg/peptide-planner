﻿// app/auth/callback/page.tsx
"use client";

import * as React from "react";
import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

// Keep this route fully dynamic (no prerender/caching)
export const dynamic = "force-dynamic";

function CallbackInner() {
  const supabase = getSupabaseBrowser();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        // Handle auth provider errors in the URL gracefully
        const err = searchParams.get("error") ?? searchParams.get("error_description");
        if (err) {
          const msg = encodeURIComponent(err);
          if (mounted) router.replace(`/sign-in?error=${msg}`);
          return;
        }

        // Supabase email link / PKCE: "code" (older variants: "token_hash")
        const code =
          searchParams.get("code") ??
          searchParams.get("token_hash") ??
          "";

        if (code) {
          // Your helpers expect one argument in this project version.
          await (supabase.auth as any).exchangeCodeForSession(code);
        }
      } catch {
        // ignore; we'll redirect either way
      } finally {
        if (mounted) {
          const next = searchParams.get("next");
          router.replace(next || "/");
        }
      }
    }

    run();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-md p-6">
      <div className="rounded-xl border p-6 space-y-3">
        <h1 className="text-2xl font-semibold">Signing you in…</h1>
        <p className="text-sm text-gray-600">Please wait while we complete authentication.</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  // Next.js requires Suspense around useSearchParams in client pages
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md p-6">
          <div className="rounded-xl border p-6 space-y-3">
            <h1 className="text-2xl font-semibold">Loading…</h1>
            <p className="text-sm text-gray-600">Preparing authentication callback.</p>
          </div>
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
