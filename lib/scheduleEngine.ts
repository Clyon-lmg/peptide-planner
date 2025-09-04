// lib/scheduleEngine.ts

export type Schedule = 'EVERYDAY' | 'WEEKDAYS' | 'CUSTOM' | 'EVERY_N_DAYS';

export interface ProtocolItem {
  peptide_id: number;
  canonical_name: string;
  dose_mg_per_administration: number;
  schedule: Schedule;
  custom_days?: number[] | null;
  cycle_on_weeks?: number | null;
  cycle_off_weeks?: number | null;
  every_n_days?: number | null;
  time_of_day?: string | null;
}

export type ScheduleItem = {
  schedule: Schedule;
  custom_days?: number[] | null;
  every_n_days?: number | null;
  cycle_on_weeks?: number | null;
  cycle_off_weeks?: number | null;
};
/**
 * Determine if a given UTC date is a dose day for an item.
 * @param date Date being checked (assumed UTC midnight or any time)
 * @param item Schedule definition with optional protocol/start dates
 */
export function isDoseDayUTC(
  date: Date,
  item: ScheduleItem & { protocol_start_date?: string; start_date?: string }
): boolean {
  const protocolStartISO = item.protocol_start_date || item.start_date;
  const protocolStart = protocolStartISO
    ? new Date(`${protocolStartISO}T00:00:00Z`)
    : date;
  const diffDays = Math.floor(
    (date.getTime() - protocolStart.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (diffDays < 0) return false;

  const onWeeks = Number(item.cycle_on_weeks || 0);
  const offWeeks = Number(item.cycle_off_weeks || 0);
  const cycleLen = (onWeeks + offWeeks) * 7;
  if (cycleLen > 0 && diffDays % cycleLen >= onWeeks * 7) return false;
    const dow = date.getUTCDay();

  switch (item.schedule) {
    case 'EVERYDAY':
      return true;
    case 'WEEKDAYS':
      return dow >= 1 && dow <= 5;
    case 'CUSTOM':
      return (item.custom_days || []).includes(dow);
    case 'EVERY_N_DAYS': {
      const n = Number(item.every_n_days || 0);
      return n > 0 && diffDays % n === 0;
    }
    default:
      return false;
  }
}

export type DailyDoseRow = {
  peptide_id: number;
  canonical_name: string;
  dose_mg: number;
  time_of_day: string | null;
};

/**
 * Generate expected doses for a single date.
 */
export function generateDailyDoses(
  dateISO: string,
  protocolStartISO: string,
  items: ProtocolItem[]
): DailyDoseRow[] {
  const date = new Date(`${dateISO}T00:00:00Z`);

  return items
    .filter((it) =>
      isDoseDayUTC(date, { ...it, protocol_start_date: protocolStartISO })
    )
    .map((it) => ({
      peptide_id: Number(it.peptide_id),
      canonical_name: it.canonical_name,
      dose_mg: Number(it.dose_mg_per_administration || 0),
      time_of_day: it.time_of_day ?? null,
    }));
}