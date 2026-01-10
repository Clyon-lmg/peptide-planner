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

// ---------- Queries ----------

export async function getTodayDosesWithUnits(dateISO: string): Promise<TodayDoseRow[]> {
    const sa = createServerActionSupabase();
    const { data: auth } = await sa.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) throw new Error('Session missing');

    // 1. Fetch Protocols (We need this to generate the cards)
    // We use date filtering to find valid protocols
    const { data: allProtocols } = await sa
        .from('protocols')
        .select('id, start_date, end_date')
        .eq('user_id', uid);

    const activeProtocols = (allProtocols || []).filter((p: any) => {
        if (!p.start_date) return false;
        if (p.start_date > dateISO) return false;
        if (p.end_date && p.end_date < dateISO) return false;
        return true;
    });

    const activeIds = activeProtocols.map(p => p.id);

    // 2. Fetch Items
    let items: any[] = [];
    if (activeIds.length > 0) {
        const { data } = await sa.from('protocol_items')
            .select('protocol_id, peptide_id, dose_mg_per_administration, schedule, custom_days, cycle_on_weeks, cycle_off_weeks, every_n_days, titration_interval_days, titration_amount_mg, time_of_day, peptides(canonical_name)')
            .in('protocol_id', activeIds);
        items = data || [];
    }

    // 3. Fetch DB Doses (THE FIX: Match status.ts logic)
    // 🟢 WE IGNORE protocol_id here. We only care if this user took this peptide on this date.
    const { data: dbDoses } = await sa
        .from('doses')
        .select('peptide_id, status, site_label, dose_mg, time_of_day, peptides(canonical_name)')
        .eq('user_id', uid)
        .eq('date_for', dateISO);

    // 4. Generate Schedule & Merge
    const combinedMap = new Map<number, TodayDoseRow>();
    const dateObj = new Date(dateISO + 'T00:00:00Z');

    // Helper: Group by protocol
    const itemsByProto = new Map<number, any[]>();
    items.forEach(it => {
        if (!itemsByProto.has(it.protocol_id)) itemsByProto.set(it.protocol_id, []);
        itemsByProto.get(it.protocol_id)?.push(it);
    });

    // A. Build Scheduled Rows
    activeProtocols.forEach(p => {
        const pItems = itemsByProto.get(p.id);
        if (!pItems) return;

        for (const it of pItems) {
            const itemForSchedule = { ...it, protocol_start_date: p.start_date };
            
            if (isDoseDayUTC(dateObj, itemForSchedule)) {
                const pid = Number(it.peptide_id);
                const pName = Array.isArray(it.peptides) ? it.peptides[0]?.canonical_name : (it.peptides as any)?.canonical_name;
                
                if (!combinedMap.has(pid)) {
                    combinedMap.set(pid, {
                        peptide_id: pid,
                        canonical_name: pName || `Peptide #${pid}`,
                        dose_mg: Number(it.dose_mg_per_administration),
                        status: 'PENDING',
                        time_of_day: it.time_of_day,
                        site_label: null,
                        syringe_units: null,
                        mg_per_vial: null,
                        bac_ml: null,
                        remainingDoses: null,
                        reorderDateISO: null
                    });
                }
            }
        }
    });

    // B. Apply DB Status (Matches status.ts: lookup by peptide_id only)
    if (dbDoses) {
        for (const db of dbDoses) {
            const pid = Number(db.peptide_id);
            const status = (db.status as DoseStatus) || 'PENDING';
            
            if (combinedMap.has(pid)) {
                const row = combinedMap.get(pid)!;
                row.status = status;
                row.dose_mg = Number(db.dose_mg);
                row.site_label = db.site_label;
                if (db.time_of_day) row.time_of_day = db.time_of_day;
            } else {
                // Ad-Hoc handling
                const pName = Array.isArray(db.peptides) ? db.peptides[0]?.canonical_name : (db.peptides as any)?.canonical_name;
                combinedMap.set(pid, {
                    peptide_id: pid,
                    canonical_name: pName || `Peptide #${pid}`,
                    dose_mg: Number(db.dose_mg),
                    status: status,
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

    // 5. Inventory & Units
    const finalRows = Array.from(combinedMap.values());
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

    // 1. Find ANY valid protocol to link (for housekeeping, but not required for status)
    const { data: protocols } = await sa.from('protocols').select('id,start_date,end_date').eq('user_id', user.id);
    const validProto = protocols?.find((p: any) => {
        if (p.start_date > dateISO) return false;
        if (p.end_date && p.end_date < dateISO) return false;
        return true;
    });
    const protocolId = validProto?.id || null;

    // 2. Check Existing (THE FIX: Loose Lookup matching status.ts)
    // 🟢 Ignore protocol_id. Find existing record by user + peptide + date.
    const { data: existing } = await sa
        .from('doses')
        .select('id, status, dose_mg')
        .eq('user_id', user.id)
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

    // 3. Update Inventory
    if (targetStatus === 'TAKEN' && currentStatus !== 'TAKEN') await updateInventoryUsage(sa, user.id, peptide_id, doseAmount);
    else if (currentStatus === 'TAKEN' && targetStatus !== 'TAKEN') await updateInventoryUsage(sa, user.id, peptide_id, -doseAmount);

    // 4. Commit
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
    revalidatePath('/calendar');
}

export async function logDose(peptide_id: number, dateISO: string) { 'use server'; await upsertDoseStatus(peptide_id, dateISO, 'TAKEN'); }
export async function skipDose(peptide_id: number, dateISO: string) { 'use server'; await upsertDoseStatus(peptide_id, dateISO, 'SKIPPED'); }
export async function resetDose(peptide_id: number, dateISO: string) { 'use server'; await upsertDoseStatus(peptide_id, dateISO, 'PENDING'); }
