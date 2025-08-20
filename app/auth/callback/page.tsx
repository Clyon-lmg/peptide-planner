// app/auth/callback/page.tsx
"use client";

import * as React from "react";
import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function CallbackInner() {
  const supabase = createClientComponentClient();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        // Supabase sends `code` for PKCE / email link, older flows may use `token_hash`
        const code =
          searchParams.get("code") ??
          searchParams.get("token_hash") ??
          "";

        // Some providers append an error; handle gracefully
        const err = searchParams.get("error") ?? searchParams.get("error_description");
        if (err) {
          // Nothing else to do; bounce to sign-in with error message
          const msg = encodeURIComponent(err);
          if (mounted) router.replace(`/sign-in?error=${msg}`);
          return;
        }

        if (code) {
          // Your installed version expects ONE argument; pass the code explicitly.
          // Cast to any to be compatible across helper/auth-js minor version diffs.
          await (supabase.auth as any).exchangeCodeForSession(code);
        }
      } catch {
        // ignore; we'll proceed to redirect regardless
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
        <p className="text-sm text-gray-600">
          Please wait while we complete authentication.
        </p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  // Wrap useSearchParams() in Suspense per Next.js guidance
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
