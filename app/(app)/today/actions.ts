'use server';

import { createServerActionSupabase } from '@/lib/supabaseServer';
import { unitsFromDose, forecastRemainingDoses } from '@/lib/forecast';
// 🟢 FIX: Use the exact same scheduling engine as the Calendar
import { isDoseDayUTC, type ScheduleItem } from '@/lib/scheduleEngine';
import { revalidatePath, unstable_noStore as noStore } from 'next/cache';

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
    noStore(); // 🟢 Disable cache to ensure status updates stick
    
    const sa = createServerActionSupabase();
    const { data: auth } = await sa.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) throw new Error('Session missing');

    // 1. Get Active Protocol & Items
    const { data: protocol } = await sa
        .from('protocols')
        .select('id,start_date')
        .eq('user_id', uid)
        .eq('is_active', true)
        .maybeSingle();

    const { data: items } = protocol?.id 
        ? await sa.from('protocol_items')
            .select('peptide_id,dose_mg_per_administration,schedule,custom_days,cycle_on_weeks,cycle_off_weeks,every_n_days,titration_interval_days,titration_amount_mg,time_of_day,peptides(canonical_name)')
            .eq('protocol_id', protocol.id)
        : { data: [] };

    // 2. Fetch Actual Doses (ALL doses for this date)
    const { data: doseRows } = await sa
        .from('doses')
        .select('peptide_id, status, site_label, dose_mg, time_of_day, peptides(canonical_name)')
        .eq('user_id', uid)
        .eq('date_for', dateISO);

    // 3. Identify all Peptide IDs (Schedule + Actuals)
    const itemIds = (items || []).map((i: any) => Number(i.peptide_id));
    const doseIds = (doseRows || []).map((r: any) => Number(r.peptide_id));
    const allPeptideIds = Array.from(new Set([...itemIds, ...doseIds]));

    if (allPeptideIds.length === 0) return [];

    // 4. Fetch Inventory
    const [{ data: invVials }, { data: invCaps }] = await Promise.all([
        sa.from('inventory_items').select('*').eq('user_id', uid).in('peptide_id', allPeptideIds),
        sa.from('inventory_capsules').select('*').eq('user_id', uid).in('peptide_id', allPeptideIds),
    ]);

    const vialMap = new Map<number, VialInv>();
    invVials?.forEach((r: any) => vialMap.set(Number(r.peptide_id), r));
    const capMap = new Map<number, CapsInv>();
    invCaps?.forEach((r: any) => capMap.set(Number(r.peptide_id), r));
    
    // Map DB Doses by Peptide ID for easy lookup
    const doseMap = new Map<number, any>();
    doseRows?.forEach((r: any) => doseMap.set(Number(r.peptide_id), r));

    const finalRows: TodayDoseRow[] = [];
    const processedIds = new Set<number>();

    // 5. Generate Schedule (CALENDAR LOGIC MATCH)
    if (protocol?.id && items) {
        const d = new Date(dateISO + 'T00:00:00Z'); 
        const protocolStart = protocol.start_date || dateISO;

        for (const it of items) {
            const pid = Number(it.peptide_id);
            const itemForSchedule: ScheduleItem & { protocol_start_date: string } = {
                ...it,
                protocol_start_date: protocolStart,
            };

            // 🟢 The exact check used by Calendar
            if (isDoseDayUTC(d, itemForSchedule)) {
                const dbDose = doseMap.get(pid);
                
                // If DB has a record (TAKEN/SKIPPED), use it. Otherwise use Protocol default.
                const finalDose = dbDose ? Number(dbDose.dose_mg) : Number(it.dose_mg_per_administration || 0);
                const status = dbDose ? (dbDose.status as DoseStatus) : 'PENDING';
                const site = dbDose?.site_label ?? null;
                const time = dbDose?.time_of_day ?? it.time_of_day;
                
                // Handle joined name array
                const pName = Array.isArray(it.peptides) ? it.peptides[0]?.canonical_name : (it.peptides as any)?.canonical_name;

                finalRows.push(buildRow(pid, pName || '', finalDose, status, time, site, vialMap, capMap));
                processedIds.add(pid);
            }
        }
    }

    // 6. Add Ad-Hoc / Overrides (Items in DB but not in today's schedule)
    for (const [pid, dbDose] of doseMap.entries()) {
        if (!processedIds.has(pid)) {
            const pName = Array.isArray(dbDose.peptides) ? dbDose.peptides[0]?.canonical_name : (dbDose.peptides as any)?.canonical_name;
            const name = pName || `Peptide #${pid}`;
            finalRows.push(buildRow(pid, name, Number(dbDose.dose_mg), dbDose.status as DoseStatus, dbDose.time_of_day, dbDose.site_label, vialMap, capMap));
        }
    }

    return finalRows.sort((a, b) => (a.time_of_day || '99').localeCompare(b.time_of_day || '99'));
}

function buildRow(pid: number, name: string, doseMg: number, status: DoseStatus, time: string | null, site: string | null, vialMap: Map<number, VialInv>, capMap: Map<number, CapsInv>): TodayDoseRow {
    const v = vialMap.get(pid);
    const units = unitsFromDose(doseMg, v?.mg_per_vial || null, v?.bac_ml || null);

    return {
        peptide_id: pid,
        canonical_name: name,
        dose_mg: doseMg,
        status: status,
        time_of_day: time,
        site_label: site,
        syringe_units: units,
        mg_per_vial: v?.mg_per_vial || null,
        bac_ml: v?.bac_ml || null,
        remainingDoses: null,
        reorderDateISO: null,
    };
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
     }
}

async function upsertDoseStatus(peptide_id: number, dateISO: string, targetStatus: DoseStatus) {
    const sa = createServerActionSupabase();
    const { data: { user } } = await sa.auth.getUser();
    if (!user) throw new Error('Not signed in');

    // 1. Check existing record (Ignore protocol_id)
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
    
    // Fallback: If no dose exists, check active protocol plan
    if (!doseAmount) {
         const { data: proto } = await sa.from('protocols').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle();
         if (proto) {
             const { data: pi } = await sa.from('protocol_items').select('dose_mg_per_administration').eq('protocol_id', proto.id).eq('peptide_id', peptide_id).maybeSingle();
             doseAmount = Number(pi?.dose_mg_per_administration || 0);
         }
    }

    // Update Inventory
    if (targetStatus === 'TAKEN' && currentStatus !== 'TAKEN') await updateInventoryUsage(sa, user.id, peptide_id, doseAmount);
    else if (currentStatus === 'TAKEN' && targetStatus !== 'TAKEN') await updateInventoryUsage(sa, user.id, peptide_id, -doseAmount);

    if (!existing?.id) {
        // Link protocol if available
        const { data: proto } = await sa.from('protocols').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle();
        await sa.from('doses').insert({
            user_id: user.id,
            protocol_id: proto?.id || null, 
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
