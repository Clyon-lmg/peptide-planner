'use server';

import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import type { DoseStatus } from '../today/actions';

export type CalendarDoseRow = {
  date_for: string;          // YYYY-MM-DD
  peptide_id: number;
  canonical_name: string;
  dose_mg: number;
  status: DoseStatus;
};

/**
 * Return all doses for the signed-in user in the inclusive ISO date range.
 * startIso / endIso are "YYYY-MM-DD" (from the client in local system tz).
 */
export async function getDosesForRange(startIso: string, endIso: string) {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('doses')
    .select('date_for, peptide_id, dose_mg, status, peptides(canonical_name)')
    .eq('user_id', user.id)
    .gte('date_for', startIso)
    .lte('date_for', endIso)
    .order('date_for', { ascending: true });

  if (error) throw error;

  const rows: CalendarDoseRow[] = (data ?? []).map((r: any) => ({
    date_for: r.date_for,
    peptide_id: r.peptide_id,
    canonical_name: r.peptides?.canonical_name ?? '',
    dose_mg: Number(r.dose_mg ?? 0),
    status: (r.status ?? 'PENDING') as DoseStatus,
  }));

  return rows;
}
