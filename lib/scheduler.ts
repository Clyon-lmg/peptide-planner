// lib/scheduler.ts

// Helper to determine if a given UTC date is a dose day for an item.
type GetDayFn = (d: Date) => number;
type ToDateFn = (s: string) => Date;

function makeIsDoseDay(getDayFn: GetDayFn, toDateFn: ToDateFn) {
  return function (d: Date, item: any) {
    const dow = getDayFn(d);
    if (item.schedule === 'EVERYDAY') return true;
    if (item.schedule === 'WEEKDAYS') return dow >= 1 && dow <= 5;
    if (item.schedule === 'CUSTOM') {
      const s = new Set(item.custom_days || []);
      return s.has(dow);
    }
    if (item.schedule === 'EVERY_N_DAYS') {
      const dateStr = item.protocol_start_date ?? item.start_date;
      const start = dateStr ? toDateFn(dateStr) : new Date();
      const diff = Math.floor((d.getTime() - start.getTime()) / 86400000);
      const n = Number(item.every_n_days || 0);
      return n > 0 && diff % n === 0;
    }
    return false;
  };
}

export const isDoseDayUTC = makeIsDoseDay(
  (d) => d.getUTCDay(),
  (s) => new Date(s + 'T00:00:00Z')
);

export type SchedulerItem = {
  peptide_id: number;
  canonical_name: string;
  dose_mg_per_administration: number;
  schedule: 'EVERYDAY' | 'WEEKDAYS' | 'CUSTOM' | 'EVERY_N_DAYS';
  custom_days?: number[] | null;
  cycle_on_weeks?: number | null;
  cycle_off_weeks?: number | null;
  every_n_days?: number | null;
  start_date?: string | null;
};

export type DoseRow = {
  date_for: string;
  peptide_id: number;
  canonical_name: string;
  dose_mg: number;
};

export function generateDoses(
  startIso: string,
  endIso: string,
  protocolStartIso: string,
  items: SchedulerItem[]
): DoseRow[] {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const end = new Date(endIso + 'T00:00:00Z');
  const protocolStart = new Date(protocolStartIso + 'T00:00:00Z');
  const rows: DoseRow[] = [];

  let diffDays = Math.floor(
    (new Date(startIso + 'T00:00:00Z').getTime() - protocolStart.getTime()) /
      DAY_MS
  );

  for (
    let d = new Date(startIso + 'T00:00:00Z');
    d <= end;
    d.setUTCDate(d.getUTCDate() + 1), diffDays++
  ) {
    const iso = d.toISOString().slice(0, 10);
    for (const it of items) {
      const onWeeks = Number(it.cycle_on_weeks || 0);
      const offWeeks = Number(it.cycle_off_weeks || 0);
      const cycleLen = (onWeeks + offWeeks) * 7;
      if (cycleLen > 0 && diffDays % cycleLen >= onWeeks * 7) continue;

      const itemForSchedule = { ...it, protocol_start_date: protocolStartIso };
      if (!isDoseDayUTC(d, itemForSchedule)) continue;

      rows.push({
        date_for: iso,
        peptide_id: Number(it.peptide_id),
        canonical_name: it.canonical_name,
        dose_mg: Number(it.dose_mg_per_administration || 0),
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