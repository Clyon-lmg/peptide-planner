﻿'use server';

import { createServerComponentSupabase } from '@/lib/supabaseServer';

export async function getStatus(peptide_id: number) {
  // READ during Server Component render -> use component client
  const supabase = createServerComponentSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (!user) {
    console.warn('getStatus: auth.getUser() returned null', authError);
    return 'PENDING';
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from('doses')
    .select('status')
    .eq('user_id', user.id)
    .eq('peptide_id', peptide_id)
    .eq('date_for', todayIso)
    .maybeSingle();

  return (data?.status as string | undefined) ?? 'PENDING';
}