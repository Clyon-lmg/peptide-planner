'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import {
  createServerActionClient,
  createServerComponentClient,
} from '@supabase/auth-helpers-nextjs';

export type DoseStatus = 'PENDING' | 'TAKEN' | 'SKIPPED';
export type TodayDoseRow = {
  peptide_id: number;
  canonical_name: string;
  dose_mg: number | null;
  mg_per_vial: number | null;
  bac_ml: number | null;
  syringe_units: number | null;
  status: DoseStatus;
};

/**
 * READ (can be called from client) — respects a client-supplied local date.
 * If dateOverride is missing, we fall back to server UTC (only used for SSR or tests).
 */
export async function getTodayDosesWithUnits(dateOverride?: string) {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
    error: uerr,
  } = await supabase.auth.getUser();
  if (uerr || !user) throw uerr ?? new Error('Not authenticated');

  const iso = (dateOverride ?? new Date().toISOString().slice(0, 10)) as string;

  const { data, error } = await supabase.rpc('fn_get_today_doses_with_units', {
    p_user_id: user.id,
    p_date: iso,
  });
  if (error) throw error;
  return (data ?? []) as TodayDoseRow[];
}

/** WRITE helper — accepts client local date */
async function setStatus(
  peptide_id: number,
  status: DoseStatus,
  dateOverride?: string
) {
  const supabase = createServerActionClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const iso = dateOverride ?? new Date().toISOString().slice(0, 10);

  const { error } = await supabase
    .from('doses')
    .update({ status })
    .match({ user_id: user.id, peptide_id, date_for: iso });
  if (error) throw error;

  // Revalidate both pages that might show today's state
  revalidatePath('/today');
  revalidatePath('/calendar');
  return { ok: true };
}

export async function logDose(peptide_id: number, dateOverride?: string) {
  return setStatus(peptide_id, 'TAKEN', dateOverride);
}
export async function skipDose(peptide_id: number, dateOverride?: string) {
  return setStatus(peptide_id, 'SKIPPED', dateOverride);
}
export async function resetDose(peptide_id: number, dateOverride?: string) {
  return setStatus(peptide_id, 'PENDING', dateOverride);
}
