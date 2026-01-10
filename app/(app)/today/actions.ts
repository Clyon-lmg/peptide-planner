'use server';

import { createServerActionSupabase } from '@/lib/supabaseServer';
import { unitsFromDose, forecastRemainingDoses } from '@/lib/forecast';
import {
    generateDailyDoses,
    isDoseDayUTC,
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
    const { data: auth } = await sa.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) throw new Error('Session missing');

    // 1. Fetch ALL active/overlapping protocols (Calendar Logic)
    const { data: allProtocols } = await sa
        .from('protocols')
        .select('id, start_date, end_date')
        .eq('user_id', uid);

    const activeProtocols = (allProtocols || []).filter((p: any) => {
        const pStart = p.start_date;
        const pEnd = p.end_date || '9999-12-31';
        return pStart <= dateISO && pEnd >= dateISO;
    });

    // 2. Fetch Items for these protocols
    const activeIds = activeProtocols.map(p => p.id);
    let allItems: any[] = [];
    if (activeIds.length > 0) {
        const { data } = await sa.from('protocol_items')
            .select('protocol_id, peptide_id, dose_mg_per_administration, schedule, custom_days, cycle_on_weeks, cycle_off_weeks, every_n_days, time_of_day, peptides(canonical_name)')
            .in('protocol_id', activeIds);
        allItems = data || [];
    }

    // 3. Fetch DB Doses (Status) - NO protocol filter to ensure we catch everything
    const { data: dbDoses } = await sa
        .from('doses')
        .select('peptide_id, status, site_label, dose_mg, time_of_day, peptides(canonical_name)')
        .eq('user_id', uid)
        .eq('date_for', dateISO);

    // 4. Map Status (Keyed by peptide_id, just like Calendar)
    const statusMap = new Map<number, any>();
    dbDoses?.forEach((d: any) => {
        statusMap.set(Number(d.peptide_id), d);
    });

    // 5. Generate Schedule
    const rows: TodayDoseRow[] = [];
    const dateObj = new Date(dateISO + 'T00:00:00Z');

    for (const p of activeProtocols) {
        const protoItems = allItems.filter((it: any) => it.protocol_id === p.id);
        
        for (const it of protoItems) {
            const itemForSchedule = { ...it, protocol_start_date: p.start_date };
            
            if (isDoseDayUTC(dateObj, itemForSchedule)) {
                const pid = Number(it.peptide_id);
                // Check DB status
                const existing = statusMap.get(pid);
                
                rows.push({
                    peptide_id: pid,
                    canonical_name: it.peptides?.canonical_name || `Peptide #${pid}`,
                    dose_mg: existing ? Number(existing.dose_mg) : Number(it.dose_mg_per_administration),
                    status: existing ? (existing.status as DoseStatus) : 'PENDING',
                    time_of_day: existing?.time_of_day || it.time_of_day,
                    site_label: existing?.site_label || null,
                    syringe_units: null, // Calc later
                    mg_per_vial: null,
                    bac_ml: null,
                    remainingDoses: null,
                    reorderDateISO: null
                });
            }
        }
    }

    // 6. Inject Ad-Hoc (Items in DB but not in generated schedule)
    const scheduledPeptides = new Set(rows.map(r => r.peptide_id));
    dbDoses?.forEach((d: any) => {
        const pid = Number(d.peptide_id);
        if (!scheduledPeptides.has(pid)) {
            const pName = d.peptides?.canonical_name || `Peptide #${pid}`;
            rows.push({
                peptide_id: pid,
                canonical_name: pName,
                dose_mg: Number(d.dose_mg),
                status: d.status as DoseStatus,
                time_of_day: d.time_of_day,
                site_label: d.site_label,
                syringe_units: null,
                mg_per_vial: null,
                bac_ml: null,
                remainingDoses: null,
                reorderDateISO: null
            });
        }
    });

    // 7. Consolidate Duplicates (If multiple protocols have same peptide)
    // We merge them to avoid UI confusion, prioritizing "TAKEN" status
    const mergedMap = new Map<number, TodayDoseRow>();
    for (const r of rows) {
        if (mergedMap.has(r.peptide_id)) {
            const prev = mergedMap.get(r.peptide_id)!;
            // If new one is TAKEN, it wins. If prev was TAKEN, it keeps winning.
            if (r.status === 'TAKEN') prev.status = 'TAKEN';
            if (r.dose_mg > prev.dose_mg) prev.dose_mg = r.dose_mg; // Simplistic merge: max dose or DB dose
        } else {
            mergedMap.set(r.peptide_id, r);
        }
    }
    const finalRows = Array.from(mergedMap.values());

    // 8. Inventory Lookup & Units
    if (finalRows.length > 0) {
        const pids = finalRows.map(r => r.peptide_id);
        const [{ data: invVials }, { data: invCaps }] = await Promise.all([
            sa.from('inventory_items').select('*').eq('user_id', uid).in('peptide_id', pids),
            sa.from('inventory_capsules').select('*').eq('user_id', uid).in('peptide_id', pids),
        ]);

        const vialMap = new Map();
        invVials?.forEach((r: any) => vialMap.set(Number(r.peptide_id), r));
        
        for (const row of finalRows) {
            const v = vialMap.get(row.peptide_id);
            row.mg_per_vial = v?.mg_per_vial || null;
            row.bac_ml = v?.bac_ml || null;
            row.syringe_units = unitsFromDose(row.dose_mg, row.mg_per_vial, row.bac_ml);
        }
    }

    return finalRows.sort((a, b) => (a.time_of_day || '99').localeCompare(b.time_of_day || '99'));
}

// ---------- Mutations ----------

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
    if (!user) throw new Error('Not signed in');

    // 1. Find the best protocol to link (containing this peptide, valid date)
    const { data: protocols } = await sa.from('protocols').select('id,start_date,end_date, protocol_items(peptide_id)').eq('user_id', user.id);
    const validProtos = (protocols || []).filter((p: any) => {
        const start = p.start_date;
        const end = p.end_date || '9999-12-31';
        return start <= dateISO && end >= dateISO;
    });
    const match = validProtos.find((p: any) => p.protocol_items?.some((pi: any) => pi.peptide_id === peptide_id));
    const protocolId = match?.id || validProtos[0]?.id || null;

    // 2. Check existing
    const { data: existing } = await sa
        .from('doses')
        .select('id, status, dose_mg')
        .eq('user_id', user.id)
        .eq('peptide_id', peptide_id)
        .eq('date_for', dateISO)
        .maybeSingle();

    const currentStatus = existing?.status || 'PENDING';
    if (currentStatus === targetStatus) return;

    // 3. Dose Amount
    let doseAmount = existing?.dose_mg ? Number(existing.dose_mg) : 0;
    if (!doseAmount && protocolId) {
         const { data: pi } = await sa.from('protocol_items').select('dose_mg_per_administration').eq('protocol_id', protocolId).eq('peptide_id', peptide_id).maybeSingle();
         doseAmount = Number(pi?.dose_mg_per_administration || 0);
    }

    // 4. Update Inventory
    if (targetStatus === 'TAKEN' && currentStatus !== 'TAKEN') await updateInventoryUsage(sa, user.id, peptide_id, doseAmount);
    else if (currentStatus === 'TAKEN' && targetStatus !== 'TAKEN') await updateInventoryUsage(sa, user.id, peptide_id, -doseAmount);

    // 5. Commit
    if (!existing?.id) {
        await sa.from('doses').insert({
            user_id: user.id,
            protocol_id: protocolId, 
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
