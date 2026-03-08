export type DoseStatus = 'PENDING' | 'TAKEN' | 'SKIPPED';

export type TodayDoseRow = {
  peptide_id: number;
  canonical_name: string;
  dose_mg: number;
  syringe_units: number | null;
  mg_per_vial: number | null;
  bac_ml: number | null;
  status: DoseStatus;
  remainingDoses?: number | null;
  reorderDateISO?: string | null;
  time_of_day: string | null;
  site_label: string | null;
};

export type NotifPrefs = {
  enabled: boolean;
  defaultTime: string; // "HH:MM"
  advanceMinutes: number; // 0 | 15 | 30 | 60
};

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  enabled: true,
  defaultTime: '08:00',
  advanceMinutes: 0,
};
