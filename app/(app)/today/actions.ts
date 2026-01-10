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
    const { data: auth } = await sa.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) throw new Error('Session missing');

    // 1. Fetch ALL protocols (Calendar Logic: Filter by date overlap)
    const { data: protocols } = await sa
        .from('protocols')
        .select('id, start_date, end_date')
        .eq('user_id', uid);

    // Filter active/overlapping protocols
    const activeProtocols = (protocols || []).filter((p: any) => {
        const pStart = p.start_date;
        const pEnd = p.end_date || '9999-12-31';
        return pStart <= dateISO && pEnd >= dateISO;
    });

    const activeIds = activeProtocols.map(p => p.id);

    // 2. Fetch Items
    const { data: items } = activeIds.length > 0 
        ? await sa.from('protocol_items')
            .select('protocol_id, peptide_id, dose_mg_per_administration, schedule, custom_days, cycle_on_weeks, cycle_off_weeks, every_n_days, time_of_day, peptides(canonical_name)')
            .in('protocol_id', activeIds)
        : { data: [] };

    // 3. Fetch DB Doses (Status) - Ignore protocol_id to catch all
    const { data: dbDoses } = await sa
        .from('doses')
        .select('peptide_id, status, site_label, dose_mg, time_of_day, peptides(canonical_name)')
        .eq('user_id', uid)
        .eq('date_for', dateISO);

    // 4. Collect IDs for Inventory
    const scheduledIds = (items || []).map((i: any) => Number(i.peptide_id));
    const dbIds = (dbDoses || []).map((d: any) => Number(d.peptide_id));
    const allPeptideIds = Array.from(new Set([...scheduledIds, ...dbIds]));

    if (allPeptideIds.length === 0) return [];

    // 5. Fetch Inventory
    const [{ data: invVials }, { data: invCaps }] = await Promise.all([
        sa.from('inventory_items').select('*').eq('user_id', uid).in('peptide_id', allPeptideIds),
        sa.from('inventory_capsules').select('*').eq('user_id', uid).in('peptide_id', allPeptideIds),
    ]);

    const vialMap = new Map<number, VialInv>();
    invVials?.forEach((r: any) => vialMap.set(Number(r.peptide_id), r));
    const capMap = new Map<number, CapsInv>();
    invCaps?.forEach((r: any) => capMap.set(Number(r.peptide_id), r));

    // 6. Generate Schedule (Calendar Logic)
    const rawRows: TodayDoseRow[] = [];
    const dateObj = new Date(dateISO + 'T00:00:00Z');

    for (const p of activeProtocols) {
        const protoItems = items?.filter((it: any) => it.protocol_id === p.id) || [];
        for (const it of protoItems) {
            const itemForSchedule = { ...it, protocol_start_date: p.start_date };
            
            if (isDoseDayUTC(dateObj, itemForSchedule)) {
                const pid = Number(it.peptide_id);
                const pName = Array.isArray(it.peptides) ? it.peptides[0]?.canonical_name : (it.peptides as any)?.canonical_name;
                
                rawRows.push(buildRow(pid, pName || '', Number(it.dose_mg_per_administration), 'PENDING', it.time_of_day, null, vialMap, capMap));
            }
        }
    }

    // 7. Consolidate & Merge DB Status
    // This solves the "duplicate cards" issue and the "status reverting" issue (by prioritizing DB)
    const finalMap = new Map<number, TodayDoseRow>();

    // A. Add Scheduled (Consolidating)
    for (const row of rawRows) {
        if (finalMap.has(row.peptide_id)) {
            const existing = finalMap.get(row.peptide_id)!;
            // Sum dose if multiple protocols schedule it (User requirement might vary, but this is safest for duplicates)
            existing.dose_mg += row.dose_mg;
            // Recalculate units
            existing.syringe_units = unitsFromDose(existing.dose_mg, existing.mg_per_vial, existing.bac_ml);
        } else {
            finalMap.set(row.peptide_id, row);
        }
    }

    // B. Apply DB Status Overrides
    // If DB says "TAKEN", we mark the consolidated row as taken and update dose/time
    if (dbDoses) {
        for (const dbDose of dbDoses) {
            const pid = Number(dbDose.peptide_id);
            const status = dbDose.status as DoseStatus;
            
            if (finalMap.has(pid)) {
                // Update existing scheduled item
                const row = finalMap.get(pid)!;
                row.status = status;
                row.dose_mg = Number(dbDose.dose_mg); // DB is truth for amount taken
                row.syringe_units = unitsFromDose(row.dose_mg, row.mg_per_vial, row.bac_ml);
                row.time_of_day = dbDose.time_of_day || row.time_of_day;
                row.site_label = dbDose.site_label;
            } else {
                // Ad-Hoc (in DB but not in schedule)
                const pName = Array.isArray(dbDose.peptides) ? dbDose.peptides[0]?.canonical_name : (dbDose.peptides as any)?.canonical_name;
                const row = buildRow(pid, pName || `Peptide #${pid}`, Number(dbDose.dose_mg), status, dbDose.time_of_day, dbDose.site_label, vialMap, capMap);
                finalMap.set(pid, row);
            }
        }
    }

    return Array.from(finalMap.values()).sort((a, b) => (a.time_of_day || '99').localeCompare(b.time_of_day || '99'));
}

function buildRow(pid: number, name: string, doseMg: number, status: DoseStatus, time: string | null, site: string | null, vialMap: Map<number, VialInv>, capMap: Map<number, CapsInv>): TodayDoseRow {
    const v = vialMap.get(pid);
    return {
        peptide_id: pid,
        canonical_name: name,
        dose_mg: doseMg,
        status: status,
        time_of_day: time,
        site_label: site,
        syringe_units: unitsFromDose(doseMg, v?.mg_per_vial || null, v?.bac_ml || null),
        mg_per_vial: v?.mg_per_vial || null,
        bac_ml: v?.bac_ml || null,
        remainingDoses: null,
        reorderDateISO: null,
    };
}

// ... Mutations ...

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

    // Link to ANY valid protocol for today (priority)
    const { data: protocols } = await sa.from('protocols').select('id,start_date,end_date').eq('user_id', uid);
    const validProto = protocols?.find((p: any) => {
        const start = p.start_date;
        const end = p.end_date || '9999-12-31';
        return start <= dateISO && end >= dateISO;
    });

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
    if (!doseAmount && validProto?.id) {
         // Try to find default dose from the linked protocol
         const { data: pi } = await sa.from('protocol_items').select('dose_mg_per_administration').eq('protocol_id', validProto.id).eq('peptide_id', peptide_id).maybeSingle();
         doseAmount = Number(pi?.dose_mg_per_administration || 0);
    }

    // Update inventory
    if (targetStatus === 'TAKEN' && currentStatus !== 'TAKEN') await updateInventoryUsage(sa, uid, peptide_id, doseAmount);
    else if (currentStatus === 'TAKEN' && targetStatus !== 'TAKEN') await updateInventoryUsage(sa, uid, peptide_id, -doseAmount);

    if (!existing?.id) {
        await sa.from('doses').insert({
            user_id: uid,
            protocol_id: validProto?.id || null, 
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
    revalidatePath('/calendar');
}

export async function logDose(peptide_id: number, dateISO: string) { 'use server'; await upsertDoseStatus(peptide_id, dateISO, 'TAKEN'); }
export async function skipDose(peptide_id: number, dateISO: string) { 'use server'; await upsertDoseStatus(peptide_id, dateISO, 'SKIPPED'); }
export async function resetDose(peptide_id: number, dateISO: string) { 'use server'; await upsertDoseStatus(peptide_id, dateISO, 'PENDING'); }
