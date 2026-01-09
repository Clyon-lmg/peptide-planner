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

// Data shapes
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

export async function getTodayDosesWithUnits(dateISO: string): Promise<TodayDoseRow[]> {
    const sa = createServerActionSupabase();
    const { data: auth, error: authError } = await sa.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
        console.error('getTodayDosesWithUnits: auth.getUser() returned null', authError);
        throw new Error('Session missing or expired');
    }

    // 1. Fetch ALL protocols (we now filter by date, ignoring is_active flag)
    const { data: allProtocols } = await sa
        .from('protocols')
        .select('id,start_date,end_date')
        .eq('user_id', uid);
    
    if (!allProtocols?.length) return [];

    // 2. Filter for protocols active ON THIS DATE
    const activeProtocols = allProtocols.filter(p => {
        if (!p.start_date) return false;
        if (p.start_date > dateISO) return false; // Starts in future
        if (p.end_date && p.end_date < dateISO) return false; // Ends in past
        return true;
    });

    if (activeProtocols.length === 0) return [];

    const activeIds = activeProtocols.map(p => p.id);

    // 3. Fetch Items for ALL active protocols
    const { data: items } = await sa
        .from('protocol_items')
        .select(
            'protocol_id,peptide_id,dose_mg_per_administration,schedule,custom_days,cycle_on_weeks,cycle_off_weeks,every_n_days,titration_interval_days,titration_amount_mg,time_of_day,peptides(canonical_name)'
        )
        .in('protocol_id', activeIds);
    
    if (!items?.length) return [];

    // 4. Generate Daily Doses (Need to handle per-protocol start dates)
    let allDailyRows: any[] = [];

    // Group items by protocol to pass correct start_date
    const itemsByProto = new Map<number, any[]>();
    items.forEach((it: any) => {
        if (!itemsByProto.has(it.protocol_id)) itemsByProto.set(it.protocol_id, []);
        itemsByProto.get(it.protocol_id)?.push(it);
    });

    activeProtocols.forEach(p => {
        const protoItems = itemsByProto.get(p.id);
        if (!protoItems) return;

        const cleanItems: ProtocolItem[] = protoItems.map((it: any) => ({
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

        const rows = generateDailyDoses(dateISO, p.start_date, cleanItems);
        allDailyRows = [...allDailyRows, ...rows];
    });

    if (allDailyRows.length === 0) return [];

    // 5. Gather Inventory & Status
    const peptideIds = Array.from(new Set(allDailyRows.map((r) => Number(r.peptide_id))));

    const [{ data: invVials }, { data: invCaps }, { data: doseRows }] = await Promise.all([
        sa.from('inventory_items').select('*').eq('user_id', uid).in('peptide_id', peptideIds),
        sa.from('inventory_capsules').select('*').eq('user_id', uid).in('peptide_id', peptideIds),
        // Find ANY status for this peptide+date (ignoring protocol ID to be safe/broad)
        sa.from('doses').select('peptide_id,status,site_label').eq('user_id', uid).eq('date_for', dateISO).in('peptide_id', peptideIds),
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

    // 6. Build Final Rows
    // We map over generated rows. If multiple protocols use same peptide, we show both.
    const finalRows: TodayDoseRow[] = allDailyRows.map((dr) => {
        const pid = Number(dr.peptide_id);
        const vialInv = vialByPeptide.get(pid);
        const dbInfo = doseInfoByPeptide.get(pid);

        // NOTE: If same peptide is in 2 protocols, they might share the 'TAKEN' status unless
        // we start saving protocol_id in doses and keying by that.
        // For now, we assume 1 dose per peptide per day, or shared status is acceptable.

        return {
            peptide_id: pid,
            canonical_name: dr.canonical_name,
            dose_mg: dr.dose_mg,
            syringe_units: unitsFromDose(dr.dose_mg, vialInv?.mg_per_vial ?? null, vialInv?.bac_ml ?? null),
            mg_per_vial: vialInv?.mg_per_vial ?? null,
            bac_ml: vialInv?.bac_ml ?? null,
            status: dbInfo?.status || 'PENDING',
            site_label: dbInfo?.site_label || null,
            remainingDoses: null,
            reorderDateISO: null,
            time_of_day: dr.time_of_day,
        };
    });

    return finalRows.sort((a, b) => (a.time_of_day || '99').localeCompare(b.time_of_day || '99'));
}

// ... Mutations (logDose, etc.) remain mostly same but handle missing active protocol ...

async function updateInventoryUsage(supabase: any, uid: string, peptideId: number, deltaMg: number) {
     const { data: vialItem } = await supabase.from("inventory_items").select("id, vials, mg_per_vial, current_used_mg").eq("user_id", uid).eq("peptide_id", peptideId).maybeSingle();
     if (vialItem) {
        let newUsed = Number(vialItem.current_used_mg || 0) + deltaMg;
        let newVials = Number(vialItem.vials || 0);
        const size = Number(vialItem.mg_per_vial || 0);
        if (size > 0) {
            while (newUsed >= size && newVials > 0) { newUsed -= size; newVials--; }
            while (newUsed < 0) { newUsed += size; newVials++; }
        }
        await supabase.from("inventory_items").update({ vials: newVials, current_used_mg: Math.max(0, newUsed) }).eq("id", vialItem.id);
        return;
     }
     const { data: capItem } = await supabase.from("inventory_capsules").select("id, bottles, mg_per_cap, caps_per_bottle, current_used_mg").eq("user_id", uid).eq("peptide_id", peptideId).maybeSingle();
     if (capItem) {
        let newUsed = Number(capItem.current_used_mg || 0) + deltaMg;
        let newBottles = Number(capItem.bottles || 0);
        const bottleTotalMg = Number(capItem.caps_per_bottle || 0) * Number(capItem.mg_per_cap || 0);
        if (bottleTotalMg > 0) {
            while (newUsed >= bottleTotalMg && newBottles > 0) { newUsed -= bottleTotalMg; newBottles--; }
            while (newUsed < 0) { newUsed += bottleTotalMg; newBottles++; }
        }
        await supabase.from("inventory_capsules").update({ bottles: newBottles, current_used_mg: Math.max(0, newUsed) }).eq("id", capItem.id);
     }
}

async function upsertDoseStatus(peptide_id: number, dateISO: string, targetStatus: DoseStatus) {
    const sa = createServerActionSupabase();
    const { data: { user } } = await sa.auth.getUser();
    const uid = user?.id;
    if (!uid) throw new Error('Not signed in');

    // Find ANY active protocol for this date to link to (or just pick first one available)
    // We prioritize linking to a protocol that actually CONTAINS this peptide
    const { data: protocols } = await sa
        .from('protocols')
        .select('id, protocol_items(peptide_id)')
        .eq('user_id', uid)
        .eq('is_active', true); // We keep is_active=true on save, so this works as "enabled protocols"
    
    // Find protocol that has this peptide
    const matchingProto = protocols?.find((p: any) => p.protocol_items?.some((pi: any) => pi.peptide_id === peptide_id));
    // Fallback to first protocol or null
    const protocolId = matchingProto?.id || protocols?.[0]?.id || null;

    const { data: existing } = await sa
        .from('doses')
        .select('id, status, dose_mg')
        .eq('user_id', uid)
        .eq('peptide_id', peptide_id)
        .eq('date_for', dateISO)
        .maybeSingle();

    const currentStatus = existing?.status || 'PENDING';
    if (currentStatus === targetStatus) return;

    let doseAmount = existing?.dose_mg ? Number(existing.dose_mg) : 0;
    if (!doseAmount && protocolId) {
        const { data: pi } = await sa.from('protocol_items').select('dose_mg_per_administration').eq('protocol_id', protocolId).eq('peptide_id', peptide_id).maybeSingle();
        doseAmount = Number(pi?.dose_mg_per_administration || 0);
    }

    if (targetStatus === 'TAKEN' && currentStatus !== 'TAKEN') await updateInventoryUsage(sa, uid, peptide_id, doseAmount);
    else if (currentStatus === 'TAKEN' && targetStatus !== 'TAKEN') await updateInventoryUsage(sa, uid, peptide_id, -doseAmount);

    if (!existing?.id) {
        await sa.from('doses').insert({
            user_id: uid,
            protocol_id: protocolId, // Might be null, which is fine for AdHoc
            peptide_id,
            date: dateISO,
            date_for: dateISO,
            dose_mg: doseAmount,
            status: targetStatus,
        });
    } else {
        await sa.from('doses').update({ status: targetStatus }).eq('id', existing.id);
    }

    revalidatePath('/today');
}

export async function logDose(peptide_id: number, dateISO: string) { 'use server'; await upsertDoseStatus(peptide_id, dateISO, 'TAKEN'); }
export async function skipDose(peptide_id: number, dateISO: string) { 'use server'; await upsertDoseStatus(peptide_id, dateISO, 'SKIPPED'); }
export async function resetDose(peptide_id: number, dateISO: string) { 'use server'; await upsertDoseStatus(peptide_id, dateISO, 'PENDING'); }
