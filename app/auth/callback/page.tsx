'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Check for an existing session and redirect if present
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/today');
    });

    // Redirect once Supabase processes the tokens from the URL
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace('/today');
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return <p>Loading...</p>;
}
