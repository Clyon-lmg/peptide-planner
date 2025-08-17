// lib/useSupabaseUser.ts
"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function useSupabaseUser() {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const timer = useRef<any>(null);

  async function syncOnce() {
    try {
      const sess = await supabase.auth.getSession();
      const id1 = sess.data.session?.user?.id ?? null;
      if (id1) {
        setUserId(id1);
        setReady(true);
        return true;
      }
      // fallback to network call
      const u = await supabase.auth.getUser();
      const id2 = u.data.user?.id ?? null;
      if (id2) {
        setUserId(id2);
        setReady(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    let mounted = true;

    // initial sync + small retry window (up to ~2s) for magic-link hydration
    (async () => {
      const ok1 = await syncOnce();
      if (ok1) return;
      // retry a few times
      let attempts = 0;
      timer.current = setInterval(async () => {
        attempts += 1;
        const ok = await syncOnce();
        if (ok || attempts > 10) {
          clearInterval(timer.current);
          if (!ok) setReady(true); // give up; not signed in
        }
      }, 200);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      setUserId(session?.user?.id ?? null);
      setReady(true);
    });

    return () => {
      mounted = false;
      if (timer.current) clearInterval(timer.current);
      sub?.subscription.unsubscribe();
    };
  }, []);

  const refresh = async () => {
    await supabase.auth.refreshSession();
    await syncOnce();
  };

  return { userId, ready, refresh };
}
