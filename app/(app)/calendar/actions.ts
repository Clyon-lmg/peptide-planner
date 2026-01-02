// app/(app)/calendar/actions.ts
'use server';

import { createServerActionSupabase } from '@/lib/supabaseServer';
import { isDoseDayUTC, type ScheduleItem } from '@/lib/scheduleEngine';
import type { DoseStatus } from '../today/actions';
import { revalidatePath } from 'next/cache';

export type CalendarDoseRow = {
  date_for: string;          // YYYY-MM-DD
  peptide_id: number;
  canonical_name: string;
  dose_mg: number;
  status: DoseStatus;
  time_of_day: string | null;
  site_label: string | null;
};

/**
 * Return all doses for the signed-in user in the inclusive ISO date range.
 * startIso / endIso are "YYYY-MM-DD" (from the client in local system tz).
 */
export async function getDosesForRange(
  startIso: string,
  endIso: string
): Promise<CalendarDoseRow[]> {
    const supabase = createServerActionSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // ----- Active protocol and items -----
  const { data: protocol } = await supabase
    .from('protocols')
    .select('id, start_date')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();
  if (!protocol?.id) return [];

  const { data: items } = await supabase
    .from('protocol_items')
    .select(
'peptide_id,dose_mg_per_administration,schedule,custom_days,cycle_on_weeks,cycle_off_weeks,every_n_days,titration_interval_days,titration_amount_mg,time_of_day'
    )
    .eq('protocol_id', protocol.id);
  if (!items?.length) return [];

  const peptideIds = Array.from(
    new Set(items.map((i: any) => Number(i.peptide_id)))
  );

    // ----- Peptide names and existing statuses (fetch in parallel) -----
  const [{ data: peptideRows }, { data: doseRows }] = await Promise.all([
    supabase
      .from('peptides')
      .select('id, canonical_name')
      .in('id', peptideIds),
    supabase
      .from('doses')
      .select('date_for, peptide_id, dose_mg, status, site_label')
      .eq('user_id', user.id)
      .eq('protocol_id', protocol.id)
      .gte('date_for', startIso)
      .lte('date_for', endIso),
  ]);
  const nameById = new Map<number, string>(
    (peptideRows ?? []).map((p: any) => [Number(p.id), String(p.canonical_name)])
  );

  const statusMap = new Map<string, { status: DoseStatus; dose_mg: number; site_label: string | null }>();
  (doseRows ?? []).forEach((r: any) => {
    const key = `${r.date_for}_${r.peptide_id}`;
    statusMap.set(key, {
      status: (r.status ?? 'PENDING') as DoseStatus,
      dose_mg: Number(r.dose_mg ?? 0),
      site_label: r.site_label ?? null,
    });
  });

  // ----- Generate expected doses for each day -----
  const start = new Date(startIso + 'T00:00:00Z');
  const end = new Date(endIso + 'T00:00:00Z');
  const protocolStartISO =
    protocol.start_date ?? start.toISOString().slice(0, 10);

  const rows: CalendarDoseRow[] = [];

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);

    for (const it of items) {
      const itemForSchedule: ScheduleItem & { protocol_start_date: string } = {
        ...it,
        protocol_start_date: protocolStartISO,
      };
      if (!isDoseDayUTC(d, itemForSchedule)) continue;

      const key = `${iso}_${it.peptide_id}`;
      const existing = statusMap.get(key);
      rows.push({
        date_for: iso,
        peptide_id: Number(it.peptide_id),
        canonical_name: nameById.get(Number(it.peptide_id)) || '',
        dose_mg:
          existing?.dose_mg ?? Number(it.dose_mg_per_administration || 0),
        status: existing?.status ?? 'PENDING',
        time_of_day: (it as any).time_of_day ?? null,
        site_label: existing?.site_label ?? null,
      });
    }
  }

  // Inject any recorded doses that weren't part of the generated schedule
  const existingKeys = new Set(
    rows.map((r) => `${r.date_for}_${r.peptide_id}`)
  );
  (doseRows ?? []).forEach((r: any) => {
    const key = `${r.date_for}_${r.peptide_id}`;
    if (existingKeys.has(key)) return;
    rows.push({
      date_for: r.date_for,
      peptide_id: Number(r.peptide_id),
      canonical_name: nameById.get(Number(r.peptide_id)) || '',
      dose_mg: Number(r.dose_mg ?? 0),
      status: (r.status ?? 'PENDING') as DoseStatus,
      time_of_day: null,
      site_label: r.site_label ?? null,
    });
  });

  rows.sort((a, b) => {
    const da = a.date_for.localeCompare(b.date_for);
    if (da !== 0) return da;
    const ta = (a.time_of_day ?? '99:99');
    const tb = (b.time_of_day ?? '99:99');
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.canonical_name.localeCompare(b.canonical_name);
  });
  return rows;
}

/**
 * Marks a dose as TAKEN or SKIPPED.
 * Performs an UPSERT: if the row doesn't exist (PENDING), it creates it.
 */
export async function updateDoseStatus(
    dateIso: string,
    peptideId: number,
    status: DoseStatus,
    doseMg: number
  ) {
    const supabase = createServerActionSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
  
    // 1. Get the active protocol ID
    const { data: protocol } = await supabase
      .from('protocols')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();
  
    if (!protocol) throw new Error('No active protocol found');
  
    // 2. Upsert the dose record
    // We match on the unique constraint: user_id + protocol_id + date_for + peptide_id
    const { error } = await supabase
      .from('doses')
      .upsert({
        user_id: user.id,
        protocol_id: protocol.id,
        date_for: dateIso,
        peptide_id: peptideId,
        status: status,
        dose_mg: doseMg,
        // Optional: capture timestamp if taking it now
        completed_at: status === 'TAKEN' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id, protocol_id, date_for, peptide_id'
      });
  
    if (error) {
      console.error("Update failed:", error);
      throw new Error('Failed to update dose status');
    }
  
    revalidatePath('/calendar');
}