'use client';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      router.replace(session ? '/today' : '/login');
    })();
  }, [router]);
  return null;
}
