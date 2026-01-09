'use server';

import { createServerActionSupabase } from '@/lib/supabaseServer';
import { isDoseDayUTC, type ScheduleItem } from '@/lib/scheduleEngine';
import type { DoseStatus } from '../today/actions';
import { revalidatePath } from 'next/cache';

export type CalendarDoseRow = {
  date_for: string;
  peptide_id: number;
  canonical_name: string;
  dose_mg: number;
  status: DoseStatus;
  time_of_day: string | null;
  site_label: string | null;
};

export async function getDosesForRange(startIso: string, endIso: string): Promise<CalendarDoseRow[]> {
  const supabase = createServerActionSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // 1. Fetch protocols that OVERLAP with the range
  const { data: protocols } = await supabase
    .from('protocols')
    .select('id, start_date, end_date')
    .eq('user_id', user.id);
    // Note: We'll filter range in JS to keep it simple

  const relevantProtocols = (protocols || []).filter((p: any) => {
      const pStart = p.start_date;
      const pEnd = p.end_date || '9999-12-31';
      // Overlap logic: (StartA <= EndB) and (EndA >= StartB)
      return pStart <= endIso && pEnd >= startIso;
  });

  if (relevantProtocols.length === 0) return [];

  const protocolIds = relevantProtocols.map((p: any) => p.id);

  // 2. Fetch items
  const { data: items } = await supabase
    .from('protocol_items')
    .select(
        'protocol_id, peptide_id,dose_mg_per_administration,schedule,custom_days,cycle_on_weeks,cycle_off_weeks,every_n_days,time_of_day'
    )
    .in('protocol_id', protocolIds);

  const peptideIds = Array.from(new Set((items || []).map((i: any) => Number(i.peptide_id))));

  // 3. Fetch Data
  const [{ data: peptideRows }, { data: doseRows }] = await Promise.all([
    supabase.from('peptides').select('id, canonical_name').in('id', peptideIds),
    supabase.from('doses').select('date_for, peptide_id, dose_mg, status, site_label')
      .eq('user_id', user.id)
      .gte('date_for', startIso)
      .lte('date_for', endIso),
  ]);

  const nameById = new Map<number, string>((peptideRows ?? []).map((p: any) => [Number(p.id), String(p.canonical_name)]));
  const statusMap = new Map<string, any>();
  (doseRows ?? []).forEach((r: any) => statusMap.set(`${r.date_for}_${r.peptide_id}`, r));

  const rows: CalendarDoseRow[] = [];
  const start = new Date(startIso + 'T00:00:00Z');
  const end = new Date(endIso + 'T00:00:00Z');

  // 4. Generate Schedule
  for (const p of relevantProtocols) {
      const protoItems = items?.filter((i: any) => i.protocol_id === p.id) || [];
      const pStart = new Date(p.start_date + 'T00:00:00Z');

      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
          const iso = d.toISOString().slice(0, 10);
          
          // Check if date is within protocol valid range
          if (iso < p.start_date) continue;
          if (p.end_date && iso > p.end_date) continue;

          for (const it of protoItems) {
              const itemForSchedule = { ...it, protocol_start_date: p.start_date };
              if (!isDoseDayUTC(d, itemForSchedule)) continue;

              const key = `${iso}_${it.peptide_id}`;
              const existing = statusMap.get(key);
              
              rows.push({
                  date_for: iso,
                  peptide_id: Number(it.peptide_id),
                  canonical_name: nameById.get(Number(it.peptide_id)) || '',
                  dose_mg: existing?.dose_mg ?? Number(it.dose_mg_per_administration || 0),
                  status: (existing?.status ?? 'PENDING') as DoseStatus,
                  time_of_day: it.time_of_day ?? null,
                  site_label: existing?.site_label ?? null,
              });
          }
      }
  }

  // 5. Ad-Hoc injection
  const generatedKeys = new Set(rows.map(r => `${r.date_for}_${r.peptide_id}`));
  (doseRows ?? []).forEach((r: any) => {
      const key = `${r.date_for}_${r.peptide_id}`;
      if (!generatedKeys.has(key)) {
          rows.push({
              date_for: r.date_for,
              peptide_id: Number(r.peptide_id),
              canonical_name: nameById.get(Number(r.peptide_id)) || '',
              dose_mg: Number(r.dose_mg || 0),
              status: (r.status ?? 'PENDING') as DoseStatus,
              time_of_day: null,
              site_label: r.site_label,
          });
      }
  });

  return rows.sort((a, b) => a.date_for.localeCompare(b.date_for));
}
