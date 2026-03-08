// lib/forecast.ts — copied from web app (pure TypeScript, no dependencies)

export type Schedule = 'EVERYDAY' | 'WEEKDAYS' | 'CUSTOM' | 'EVERY_N_DAYS';

function toISODate(d: Date) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function baseFreqPerWeek(
  schedule: Schedule,
  customDays?: number[] | null,
  every_n_days?: number | null
) {
  switch (schedule) {
    case 'EVERYDAY': return 7;
    case 'WEEKDAYS': return 5;
    case 'EVERY_N_DAYS': return every_n_days ? 7 / every_n_days : 0;
    case 'CUSTOM': return Array.isArray(customDays) ? customDays.length : 0;
    default: return 0;
  }
}

export function effectiveFreqPerWeek(base: number, onWeeks: number, offWeeks: number) {
  if (!onWeeks && !offWeeks) return base;
  const total = onWeeks + offWeeks;
  return total > 0 ? base * (onWeeks / total) : base;
}

export function unitsFromDose(
  dose_mg?: number | null,
  mg_per_vial?: number | null,
  bac_ml?: number | null
) {
  if (!dose_mg || !mg_per_vial || !bac_ml || mg_per_vial <= 0 || bac_ml <= 0) return null;
  const mL = dose_mg * (Number(bac_ml) / Number(mg_per_vial));
  return Math.max(0, mL * 100);
}

export function forecastRemainingDoses(
  totalMg: number,
  doseMg: number,
  schedule: Schedule,
  customDays: number[] | null,
  cycleOnWeeks: number,
  cycleOffWeeks: number,
  every_n_days: number | null = null
) {
  if (doseMg <= 0) return { remainingDoses: null, reorderDateISO: null };

  const remainingDoses = Math.max(0, Math.floor(totalMg / doseMg));
  const base = baseFreqPerWeek(schedule, customDays, every_n_days);
  const eff = effectiveFreqPerWeek(base, cycleOnWeeks, cycleOffWeeks);
  if (eff <= 0) return { remainingDoses, reorderDateISO: null };

  const weeksUntilEmpty = Math.ceil(remainingDoses / eff);
  const days = weeksUntilEmpty * 7;
  const reorder = new Date();
  reorder.setUTCDate(reorder.getUTCDate() + days);
  return { remainingDoses, reorderDateISO: toISODate(reorder) };
}
