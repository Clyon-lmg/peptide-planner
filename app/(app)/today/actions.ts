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

    // 1. Fetch ALL protocols for the user
    const { data: allProtocols } = await sa
        .from('protocols')
        .select('id,start_date,end_date')
        .eq('user_id', uid);
    
    if (!allProtocols?.length) return [];

    // 2. Filter for protocols active ON THIS DATE (Inclusive)
    // Logic: Start <= Today <= End (or End is null)
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

    // 4. Generate Daily Doses (Per-Protocol to respect start dates)
    let allDailyRows: any[] = [];
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

    // 5. Gather Inventory & Status
    // We collect IDs from both Scheduled items AND any ad-hoc doses in DB
    const scheduledPeptideIds = Array.from(new Set(allDailyRows.map((r) => Number(r.peptide_id))));

    // Fetch DB Doses (Ignore protocol_id to catch everything for this user/date)
    const { data: dbDoses } = await sa
        .from('doses')
        .select('peptide_id,status,site_label,dose_mg,time_of_day,peptides(canonical_name)')
        .eq('user_id', uid)
        .eq('date_for', dateISO);

    const dbPeptideIds = (dbDoses || []).map((r: any) => Number(r.peptide_id));
    const allPeptideIds = Array.from(new Set([...scheduledPeptideIds, ...dbPeptideIds]));

    if (allPeptideIds.length === 0) return [];

    const [{ data: invVials }, { data: invCaps }] = await Promise.all([
        sa.from('inventory_items').select('*').eq('user_id', uid).in('peptide_id', allPeptideIds),
        sa.from('inventory_capsules').select('*').eq('user_id', uid).in('peptide_id', allPeptideIds),
    ]);

    const vialMap = new Map<number, VialInv>();
    invVials?.forEach((r: any) => vialMap.set(Number(r.peptide_id), r));
    const capMap = new Map<number, CapsInv>();
    invCaps?.forEach((r: any) => capMap.set(Number(r.peptide_id), r));

    // Map DB Info
    const dbDoseMap = new Map<number, any>();
    dbDoses?.forEach((d: any) => dbDoseMap.set(Number(d.peptide_id), d));

    const finalRows: TodayDoseRow[] = [];

    // A. Add Scheduled Rows (Merge with DB status)
    for (const row of allDailyRows) {
        const pid = Number(row.peptide_id);
        const dbEntry = dbDoseMap.get(pid);
        
        const finalDose = dbEntry ? Number(dbEntry.dose_mg) : Number(row.dose_mg);
        const status = dbEntry ? (dbEntry.status as DoseStatus) : 'PENDING';
        const site = dbEntry?.site_label ?? null;
        
        finalRows.push(buildRow(pid, row.canonical_name, finalDose, status, row.time_of_day, site, vialMap, capMap));
        
        if (dbEntry) dbDoseMap.delete(pid);
    }

    // B. Add Remaining Ad-Hoc
    for (const [pid, dbEntry] of dbDoseMap.entries()) {
        const name = dbEntry.peptides?.canonical_name || `Peptide #${pid}`;
        finalRows.push(buildRow(pid, name, Number(dbEntry.dose_mg), dbEntry.status as DoseStatus, dbEntry.time_of_day, dbEntry.site_label, vialMap, capMap));
    }

    return finalRows.sort((a, b) => (a.time_of_day || '99').localeCompare(b.time_of_day || '99'));
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

    // Link to an active protocol if possible
    // We prioritize linking to a protocol that actually CONTAINS this peptide
    const { data: protocols } = await sa
        .from('protocols')
        .select('id, start_date, end_date, protocol_items(peptide_id)')
        .eq('user_id', uid);
    
    // Find valid date protocols
    const validProtos = protocols?.filter((p: any) => {
        if (p.start_date > dateISO) return false;
        if (p.end_date && p.end_date < dateISO) return false;
        return true;
    }) || [];

    // Find specific protocol that has this peptide
    const matchingProto = validProtos.find((p: any) => p.protocol_items?.some((pi: any) => pi.peptide_id === peptide_id));
    // Fallback to first valid protocol or null
    const protocolId = matchingProto?.id || validProtos[0]?.id || null;

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
