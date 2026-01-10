'use server';

import { createServerActionSupabase } from '@/lib/supabaseServer';
import { unitsFromDose, forecastRemainingDoses } from '@/lib/forecast';
import {
    generateDailyDoses,
    type ProtocolItem,
    type Schedule,
} from '@/lib/scheduleEngine';
import { revalidatePath } from 'next/cache';

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

// Data shapes for inventory lookups
interface VialInv {
    vials: number;
    mg_per_vial: number;
    bac_ml: number;
    current_used_mg: number;
}
interface CapsInv {
    bottles: number;
    caps_per_bottle: number;
    mg_per_cap: number;
    current_used_mg: number;
}

// ---------- Queries ----------

export async function getTodayDosesWithUnits(dateISO: string): Promise<TodayDoseRow[]> {
    const sa = createServerActionSupabase();
    const { data: auth, error: authError } = await sa.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
        console.error('getTodayDosesWithUnits: auth.getUser() returned null', authError);
        throw new Error('Session missing or expired');
    }

    // Active protocol (Single Protocol Logic)
    const { data: protocol } = await sa
        .from('protocols')
        .select('id,start_date')
        .eq('user_id', uid)
        .eq('is_active', true)
        .maybeSingle();
    
    if (!protocol?.id) return [];

    // Protocol items joined with peptide names
    const { data: items } = await sa
        .from('protocol_items')
        .select(
            'peptide_id,dose_mg_per_administration,schedule,custom_days,cycle_on_weeks,cycle_off_weeks,every_n_days,titration_interval_days,titration_amount_mg,time_of_day,peptides(canonical_name)'
        )
        .eq('protocol_id', protocol.id);
    
    if (!items?.length) return [];

    const protocolItems: ProtocolItem[] = items.map((it: any) => ({
        peptide_id: Number(it.peptide_id),
        canonical_name: it.peptides?.canonical_name || `Peptide #${it.peptide_id}`,
        dose_mg_per_administration: Number(it.dose_mg_per_administration || 0),
        schedule: it.schedule as Schedule,
        custom_days: (it.custom_days as number[] | null) ?? null,
        cycle_on_weeks: Number(it.cycle_on_weeks || 0),
        cycle_off_weeks: Number(it.cycle_off_weeks || 0),
        every_n_days: (it.every_n_days as number | null) ?? null,
        time_of_day: (it.time_of_day as string | null) ?? null,
    }));

    const dayRows = generateDailyDoses(
        dateISO,
        protocol.start_date ?? dateISO,
        protocolItems
    );
    
    if (!dayRows.length) return [];

    const peptideIds = dayRows.map((r) => Number(r.peptide_id));

    // Inventory (vials + caps) and today’s status
    const [{ data: invVials }, { data: invCaps }, { data: doseRows }] = await Promise.all([
        sa
            .from('inventory_items')
            .select('peptide_id, vials, mg_per_vial, bac_ml, current_used_mg')
            .eq('user_id', uid)
            .in('peptide_id', peptideIds),
        sa
            .from('inventory_capsules')
            .select('peptide_id, bottles, caps_per_bottle, mg_per_cap, current_used_mg')
            .eq('user_id', uid)
            .in('peptide_id', peptideIds),
        sa
            .from('doses')
            .select('peptide_id,status,site_label')
            .eq('user_id', uid)
            // 🟢 STATUS FIX: Removed .eq('protocol_id', protocol.id) to match status.ts
            .eq('date_for', dateISO)
            .in('peptide_id', peptideIds),
    ]);

    const vialByPeptide = new Map<number, VialInv>();
    (invVials ?? []).forEach((r: any) => {
        vialByPeptide.set(Number(r.peptide_id), {
            vials: Number(r.vials || 0),
            mg_per_vial: Number(r.mg_per_vial || 0),
            bac_ml: Number(r.bac_ml || 0),
            current_used_mg: Number(r.current_used_mg || 0),
        });
    });

    const capsByPeptide = new Map<number, CapsInv>();
    (invCaps ?? []).forEach((r: any) => {
        capsByPeptide.set(Number(r.peptide_id), {
            bottles: Number(r.bottles || 0),
            caps_per_bottle: Number(r.caps_per_bottle || 0),
            mg_per_cap: Number(r.mg_per_cap || 0),
            current_used_mg: Number(r.current_used_mg || 0),
        });
    });

    const doseInfoByPeptide = new Map<number, { status: DoseStatus; site_label: string | null }>();
    (doseRows ?? []).forEach((d: any) =>
        doseInfoByPeptide.set(Number(d.peptide_id), {
            status: d.status as DoseStatus,
            site_label: d.site_label ?? null,
        })
    );

    const itemById = new Map<number, ProtocolItem>(
        protocolItems.map((it) => [it.peptide_id, it])
    );

    const rows: TodayDoseRow[] = dayRows.map((dr) => {
        const pid = Number(dr.peptide_id);
        const vialInv = vialByPeptide.get(pid);
        const capsInv = capsByPeptide.get(pid);
        const item = itemById.get(pid);

        const vialTotal = (Number(vialInv?.vials || 0) * Number(vialInv?.mg_per_vial || 0)) - Number(vialInv?.current_used_mg || 0);
        const capTotal = (Number(capsInv?.bottles || 0) * Number(capsInv?.caps_per_bottle || 0) * Number(capsInv?.mg_per_cap || 0)) - Number(capsInv?.current_used_mg || 0);

        const totalMg = Math.max(0, vialTotal + capTotal);

        let remainingDoses: number | null = null;
        let reorderDateISO: string | null = null;
        
        // 🟢 TS FIX: Explicit casting for forecastRemainingDoses
        if (dr.dose_mg && dr.dose_mg > 0) {
            ({ remainingDoses, reorderDateISO } = forecastRemainingDoses(
                totalMg,
                dr.dose_mg,
                (item?.schedule ?? 'EVERYDAY') as Schedule,
                item?.custom_days ?? null,
                Number(item?.cycle_on_weeks || 0),
                Number(item?.cycle_off_weeks || 0),
                item?.every_n_days ?? null
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
            status: doseInfoByPeptide.get(pid)?.status || 'PENDING',
            site_label: doseInfoByPeptide.get(pid)?.site_label || null,
            remainingDoses,
            reorderDateISO,
            time_of_day: dr.time_of_day,
        };
    });

    rows.sort((a, b) => {
        const ta = a.time_of_day ?? '99:99';
        const tb = b.time_of_day ?? '99:99';
        if (ta === tb) {
            return a.canonical_name.localeCompare(b.canonical_name);
        }
        return ta < tb ? -1 : 1;
    });
    return rows;
}

// ---------- Mutations ----------

async function updateInventoryUsage(
    supabase: any,
    uid: string,
    peptideId: number,
    deltaMg: number
) {
    // 1. Try Vials first
    const { data: vialItem } = await supabase
        .from("inventory_items")
        .select("id, vials, mg_per_vial, current_used_mg")
        .eq("user_id", uid)
        .eq("peptide_id", peptideId)
        .maybeSingle();

    if (vialItem) {
        let newUsed = Number(vialItem.current_used_mg || 0) + deltaMg;
        let newVials = Number(vialItem.vials || 0);
        const size = Number(vialItem.mg_per_vial || 0);

        if (size > 0) {
            while (newUsed >= size && newVials > 0) {
                newUsed -= size;
                newVials--;
            }
            while (newUsed < 0) {
                newUsed += size;
                newVials++;
            }
        }

        await supabase
            .from("inventory_items")
            .update({ vials: newVials, current_used_mg: Math.max(0, newUsed) })
            .eq("id", vialItem.id);
        return;
    }

    // 2. Try Capsules
    const { data: capItem } = await supabase
        .from("inventory_capsules")
        .select("id, bottles, mg_per_cap, caps_per_bottle, current_used_mg")
        .eq("user_id", uid)
        .eq("peptide_id", peptideId)
        .maybeSingle();

    if (capItem) {
        let newUsed = Number(capItem.current_used_mg || 0) + deltaMg;
        let newBottles = Number(capItem.bottles || 0);
        const bottleTotalMg = Number(capItem.caps_per_bottle || 0) * Number(capItem.mg_per_cap || 0);

        if (bottleTotalMg > 0) {
            while (newUsed >= bottleTotalMg && newBottles > 0) {
                newUsed -= bottleTotalMg;
                newBottles--;
            }
            while (newUsed < 0) {
                newUsed += bottleTotalMg;
                newBottles++;
            }
        }

        await supabase
            .from("inventory_capsules")
            .update({ bottles: newBottles, current_used_mg: Math.max(0, newUsed) })
            .eq("id", capItem.id);
    }
}

async function upsertDoseStatus(peptide_id: number, dateISO: string, targetStatus: DoseStatus) {
    const sa = createServerActionSupabase();
    const { data: { user } } = await sa.auth.getUser();
    const uid = user?.id;
    if (!uid) throw new Error('Not signed in');

    // 1. Get Protocol
    const { data: protocol } = await sa
        .from('protocols')
        .select('id')
        .eq('user_id', uid)
        .eq('is_active', true)
        .maybeSingle();
    
    if (!protocol?.id) throw new Error('No active protocol');

    // 2. Check existing record
    // 🟢 STATUS FIX: Removed .eq('protocol_id', protocol.id) to match status.ts
    const { data: existing } = await sa
        .from('doses')
        .select('id, status, dose_mg')
        .eq('user_id', uid)
        .eq('peptide_id', peptide_id)
        .eq('date_for', dateISO)
        .maybeSingle();

    const currentStatus = existing?.status || 'PENDING';
    if (currentStatus === targetStatus) return;

    // 3. Determine Dose Amount
    let doseAmount = existing?.dose_mg ? Number(existing.dose_mg) : 0;

    if (!doseAmount) {
        const { data: pi } = await sa
            .from('protocol_items')
            .select('dose_mg_per_administration')
            .eq('protocol_id', protocol.id)
            .eq('peptide_id', peptide_id)
            .maybeSingle();
        doseAmount = Number(pi?.dose_mg_per_administration || 0);
    }

    // 4. Update Inventory
    if (targetStatus === 'TAKEN' && currentStatus !== 'TAKEN') {
        await updateInventoryUsage(sa, uid, peptide_id, doseAmount);
    }
    else if (currentStatus === 'TAKEN' && targetStatus !== 'TAKEN') {
        await updateInventoryUsage(sa, uid, peptide_id, -doseAmount);
    }

    // 5. Commit Dose Status
    if (!existing?.id) {
        const { error: insErr } = await sa.from('doses').insert({
            user_id: uid,
            protocol_id: protocol.id,
            peptide_id,
            date: dateISO,
            date_for: dateISO,
            dose_mg: doseAmount,
            status: targetStatus,
            site_label: null,
        });
        if (insErr) throw insErr;
    } else {
        const { error: updErr } = await sa
            .from('doses')
            .update({ status: targetStatus })
            .eq('id', existing.id);
        if (updErr) throw updErr;
    }

    revalidatePath('/today');
}

export async function logDose(peptide_id: number, dateISO: string) { 'use server'; await upsertDoseStatus(peptide_id, dateISO, 'TAKEN'); }
export async function skipDose(peptide_id: number, dateISO: string) { 'use server'; await upsertDoseStatus(peptide_id, dateISO, 'SKIPPED'); }
export async function resetDose(peptide_id: number, dateISO: string) { 'use server'; await upsertDoseStatus(peptide_id, dateISO, 'PENDING'); }
