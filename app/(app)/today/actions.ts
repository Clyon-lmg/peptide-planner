// app/(app)/today/actions.ts
"use server";

import { cookies } from "next/headers";
import { createServerActionClient } from "@supabase/auth-helpers-nextjs";
import { unitsFromDose, forecastRemainingDoses, type Schedule } from "@/lib/forecast";
import { isDoseDayUTC } from "@/lib/scheduleEngine";

export type DoseStatus = "PENDING" | "TAKEN" | "SKIPPED";
export type { Schedule };

export type TodayDoseRow = {
  peptide_id: number;
  canonical_name: string;
  dose_mg: number | null;
  syringe_units: number | null; // U-100 (100 units = 1 mL)
  mg_per_vial: number | null;
  bac_ml: number | null;
  status: DoseStatus;
  remainingDoses?: number | null;
  reorderDateISO?: string | null;
};

// ---- tiny types to avoid SWC comma/semicolon parsing issue in generics
interface VialInv { vials: number; mg_per_vial: number; bac_ml: number }
interface CapsInv { bottles: number; caps_per_bottle: number; mg_per_cap: number }

// ---------- Queries ----------
export async function getTodayDosesWithUnits(dateISO: string): Promise<TodayDoseRow[]> {
  const sa = createServerActionClient({ cookies });
  const { data: auth } = await sa.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];

  // Active protocol
  const { data: protocol } = await sa
    .from("protocols")
    .select("id,start_date")
    .eq("user_id", uid)
    .eq("is_active", true)
    .maybeSingle();
  if (!protocol?.id) return [];

  // Protocol items
  const { data: items } = await sa
    .from("protocol_items")
    .select("peptide_id,dose_mg_per_administration,schedule,custom_days,cycle_on_weeks,cycle_off_weeks,every_n_days")
    .eq("protocol_id", protocol.id);
  if (!items?.length) return [];

  const DAY_MS = 24 * 60 * 60 * 1000;
  const d = new Date(dateISO + "T00:00:00Z");
  const protocolStartISO = protocol.start_date ?? dateISO;
  const protocolStart = new Date(protocolStartISO + "T00:00:00Z");
  const diffDays = Math.floor((d.getTime() - protocolStart.getTime()) / DAY_MS);

  const scheduledItems = items.filter((it: any) => {
    const onWeeks = Number(it.cycle_on_weeks || 0);
    const offWeeks = Number(it.cycle_off_weeks || 0);
    const cycleLen = (onWeeks + offWeeks) * 7;
    if (cycleLen > 0 && diffDays % cycleLen >= onWeeks * 7) return false;
    const itemForSchedule = { ...it, protocol_start_date: protocolStartISO };
    return isDoseDayUTC(d, itemForSchedule);
  });
  if (!scheduledItems.length) return [];

  const peptideIds = [...new Set(scheduledItems.map((i: any) => Number(i.peptide_id)))];

  // Peptide names, inventory (vials + caps), and today’s status
  const [{ data: peptideRows }, { data: invVials }, { data: invCaps }, { data: doseRows }] = await Promise.all([
    sa.from("peptides").select("id, canonical_name").in("id", peptideIds),
    sa.from("inventory_items").select("peptide_id, vials, mg_per_vial, bac_ml").eq("user_id", uid).in("peptide_id", peptideIds),
    sa.from("inventory_capsules").select("peptide_id, bottles, caps_per_bottle, mg_per_cap").eq("user_id", uid).in("peptide_id", peptideIds),
    sa.from("doses").select("peptide_id,status").eq("user_id", uid).eq("protocol_id", protocol.id).eq("date_for", dateISO).in("peptide_id", peptideIds),
  ]);

  const nameById = new Map<number, string>((peptideRows ?? []).map((p: any) => [Number(p.id), String(p.canonical_name)]));

  const vialByPeptide = new Map<number, VialInv>();
  (invVials ?? []).forEach((r: any) => {
    vialByPeptide.set(Number(r.peptide_id), {
      vials: Number(r.vials || 0),
      mg_per_vial: Number(r.mg_per_vial || 0),
      bac_ml: Number(r.bac_ml || 0),
    });
  });

  const capsByPeptide = new Map<number, CapsInv>();
  (invCaps ?? []).forEach((r: any) => {
    capsByPeptide.set(Number(r.peptide_id), {
      bottles: Number(r.bottles || 0),
      caps_per_bottle: Number(r.caps_per_bottle || 0),
      mg_per_cap: Number(r.mg_per_cap || 0),
    });
  });

  const statusByPeptide = new Map<number, DoseStatus>();
  (doseRows ?? []).forEach((d: any) => statusByPeptide.set(Number(d.peptide_id), d.status as DoseStatus));

  // Compose rows (Remaining/Reorder use TOTAL mg = vials + caps; Units need vial concentration)
  const rows: TodayDoseRow[] = scheduledItems.map((it: any) => {
    const pid = Number(it.peptide_id);
    const vialInv = vialByPeptide.get(pid);
    const capsInv = capsByPeptide.get(pid);

    const dose_mg = Number(it.dose_mg_per_administration || 0) || null;

    const totalMg =
      (Number(vialInv?.vials || 0) * Number(vialInv?.mg_per_vial || 0)) +
      (Number(capsInv?.bottles || 0) * Number(capsInv?.caps_per_bottle || 0) * Number(capsInv?.mg_per_cap || 0));

    let remainingDoses: number | null = null;
    let reorderDateISO: string | null = null;

    if (dose_mg && dose_mg > 0) {
      ({ remainingDoses, reorderDateISO } = forecastRemainingDoses(
        totalMg,
        dose_mg,
        String(it.schedule || "EVERYDAY") as Schedule,
        (it.custom_days as number[] | null) ?? null,
        Number(it.cycle_on_weeks || 0),
        Number(it.cycle_off_weeks || 0),
        (it.every_n_days as number | null) ?? null
      ));
  }

    return {
      peptide_id: pid,
      canonical_name: nameById.get(pid) || `Peptide #${pid}`,
      dose_mg,
      syringe_units: unitsFromDose(dose_mg, vialInv?.mg_per_vial ?? null, vialInv?.bac_ml ?? null),
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

// ---------- Mutations ----------
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
      .select("dose_mg_per_administration,every_n_days")
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

export async function logDose(peptide_id: number, dateISO: string) {
  await upsertDoseStatus(peptide_id, dateISO, "TAKEN");
}
export async function skipDose(peptide_id: number, dateISO: string) {
  await upsertDoseStatus(peptide_id, dateISO, "SKIPPED");
}
export async function resetDose(peptide_id: number, dateISO: string) {
  await upsertDoseStatus(peptide_id, dateISO, "PENDING");
}
