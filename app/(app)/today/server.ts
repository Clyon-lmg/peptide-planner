// app/(app)/today/server.ts
// Server actions & helpers for Today page
import { cookies } from "next/headers";
import { createServerActionClient } from "@supabase/auth-helpers-nextjs";

// ---------- Types ----------
export type DoseStatus = "PENDING" | "TAKEN" | "SKIPPED";
export type Schedule = "EVERYDAY" | "WEEKDAYS_5_2" | "CUSTOM";

export type TodayDoseRow = {
  peptide_id: number;
  canonical_name: string;
  dose_mg: number | null;
  syringe_units: number | null; // U-100 syringe units (100 units = 1 mL)
  mg_per_vial: number | null;
  bac_ml: number | null;
  status: DoseStatus;
  // New (Inventory parity)
  remainingDoses?: number | null;
  reorderDateISO?: string | null;
};

// ---------- Helpers ----------
function unitsFromDose(dose_mg?: number | null, mg_per_vial?: number | null, bac_ml?: number | null) {
  if (!dose_mg || !mg_per_vial || !bac_ml || mg_per_vial <= 0 || bac_ml <= 0) return null;
  // concentration mg/mL = mg_per_vial / bac_ml
  // mL required = dose_mg / (mg_per_vial / bac_ml) = dose_mg * (bac_ml / mg_per_vial)
  // syringe units (U-100) = mL * 100
  const mL = dose_mg * (Number(bac_ml) / Number(mg_per_vial));
  return Math.max(0, mL * 100);
}

/** Interpret YYYY-MM-DD as UTC midnight to avoid TZ drift and return UTC day (0=Sun..6=Sat). */
function dayOfWeekUTC(dateISO: string): number {
  const d = new Date(`${dateISO}T00:00:00Z`);
  return d.getUTCDay();
}

function isScheduledToday(
  schedule: Schedule,
  custom_days: number[] | null | undefined,
  dateISO: string
) {
  const dow = dayOfWeekUTC(dateISO); // 0..6 (Sun..Sat)
  if (schedule === "EVERYDAY") return true;
  if (schedule === "WEEKDAYS_5_2") return dow >= 1 && dow <= 5;
  if (schedule === "CUSTOM" && Array.isArray(custom_days)) {
    // Assumes custom_days contains 0..6 (Sun..Sat)
    return custom_days.includes(dow);
  }
  return false;
}

function baseFreqPerWeek(schedule: Schedule, custom_days?: number[] | null) {
  switch (schedule) {
    case "EVERYDAY":
      return 7;
    case "WEEKDAYS_5_2":
      return 5;
    case "CUSTOM":
      return Array.isArray(custom_days) ? custom_days.length : 0;
    default:
      return 0;
  }
}

/** Effective weekly frequency when cycles are used. */
function effectiveFreqPerWeek(base: number, onWeeks: number, offWeeks: number) {
  if (!onWeeks && !offWeeks) return base;
  const total = onWeeks + offWeeks;
  return total > 0 ? base * (onWeeks / total) : base;
}

function inOnCycle(onWeeks: number, offWeeks: number, dateISO: string, anchorISO: string) {
  if (!onWeeks && !offWeeks) return true; // no cycles = always "on"
  const msPerDay = 86400000;
  const start = new Date(anchorISO).getTime();
  const today = new Date(`${dateISO}T00:00:00Z`).getTime();
  const weeksSince = Math.floor((today - start) / (msPerDay * 7));
  const len = onWeeks + offWeeks;
  if (len <= 0) return true;
  const pos = ((weeksSince % len) + len) % len;
  return pos < onWeeks;
}

function fmtISO(d: Date) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Sum total mg available from vials + capsules. */
function computeTotalMg(invVial?: { vials?: number; mg_per_vial?: number }, invCaps?: { bottles?: number; caps_per_bottle?: number; mg_per_cap?: number }) {
  const vialMg = (Number(invVial?.vials || 0) * Number(invVial?.mg_per_vial || 0)) || 0;
  const capsMg =
    (Number(invCaps?.bottles || 0) * Number(invCaps?.caps_per_bottle || 0) * Number(invCaps?.mg_per_cap || 0)) || 0;
  return vialMg + capsMg;
}

function computeForecast(
  dose_mg: number,
  schedule: Schedule,
  custom_days: number[] | null | undefined,
  onWeeks: number,
  offWeeks: number,
  inventoryTotalsMg: number
) {
  if (!dose_mg || dose_mg <= 0) return { remainingDoses: null, reorderDateISO: null };
  const remainingDoses = Math.max(0, Math.floor(inventoryTotalsMg / dose_mg));

  const base = baseFreqPerWeek(schedule, custom_days);
  const eff = effectiveFreqPerWeek(base, onWeeks || 0, offWeeks || 0);
  if (eff <= 0) return { remainingDoses, reorderDateISO: null };

  const weeksUntilEmpty = Math.ceil(remainingDoses / eff);
  const days = weeksUntilEmpty * 7;
  const now = new Date(); // UTC enough for display
  const reorder = new Date(now.getTime() + days * 86400000);
  return { remainingDoses, reorderDateISO: fmtISO(reorder) };
}

// ---------- Core: getTodayDosesWithUnits ----------
export async function getTodayDosesWithUnits(dateISO: string): Promise<TodayDoseRow[]> {
  "use server";
  const sa = createServerActionClient({ cookies });
  const { data: auth } = await sa.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];

  // 1) Active protocol (anchor cycles on its created_at)
  const { data: protocol } = await sa
    .from("protocols")
    .select("id, created_at")
    .eq("user_id", uid)
    .eq("is_active", true)
    .maybeSingle();

  if (!protocol?.id) return [];

  // 2) Protocol items
  const { data: items, error: itemsErr } = await sa
    .from("protocol_items")
    .select("peptide_id, dose_mg_per_administration, schedule, custom_days, cycle_on_weeks, cycle_off_weeks")
    .eq("protocol_id", protocol.id);

  if (itemsErr || !items || items.length === 0) return [];

  // 3) Limit to those scheduled today (and in on-cycle)
  const scheduled = items.filter((it: any) => {
    const sched = String(it.schedule || "EVERYDAY") as Schedule;
    const custom: number[] | null = (it.custom_days as number[] | null) ?? null;
    if (!isScheduledToday(sched, custom, dateISO)) return false;
    return inOnCycle(Number(it.cycle_on_weeks || 0), Number(it.cycle_off_weeks || 0), dateISO, protocol.created_at!);
  });

  if (scheduled.length === 0) return [];

  const peptideIds = [...new Set(scheduled.map((i) => Number(i.peptide_id)))];

  // 4) Peptide names
  const { data: peptideRows } = await sa
    .from("peptides")
    .select("id, canonical_name")
    .in("id", peptideIds);

  const nameById = new Map<number, string>(
    (peptideRows || []).map((p) => [Number(p.id), String(p.canonical_name)])
  );

  // 5) Inventory (vials + capsules) for these peptides
  const [invVialsRes, invCapsRes] = await Promise.all([
    sa
      .from("inventory_items")
      .select("id, peptide_id, vials, mg_per_vial, bac_ml")
      .eq("user_id", uid)
      .in("peptide_id", peptideIds),
    sa
      .from("inventory_capsules")
      .select("id, peptide_id, bottles, caps_per_bottle, mg_per_cap")
      .eq("user_id", uid)
      .in("peptide_id", peptideIds),
  ]);

  const invVials = invVialsRes.data || [];
  const invCaps = invCapsRes.data || [];

  const vialByPeptide = new Map<number, { vials: number; mg_per_vial: number; bac_ml: number }>();
  invVials.forEach((r: any) =>
    vialByPeptide.set(Number(r.peptide_id), {
      vials: Number(r.vials || 0),
      mg_per_vial: Number(r.mg_per_vial || 0),
      bac_ml: Number(r.bac_ml || 0),
    })
  );

  const capsByPeptide = new Map<number, { bottles: number; caps_per_bottle: number; mg_per_cap: number }>();
  invCaps.forEach((r: any) =>
    capsByPeptide.set(Number(r.peptide_id), {
      bottles: Number(r.bottles || 0),
      caps_per_bottle: Number(r.caps_per_bottle || 0),
      mg_per_cap: Number(r.mg_per_cap || 0),
    })
  );

  // 6) Existing dose statuses for today
  const { data: doseRows } = await sa
    .from("doses")
    .select("peptide_id, status")
    .eq("user_id", uid)
    .eq("protocol_id", protocol.id)
    .eq("date_for", dateISO)
    .in("peptide_id", peptideIds);

  const statusByPeptide = new Map<number, DoseStatus>();
  (doseRows || []).forEach((d: any) => statusByPeptide.set(Number(d.peptide_id), d.status as DoseStatus));

  // 7) Compose rows
  const rows: TodayDoseRow[] = scheduled.map((it: any) => {
    const pid = Number(it.peptide_id);
    const name = nameById.get(pid) || `Peptide #${pid}`;

    const vialInv = vialByPeptide.get(pid);
    const capsInv = capsByPeptide.get(pid);

    const dose_mg = Number(it.dose_mg_per_administration || 0) || null;
    const mg_per_vial = vialInv?.mg_per_vial ?? null;
    const bac_ml = vialInv?.bac_ml ?? null;
    const syringe_units = unitsFromDose(dose_mg ?? null, mg_per_vial, bac_ml);

    const totalMg = computeTotalMg(vialInv, capsInv);
    const { remainingDoses, reorderDateISO } =
      dose_mg && dose_mg > 0
        ? computeForecast(
            dose_mg,
            String(it.schedule || "EVERYDAY") as Schedule,
            (it.custom_days as number[] | null) ?? null,
            Number(it.cycle_on_weeks || 0),
            Number(it.cycle_off_weeks || 0),
            totalMg
          )
        : { remainingDoses: null, reorderDateISO: null };

    return {
      peptide_id: pid,
      canonical_name: name,
      dose_mg,
      syringe_units,
      mg_per_vial,
      bac_ml,
      status: statusByPeptide.get(pid) || "PENDING",
      remainingDoses,
      reorderDateISO,
    };
  });

  rows.sort((a, b) => a.canonical_name.localeCompare(b.canonical_name));
  return rows;
}

// ---------- Mutations: log / skip / reset ----------
async function upsertDoseStatus(
  peptide_id: number,
  dateISO: string,
  status: DoseStatus
) {
  const sa = createServerActionClient({ cookies });
  const { data: auth } = await sa.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in");

  const { data: protocol } = await sa
    .from("protocols")
    .select("id")
    .eq("user_id", uid)
    .eq("is_active", true)
    .maybeSingle();

  if (!protocol?.id) throw new Error("No active protocol");

  // Lookup dose row for this day
  const { data: existing } = await sa
    .from("doses")
    .select("id")
    .eq("user_id", uid)
    .eq("protocol_id", protocol.id)
    .eq("peptide_id", peptide_id)
    .eq("date_for", dateISO)
    .maybeSingle();

  if (!existing?.id) {
    // Need dose_mg from protocol_items for insert
    const { data: pi } = await sa
      .from("protocol_items")
      .select("dose_mg_per_administration")
      .eq("protocol_id", protocol.id)
      .eq("peptide_id", peptide_id)
      .maybeSingle();

    const dose_mg = Number(pi?.dose_mg_per_administration || 0);

    const { error: insErr } = await sa.from("doses").insert({
      user_id: uid,
      protocol_id: protocol.id,
      peptide_id,
      date: dateISO, // storing as date for both fields
      date_for: dateISO,
      dose_mg,
      status,
    });
    if (insErr) throw insErr;
    return;
  }

  const { error: updErr } = await sa
    .from("doses")
    .update({ status })
    .eq("id", existing.id)
    .eq("user_id", uid)
    .eq("protocol_id", protocol.id);
  if (updErr) throw updErr;
}

export async function logDose(peptide_id: number, dateISO: string) {
  "use server";
  await upsertDoseStatus(peptide_id, dateISO, "TAKEN");
}

export async function skipDose(peptide_id: number, dateISO: string) {
  "use server";
  await upsertDoseStatus(peptide_id, dateISO, "SKIPPED");
}

export async function resetDose(peptide_id: number, dateISO: string) {
  "use server";
  await upsertDoseStatus(peptide_id, dateISO, "PENDING");
}
