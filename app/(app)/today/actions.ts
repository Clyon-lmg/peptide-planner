'use server';

import { cookies } from 'next/headers';
import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { unitsFromDose, forecastRemainingDoses, type Schedule } from '@/lib/forecast';
import { generateDailyDoses } from '@/lib/scheduler';

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
    .from('protocols')
    .select('id,start_date')
    .eq('user_id', uid)
    .eq('is_active', true)
    .maybeSingle();
  if (!protocol?.id) return [];

  // Protocol items joined with peptide names
  const { data: rawItems } = await sa
    .from('protocol_items')
    .select(
      'peptide_id,dose_mg_per_administration,schedule,custom_days,cycle_on_weeks,cycle_off_weeks,every_n_days,peptides(canonical_name)'
    )
    .eq('protocol_id', protocol.id);
  if (!rawItems?.length) return [];

  const items = rawItems.map((r: any) => ({
    peptide_id: Number(r.peptide_id),
    canonical_name: r.peptides?.canonical_name || `Peptide #${r.peptide_id}`,
    dose_mg_per_administration: Number(r.dose_mg_per_administration || 0),
    schedule: String(r.schedule || 'EVERYDAY'),
    custom_days: (r.custom_days as number[] | null) ?? null,
    cycle_on_weeks: Number(r.cycle_on_weeks || 0),
    cycle_off_weeks: Number(r.cycle_off_weeks || 0),
    every_n_days: (r.every_n_days as number | null) ?? null,
  }));

  const dayRows = generateDailyDoses(
    dateISO,
    protocol.start_date ?? dateISO,
    items
  );
  if (!dayRows.length) return [];

  const peptideIds = dayRows.map((r) => Number(r.peptide_id));

  // Inventory (vials + caps) and today’s status
  const [{ data: invVials }, { data: invCaps }, { data: doseRows }] = await Promise.all([
    sa
      .from('inventory_items')
      .select('peptide_id, vials, mg_per_vial, bac_ml')
      .eq('user_id', uid)
      .in('peptide_id', peptideIds),
    sa
      .from('inventory_capsules')
      .select('peptide_id, bottles, caps_per_bottle, mg_per_cap')
      .eq('user_id', uid)
      .in('peptide_id', peptideIds),
    sa
      .from('doses')
      .select('peptide_id,status')
      .eq('user_id', uid)
      .eq('protocol_id', protocol.id)
      .eq('date_for', dateISO)
      .in('peptide_id', peptideIds),
  ]);

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
  (doseRows ?? []).forEach((d: any) =>
    statusByPeptide.set(Number(d.peptide_id), d.status as DoseStatus)
  );

  const itemById = new Map<number, any>(items.map((it) => [it.peptide_id, it]));

  const rows: TodayDoseRow[] = dayRows.map((dr) => {
    const pid = Number(dr.peptide_id);
    const vialInv = vialByPeptide.get(pid);
    const capsInv = capsByPeptide.get(pid);
    const item = itemById.get(pid);

    const totalMg =
      Number(vialInv?.vials || 0) * Number(vialInv?.mg_per_vial || 0) +
      Number(capsInv?.bottles || 0) *
        Number(capsInv?.caps_per_bottle || 0) *
        Number(capsInv?.mg_per_cap || 0);

    let remainingDoses: number | null = null;
    let reorderDateISO: string | null = null;
    if (dr.dose_mg && dr.dose_mg > 0) {
      ({ remainingDoses, reorderDateISO } = forecastRemainingDoses(
        totalMg,
        dr.dose_mg,
        String(item?.schedule || 'EVERYDAY') as Schedule,
        (item?.custom_days as number[] | null) ?? null,
        Number(item?.cycle_on_weeks || 0),
        Number(item?.cycle_off_weeks || 0),
        (item?.every_n_days as number | null) ?? null
      ));
    }

    return {
      peptide_id: pid,
      canonical_name: dr.canonical_name,
      dose_mg: dr.dose_mg,
      syringe_units: unitsFromDose(
        dr.dose_mg,
        vialInv?.mg_per_vial ?? null,
        vialInv?.bac_ml ?? null
      ),
      mg_per_vial: vialInv?.mg_per_vial ?? null,
      bac_ml: vialInv?.bac_ml ?? null,
      status: statusByPeptide.get(pid) || 'PENDING',
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
  if (!uid) throw new Error('Not signed in');

  const { data: protocol } = await sa
    .from('protocols')
    .select('id')
    .eq('user_id', uid)
    .eq('is_active', true)
    .maybeSingle();
  if (!protocol?.id) throw new Error('No active protocol');

  const { data: existing } = await sa
    .from('doses')
    .select('id')
    .eq('user_id', uid)
    .eq('protocol_id', protocol.id)
    .eq('peptide_id', peptide_id)
    .eq('date_for', dateISO)
    .maybeSingle();

  if (!existing?.id) {
    const { data: pi } = await sa
      .from('protocol_items')
      .select('dose_mg_per_administration,every_n_days')
      .eq('protocol_id', protocol.id)
      .eq('peptide_id', peptide_id)
      .maybeSingle();
    const dose_mg = Number(pi?.dose_mg_per_administration || 0);

    const { error: insErr } = await sa.from('doses').insert({
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
      .from('doses')
      .update({ status })
      .eq('id', existing.id)
      .eq('user_id', uid)
      .eq('protocol_id', protocol.id);
    if (updErr) throw updErr;
  }
}

export async function logDose(peptide_id: number, dateISO: string) {
  'use server';
  await upsertDoseStatus(peptide_id, dateISO, 'TAKEN');
}

export async function skipDose(peptide_id: number, dateISO: string) {
  'use server';
  await upsertDoseStatus(peptide_id, dateISO, 'SKIPPED');
}

export async function resetDose(peptide_id: number, dateISO: string) {
  'use server';
  await upsertDoseStatus(peptide_id, dateISO, 'PENDING');
}
