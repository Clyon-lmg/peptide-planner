// app/auth/callback/page.tsx
"use client";

import * as React from "react";
import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export const dynamic = "force-dynamic"; // avoid static pre-render
export const revalidate = 0;

function CallbackInner() {
  const supabase = createClientComponentClient();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function run() {
      try {
        // Exchange the code in the URL (magic link / OAuth) for a session cookie
        await supabase.auth.exchangeCodeForSession();
      } catch {
        // ignore; fall through to redirect
      } finally {
        if (isMounted) {
          // Optional: check for next param to deep-link after auth
          const next = searchParams.get("next");
          router.replace(next || "/");
        }
      }
    }

    run();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-md p-6">
      <div className="rounded-xl border p-6 space-y-3">
        <h1 className="text-2xl font-semibold">Signing you in…</h1>
        <p className="text-sm text-gray-600">
          Please wait while we complete authentication.
        </p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  // Wrap `useSearchParams()` usage with Suspense to satisfy Next’s requirement
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md p-6">
          <div className="rounded-xl border p-6 space-y-3">
            <h1 className="text-2xl font-semibold">Loading…</h1>
            <p className="text-sm text-gray-600">
              Preparing authentication callback.
            </p>
          </div>
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
