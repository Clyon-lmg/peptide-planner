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

    // 1. Fetch ALL user protocols (to support overlapping dates)
    const { data: allProtocols } = await sa
        .from('protocols')
        .select('id, start_date, end_date')
        .eq('user_id', uid);

    // 2. Filter for protocols active ON THIS DATE (Start <= Today <= End)
    // This matches the Calendar logic
    const activeProtocols = (allProtocols || []).filter((p: any) => {
        if (!p.start_date) return false;
        if (p.start_date > dateISO) return false; // Starts in future
        if (p.end_date && p.end_date < dateISO) return false; // Ends in past
        return true;
    });

    // 3. Fetch Items for ALL active protocols
    let protocolItems: any[] = [];
    const activeIds = activeProtocols.map(p => p.id);
    
    if (activeIds.length > 0) {
        const { data: items } = await sa
            .from('protocol_items')
            .select(
                'protocol_id, peptide_id, dose_mg_per_administration, schedule, custom_days, cycle_on_weeks, cycle_off_weeks, every_n_days, titration_interval_days, titration_amount_mg, time_of_day, peptides(canonical_name)'
            )
            .in('protocol_id', activeIds);
        protocolItems = items || [];
    }

    // 4. Generate Daily Doses (Consolidated)
    // We group items by protocol to pass the correct 'start_date' to the generator
    const scheduledMap = new Map<number, { 
        canonical_name: string, 
        dose_mg: number, 
        time_of_day: string | null 
    }>();

    const itemsByProto = new Map<number, any[]>();
    protocolItems.forEach(it => {
        if (!itemsByProto.has(it.protocol_id)) itemsByProto.set(it.protocol_id, []);
        itemsByProto.get(it.protocol_id)?.push(it);
    });

    activeProtocols.forEach(p => {
        const pItems = itemsByProto.get(p.id);
        if (!pItems) return;

        const cleanItems: ProtocolItem[] = pItems.map((it: any) => ({
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

        // Generate for this specific protocol
        const rows = generateDailyDoses(dateISO, p.start_date, cleanItems);

        // Merge into main map (Consolidate duplicates if multiple protocols use same peptide)
        rows.forEach(row => {
            const pid = Number(row.peptide_id);
            if (scheduledMap.has(pid)) {
                const existing = scheduledMap.get(pid)!;
                existing.dose_mg += row.dose_mg; // Sum doses
                if (row.time_of_day && (!existing.time_of_day || row.time_of_day < existing.time_of_day)) {
                    existing.time_of_day = row.time_of_day;
                }
            } else {
                scheduledMap.set(pid, { ...row });
            }
        });
    });

    // 5. Fetch Actual Status from DB
    // 🟢 CRITICAL: Ignore protocol_id here. Find ANY dose for this user+date.
    const { data: dbDoses } = await sa
        .from('doses')
        .select('peptide_id, status, site_label, dose_mg, time_of_day, peptides(canonical_name)')
        .eq('user_id', uid)
        .eq('date_for', dateISO);

    // 6. Build Final List (Merge Schedule + DB)
    const finalMap = new Map<number, TodayDoseRow>();
    const allPeptideIds = new Set<number>();

    // A. Add Scheduled Items (Default: PENDING)
    for (const [pid, s] of scheduledMap.entries()) {
        allPeptideIds.add(pid);
        finalMap.set(pid, {
            peptide_id: pid,
            canonical_name: s.canonical_name,
            dose_mg: s.dose_mg,
            status: 'PENDING',
            time_of_day: s.time_of_day,
            site_label: null,
            syringe_units: null,
            mg_per_vial: null,
            bac_ml: null,
            remainingDoses: null,
            reorderDateISO: null
        });
    }

    // B. Apply DB Overrides (Status / Ad-Hoc)
    if (dbDoses) {
        for (const db of dbDoses) {
            const pid = Number(db.peptide_id);
            allPeptideIds.add(pid);
            
            const existing = finalMap.get(pid);
            if (existing) {
                // Update existing scheduled item
                existing.status = (db.status as DoseStatus) || 'PENDING';
                existing.dose_mg = Number(db.dose_mg); // DB dose is the truth
                existing.site_label = db.site_label;
                if (db.time_of_day) existing.time_of_day = db.time_of_day;
            } else {
                // Add Ad-Hoc (not in schedule)
                const pName = Array.isArray(db.peptides) ? db.peptides[0]?.canonical_name : (db.peptides as any)?.canonical_name;
                finalMap.set(pid, {
                    peptide_id: pid,
                    canonical_name: pName || `Peptide #${pid}`,
                    dose_mg: Number(db.dose_mg),
                    status: (db.status as DoseStatus) || 'PENDING',
                    time_of_day: db.time_of_day,
                    site_label: db.site_label,
                    syringe_units: null,
                    mg_per_vial: null,
                    bac_ml: null,
                    remainingDoses: null,
                    reorderDateISO: null
                });
            }
        }
    }

    // 7. Inventory Lookup & Unit Calculation
    if (allPeptideIds.size > 0) {
        const idArray = Array.from(allPeptideIds);
        const [{ data: invVials }, { data: invCaps }] = await Promise.all([
            sa.from('inventory_items').select('*').eq('user_id', uid).in('peptide_id', idArray),
            sa.from('inventory_capsules').select('*').eq('user_id', uid).in('peptide_id', idArray),
        ]);

        const vialMap = new Map();
        invVials?.forEach((r: any) => vialMap.set(Number(r.peptide_id), r));
        
        for (const row of finalMap.values()) {
            const v = vialMap.get(row.peptide_id);
            row.mg_per_vial = v?.mg_per_vial || null;
            row.bac_ml = v?.bac_ml || null;
            row.syringe_units = unitsFromDose(row.dose_mg, row.mg_per_vial, row.bac_ml);
        }
    }

    return Array.from(finalMap.values()).sort((a, b) => (a.time_of_day || '99').localeCompare(b.time_of_day || '99'));
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
    const uid = user?.id;
    if (!uid) throw new Error('Not signed in');

    // 1. Determine which protocol to link this to (Best effort)
    const { data: protocols } = await sa.from('protocols').select('id,start_date,end_date, protocol_items(peptide_id)').eq('user_id', uid);
    
    // Find active protocols for this date
    const validProtos = (protocols || []).filter((p: any) => {
        const start = p.start_date;
        const end = p.end_date || '9999-12-31';
        return start <= dateISO && end >= dateISO;
    });

    // Find the one that contains this peptide
    const match = validProtos.find((p: any) => p.protocol_items?.some((pi: any) => pi.peptide_id === peptide_id));
    const protocolId = match?.id || validProtos[0]?.id || null;

    // 2. Check for EXISTING dose record (Status)
    const { data: existing } = await sa
        .from('doses')
        .select('id, status, dose_mg')
        .eq('user_id', uid)
        .eq('peptide_id', peptide_id)
        .eq('date_for', dateISO)
        .maybeSingle();

    const currentStatus = existing?.status || 'PENDING';
    if (currentStatus === targetStatus) return;

    // 3. Determine dose amount (for inventory)
    let doseAmount = existing?.dose_mg ? Number(existing.dose_mg) : 0;
    if (!doseAmount && protocolId) {
         const { data: pi } = await sa.from('protocol_items').select('dose_mg_per_administration').eq('protocol_id', protocolId).eq('peptide_id', peptide_id).maybeSingle();
         doseAmount = Number(pi?.dose_mg_per_administration || 0);
    }

    // 4. Update Inventory
    if (targetStatus === 'TAKEN' && currentStatus !== 'TAKEN') await updateInventoryUsage(sa, uid, peptide_id, doseAmount);
    else if (currentStatus === 'TAKEN' && targetStatus !== 'TAKEN') await updateInventoryUsage(sa, uid, peptide_id, -doseAmount);

    // 5. Commit Dose Status
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
    revalidatePath('/calendar');
}

export async function logDose(peptide_id: number, dateISO: string) { 'use server'; await upsertDoseStatus(peptide_id, dateISO, 'TAKEN'); }
export async function skipDose(peptide_id: number, dateISO: string) { 'use server'; await upsertDoseStatus(peptide_id, dateISO, 'SKIPPED'); }
export async function resetDose(peptide_id: number, dateISO: string) { 'use server'; await upsertDoseStatus(peptide_id, dateISO, 'PENDING'); }
