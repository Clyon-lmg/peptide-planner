// app/(app)/calendar/actions.ts
'use server';

import { cookies } from 'next/headers';
import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { isDoseDayUTC } from '@/lib/scheduleEngine';
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
export async function getDosesForRange(
  startIso: string,
  endIso: string
): Promise<CalendarDoseRow[]> {
    const supabase = createServerActionClient({ cookies });
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
      'peptide_id,dose_mg_per_administration,schedule,custom_days,cycle_on_weeks,cycle_off_weeks,every_n_days'
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
      .select('date_for, peptide_id, dose_mg, status')
      .eq('user_id', user.id)
      .eq('protocol_id', protocol.id)
      .gte('date_for', startIso)
      .lte('date_for', endIso),
  ]);
  const nameById = new Map<number, string>(
    (peptideRows ?? []).map((p: any) => [Number(p.id), String(p.canonical_name)])
  );

  const statusMap = new Map<string, { status: DoseStatus; dose_mg: number }>();
  (doseRows ?? []).forEach((r: any) => {
    const key = `${r.date_for}_${r.peptide_id}`;
    statusMap.set(key, {
      status: (r.status ?? 'PENDING') as DoseStatus,
      dose_mg: Number(r.dose_mg ?? 0),
    });
  });

  // ----- Generate expected doses for each day -----
  const start = new Date(startIso + 'T00:00:00Z');
  const end = new Date(endIso + 'T00:00:00Z');
  const protocolStart = protocol.start_date
    ? new Date(protocol.start_date + 'T00:00:00Z')
    : new Date();
  const protocolStartISO = protocolStart.toISOString().slice(0, 10);
  const tzOffset = new Date().getTimezoneOffset() * 60000;
  const protocolStartLocal = new Date(protocolStart.getTime() + tzOffset);
  const DAY_MS = 24 * 60 * 60 * 1000;

  const rows: CalendarDoseRow[] = [];

  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    const dLocal = new Date(t + tzOffset);
    const diffDays = Math.floor(
      (dLocal.getTime() - protocolStartLocal.getTime()) / DAY_MS
    );
    const iso = dLocal.toISOString().slice(0, 10);

    for (const it of items) {
      const onWeeks = Number(it.cycle_on_weeks || 0);
      const offWeeks = Number(it.cycle_off_weeks || 0);
      const cycleLen = (onWeeks + offWeeks) * 7;
      if (cycleLen > 0 && diffDays % cycleLen >= onWeeks * 7) continue;

      const itemForSchedule = {
        ...it,
        protocol_start_date: protocolStartISO,
      };
      if (!isDoseDayUTC(dLocal, itemForSchedule)) continue;

      const key = `${iso}_${it.peptide_id}`;
      const existing = statusMap.get(key);
      rows.push({
        date_for: iso,
        peptide_id: Number(it.peptide_id),
        canonical_name: nameById.get(Number(it.peptide_id)) || '',
        dose_mg:
          existing?.dose_mg ?? Number(it.dose_mg_per_administration || 0),
        status: existing?.status ?? 'PENDING',
      });
    }
  }

  rows.sort(
    (a, b) =>
      a.date_for.localeCompare(b.date_for) ||
      a.canonical_name.localeCompare(b.canonical_name)
  );
  
  return rows;
}
