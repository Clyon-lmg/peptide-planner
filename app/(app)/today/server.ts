// app/(app)/today/server.ts
import { cookies } from "next/headers";
import { createServerActionClient } from "@supabase/auth-helpers-nextjs";

export type DoseStatus = "PENDING" | "TAKEN" | "SKIPPED";
export type Schedule = "EVERYDAY" | "WEEKDAYS_5_2" | "CUSTOM";

export type TodayDoseRow = {
  peptide_id: number;
  canonical_name: string;
  dose_mg: number | null;
  syringe_units: number | null; // requires vial concentration
  mg_per_vial: number | null;
  bac_ml: number | null;
  status: DoseStatus;
  remainingDoses?: number | null;
  reorderDateISO?: string | null;
};

function fmtISO(d: Date) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function baseFreqPerWeek(schedule: Schedule, custom_days?: number[] | null) {
  switch (schedule) {
    case "EVERYDAY": return 7;
    case "WEEKDAYS_5_2": return 5;
    case "CUSTOM": return Array.isArray(custom_days) ? custom_days.length : 0;
    default: return 0;
  }
}

function effectiveFreqPerWeek(base: number, onWeeks: number, offWeeks: number) {
  if (!onWeeks && !offWeeks) return base;
  const total = onWeeks + offWeeks;
  return total > 0 ? base * (onWeeks / total) : base;
}

function unitsFromDose(dose_mg?: number | null, mg_per_vial?: number | null, bac_ml?: number | null) {
  if (!dose_mg || !mg_per_vial || !bac_ml || mg_per_vial <= 0 || bac_ml <= 0) return null;
  const mL = dose_mg * (Number(bac_ml) / Number(mg_per_vial)); // mg / (mg/mL)
  return Math.max(0, mL * 100); // U‑100 units
}

export async function getTodayDosesWithUnits(dateISO: string): Promise<TodayDoseRow[]> {
  "use server";
  const sa = createServerActionClient({ cookies });
  const { data: auth } = await sa.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];

  const { data: protocol } = await sa
    .from("protocols")
    .select("id")
    .eq("user_id", uid)
    .eq("is_active", true)
    .maybeSingle();
  if (!protocol?.id) return [];

  const { data: items } = await sa
    .from("protocol_items")
    .select("peptide_id,dose_mg_per_administration,schedule,custom_days,cycle_on_weeks,cycle_off_weeks")
    .eq("protocol_id", protocol.id);

  if (!items?.length) return [];

  const peptideIds = [...new Set(items.map(i => Number(i.peptide_id)))];

  const [{ data: peptideRows }, { data: invVials }, { data: invCaps }, { data: doseRows }] = await Promise.all([
    sa.from("peptides").select("id, canonical_name").in("id", peptideIds),
    sa.from("inventory_items").select("peptide_id, vials, mg_per_vial, bac_ml").eq("user_id", uid).in("peptide_id", peptideIds),
    sa.from("inventory_capsules").select("peptide_id, bottles, caps_per_bottle, mg_per_cap").eq("user_id", uid).in("peptide_id", peptideIds),
    sa.from("doses").select("peptide_id,status").eq("user_id", uid).eq("protocol_id", protocol.id).eq("date_for", dateISO).in("peptide_id", peptideIds),
  ]);

  const nameById = new Map<number, string>((peptideRows ?? []).map(p => [Number(p.id), String(p.canonical_name)]));

  const vialByPeptide = new Map<number, { vials: number; mg_per_vial: number; bac_ml: number }>();
  (invVials ?? []).forEach((r: any) => vialByPeptide.set(Number(r.peptide_id), {
    vials: Number(r.vials || 0),
    mg_per_vial: Number(r.mg_per_vial || 0),
    bac_ml: Number(r.bac_ml || 0),
  }));

  const capsByPeptide = new Map<number, { bottles: number; caps_per_bottle: number; mg_per_cap: number }>();
  (invCaps ?? []).forEach((r: any) => capsByPeptide.set(Number(r.peptide_id), {
    bottles: Number(r.bottles || 0),
    caps_per_bottle: Number(r.caps_per_bottle || 0),
    mg_per_cap: Number(r.mg_per_cap || 0),
  }));

  const statusByPeptide = new Map<number, DoseStatus>();
  (doseRows ?? []).forEach((d: any) => statusByPeptide.set(Number(d.peptide_id), d.status as DoseStatus));

  const rows: TodayDoseRow[] = items.map((it: any) => {
    const pid = Number(it.peptide_id);
    const vialInv = vialByPeptide.get(pid);
    const capsInv = capsByPeptide.get(pid);

    const dose_mg = Number(it.dose_mg_per_administration || 0) || null;
    // total mg available = vials + capsules
    const totalMg =
      (Number(vialInv?.vials || 0) * Number(vialInv?.mg_per_vial || 0)) +
      (Number(capsInv?.bottles || 0) * Number(capsInv?.caps_per_bottle || 0) * Number(capsInv?.mg_per_cap || 0));

    // Forecast: only needs dose_mg and totalMg
    let remainingDoses: number | null = null;
    let reorderDateISO: string | null = null;
    if (dose_mg && dose_mg > 0) {
      remainingDoses = Math.max(0, Math.floor(totalMg / dose_mg));
      const base = baseFreqPerWeek(String(it.schedule || "EVERYDAY") as Schedule, (it.custom_days as number[] | null) ?? null);
      const eff = effectiveFreqPerWeek(base, Number(it.cycle_on_weeks || 0), Number(it.cycle_off_weeks || 0));
      if (eff > 0) {
        const weeksUntilEmpty = Math.ceil((remainingDoses || 0) / eff);
        const days = weeksUntilEmpty * 7;
        const reorder = new Date(Date.now() + days * 86400000);
        reorderDateISO = fmtISO(reorder);
      }
    }

    return {
      peptide_id: pid,
      canonical_name: nameById.get(pid) || `Peptide #${pid}`,
      dose_mg,
      syringe_units: unitsFromDose(dose_mg, vialInv?.mg_per_vial, vialInv?.bac_ml), // may be null, that’s fine
      mg_per_vial: vialInv?.mg_per_vial ?? null,
      bac_ml: vialInv?.bac_ml ?? null,
      status: statusByPeptide.get(pid) || "PENDING",
      remainingDoses,
      reorderDateISO,
    };
  });

  rows.sort((a, b) => a.canonical_name.localeCompare(b.canonical_name));
  return rows;
}

async function upsertDoseStatus(peptide_id: number, dateISO: string, status: DoseStatus) {
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

  const { data: existing } = await sa
    .from("doses")
    .select("id")
    .eq("user_id", uid)
    .eq("protocol_id", protocol.id)
    .eq("peptide_id", peptide_id)
    .eq("date_for", dateISO)
    .maybeSingle();

  if (!existing?.id) {
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
      date: dateISO,
      date_for: dateISO,
      dose_mg,
      status,
    });
    if (insErr) throw insErr;
  } else {
    const { error: updErr } = await sa
      .from("doses")
      .update({ status })
      .eq("id", existing.id)
      .eq("user_id", uid)
      .eq("protocol_id", protocol.id);
    if (updErr) throw updErr;
  }
}

export async function logDose(peptide_id: number, dateISO: string) { "use server"; await upsertDoseStatus(peptide_id, dateISO, "TAKEN"); }
export async function skipDose(peptide_id: number, dateISO: string) { "use server"; await upsertDoseStatus(peptide_id, dateISO, "SKIPPED"); }
export async function resetDose(peptide_id: number, dateISO: string) { "use server"; await upsertDoseStatus(peptide_id, dateISO, "PENDING"); }
