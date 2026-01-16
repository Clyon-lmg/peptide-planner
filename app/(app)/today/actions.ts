'use server';

import { createServerActionSupabase } from '@/lib/supabaseServer';
import { unitsFromDose, forecastRemainingDoses, type Schedule } from '@/lib/forecast';
import { generateDailyDoses, type ProtocolItem } from '@/lib/scheduleEngine';
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

// --- 1. UNIFIED SCHEDULE GENERATOR ---
async function getUnifiedDailySchedule(supabase: any, uid: string, dateISO: string) {
    const { data: allProtocols } = await supabase
        .from('protocols')
        .select('id, start_date, end_date')
        .eq('user_id', uid);

    const activeProtocols = (allProtocols || []).filter((p: any) => {
        if (!p.start_date) return false;
        if (p.start_date > dateISO) return false; 
        if (p.end_date && p.end_date < dateISO) return false; 
        return true;
    });

    const activeIds = activeProtocols.map((p: any) => p.id);
    if (activeIds.length === 0) return new Map();

    const { data: items } = await supabase.from('protocol_items')
        .select('protocol_id, peptide_id, dose_mg_per_administration, schedule, custom_days, cycle_on_weeks, cycle_off_weeks, every_n_days, titration_interval_days, titration_amount_mg, time_of_day, site_list_id, peptides(canonical_name)')
        .in('protocol_id', activeIds);

    if (!items || items.length === 0) return new Map();

    const consolidated = new Map<number, { 
        canonical_name: string, 
        dose_mg: number, 
        time_of_day: string | null,
        _originalItem: any 
    }>();

    const itemsByProto = new Map<number, any[]>();
    items.forEach((it: any) => {
        if (!itemsByProto.has(it.protocol_id)) itemsByProto.set(it.protocol_id, []);
        itemsByProto.get(it.protocol_id)?.push(it);
    });

    activeProtocols.forEach((p: any) => {
        const pItems = itemsByProto.get(p.id);
        if (!pItems) return;

        const engineItems: ProtocolItem[] = pItems.map((it: any) => ({
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

        const dailyDoses = generateDailyDoses(dateISO, p.start_date, engineItems);

        dailyDoses.forEach(dose => {
            const pid = Number(dose.peptide_id);
            if (consolidated.has(pid)) {
                const existing = consolidated.get(pid)!;
                existing.dose_mg += dose.dose_mg; 
                if (dose.time_of_day && (!existing.time_of_day || dose.time_of_day < existing.time_of_day)) {
                    existing.time_of_day = dose.time_of_day;
                }
            } else {
                const original = pItems.find((i: any) => Number(i.peptide_id) === pid);
                consolidated.set(pid, { 
                    canonical_name: dose.canonical_name,
                    dose_mg: dose.dose_mg,
                    time_of_day: dose.time_of_day,
                    _originalItem: original
                });
            }
        });
    });

    return consolidated;
}

// --- 2. MAIN QUERY ---

export async function getTodayDosesWithUnits(dateISO: string): Promise<TodayDoseRow[]> {
    const sa = createServerActionSupabase();
    const { data: auth } = await sa.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) throw new Error('Session missing');

    const scheduledMap = await getUnifiedDailySchedule(sa, uid, dateISO);

    // Fetch DB Doses
    const { data: dbDoses } = await sa
        .from('doses')
        .select('peptide_id, status, site_label, dose_mg, peptides(canonical_name)')
        .eq('user_id', uid)
        .eq('date_for', dateISO);

    const finalMap = new Map<number, TodayDoseRow>();
    const allPeptideIds = new Set<number>();
    const neededSiteListIds = new Set<number>();

    // Add Schedule
    for (const [pid, item] of scheduledMap.entries()) {
        allPeptideIds.add(pid);
        
        const rawSiteListId = item._originalItem?.site_list_id;
        if (rawSiteListId) neededSiteListIds.add(rawSiteListId);
        
        finalMap.set(pid, {
            peptide_id: pid,
            canonical_name: item.canonical_name,
            dose_mg: item.dose_mg,
            status: 'PENDING',
            time_of_day: item.time_of_day,
            site_label: null,
            syringe_units: null,
            mg_per_vial: null,
            bac_ml: null,
            remainingDoses: null,
            reorderDateISO: null
        });
    }

    // Apply Status from DB
    if (dbDoses) {
        for (const db of dbDoses) {
            const pid = Number(db.peptide_id);
            allPeptideIds.add(pid);
            const status = (db.status as DoseStatus) || 'PENDING';
            
            if (finalMap.has(pid)) {
                const row = finalMap.get(pid)!;
                row.status = status;
                row.dose_mg = Number(db.dose_mg);
                row.site_label = db.site_label; 
            } else {
                const pName = Array.isArray(db.peptides) ? db.peptides[0]?.canonical_name : (db.peptides as any)?.canonical_name;
                finalMap.set(pid, {
                    peptide_id: pid,
                    canonical_name: pName || `Peptide #${pid}`,
                    dose_mg: Number(db.dose_mg),
                    status: status,
                    time_of_day: null,
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

    // --- Resolve Suggested Injection Sites (Robust Distinct-Day Logic) ---
    const itemsNeedingSites = Array.from(finalMap.values())
        .filter(d => {
            const schedItem = scheduledMap.get(d.peptide_id);
            const hasList = !!schedItem?._originalItem?.site_list_id;
            const noLabel = !d.site_label;
            return noLabel && hasList;
        });
    
    if (itemsNeedingSites.length > 0 && neededSiteListIds.size > 0) {
        const listIds = Array.from(neededSiteListIds);
        
        // 1. Fetch Sites for these lists
        const { data: sitesData } = await sa
            .from('injection_sites')
            .select('list_id, name, position')
            .in('list_id', listIds)
            .order('position', { ascending: true });

        const sitesByList = new Map<number, any[]>();
        sitesData?.forEach((s: any) => {
            if (!sitesByList.has(s.list_id)) sitesByList.set(s.list_id, []);
            sitesByList.get(s.list_id)?.push(s);
        });

        // 2. Resolve ALL peptides associated with these lists (to build the full history)
        // We query protocol_items to find every peptide that uses these lists
        const { data: allLinkedItems } = await sa
            .from('protocol_items')
            .select('peptide_id, site_list_id')
            .in('site_list_id', listIds);
            
        // Map ListID -> Set of PeptideIDs
        const pidsByListId = new Map<number, Set<number>>();
        allLinkedItems?.forEach((item: any) => {
            if (!pidsByListId.has(item.site_list_id)) pidsByListId.set(item.site_list_id, new Set());
            pidsByListId.get(item.site_list_id)?.add(item.peptide_id);
        });

        // 3. Calculate "Days Injected" for each list
        // We need: Count of DISTINCT dates where any peptide in the list was taken
        const injectionCountsByList = new Map<number, number>();

        for (const listId of listIds) {
            const relevantPids = Array.from(pidsByListId.get(listId) || []);
            if (relevantPids.length === 0) continue;

            // RPC call or raw query would be ideal for "COUNT(DISTINCT date)", 
            // but for now we fetch the distinct dates (lightweight enough for single user)
            // We optimize by selecting only the 'date' column
            const { data: dates } = await sa
                .from('doses')
                .select('date')
                .eq('user_id', uid)
                .eq('status', 'TAKEN')
                .in('peptide_id', relevantPids);
            
            // Count unique dates
            const uniqueDates = new Set(dates?.map((d: any) => d.date));
            injectionCountsByList.set(listId, uniqueDates.size);
        }

        // 4. Assign Sites
        for (const row of itemsNeedingSites) {
            const item = scheduledMap.get(row.peptide_id)?._originalItem;
            const listId = item?.site_list_id;
            
            if (listId && sitesByList.has(listId)) {
                const list = sitesByList.get(listId) || [];
                if (list.length > 0) {
                    const count = injectionCountsByList.get(listId) || 0;
                    const index = count % list.length;
                    row.site_label = list[index].name;
                }
            }
        }
    }

    // Inventory & Forecast
    const finalRows = Array.from(finalMap.values());
    if (finalRows.length > 0) {
        const pids = finalRows.map(r => r.peptide_id);
        const [{ data: invVials }, { data: invCaps }] = await Promise.all([
            sa.from('inventory_items').select('*').eq('user_id', uid).in('peptide_id', pids),
            sa.from('inventory_capsules').select('*').eq('user_id', uid).in('peptide_id', pids),
        ]);

        const vialMap = new Map();
        invVials?.forEach((r: any) => vialMap.set(Number(r.peptide_id), r));
        const capMap = new Map();
        invCaps?.forEach((r: any) => capMap.set(Number(r.peptide_id), r));

        for (const row of finalRows) {
            const pid = row.peptide_id;
            const v = vialMap.get(pid);
            const c = capMap.get(pid);
            
            row.mg_per_vial = v?.mg_per_vial || null;
            row.bac_ml = v?.bac_ml || null;
            row.syringe_units = unitsFromDose(row.dose_mg, row.mg_per_vial, row.bac_ml);

            const schedItem = scheduledMap.get(pid)?._originalItem;
            if (schedItem && row.dose_mg > 0) {
                let totalMg = 0;
                if (v) totalMg += (Number(v.vials || 0) * Number(v.mg_per_vial || 0)) - Number(v.current_used_mg || 0);
                if (c) totalMg += (Number(c.bottles || 0) * Number(c.caps_per_bottle || 0) * Number(c.mg_per_cap || 0)) - Number(c.current_used_mg || 0);
                totalMg = Math.max(0, totalMg);

                const f = forecastRemainingDoses(
                    totalMg,
                    row.dose_mg,
                    schedItem.schedule as Schedule,
                    schedItem.custom_days ?? null,
                    Number(schedItem.cycle_on_weeks || 0),
                    Number(schedItem.cycle_off_weeks || 0),
                    schedItem.every_n_days ?? null
                );
                row.remainingDoses = f.remainingDoses;
                row.reorderDateISO = f.reorderDateISO;
            }
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

async function upsertDoseStatus(peptide_id: number, dateISO: string, targetStatus: DoseStatus, siteLabel?: string | null) {
    const sa = createServerActionSupabase();
    const { data: { user } } = await sa.auth.getUser();
    if (!user) throw new Error('Not signed in');

    // Link to Best Protocol
    const { data: protocols } = await sa.from('protocols').select('id,start_date,end_date, protocol_items(peptide_id)').eq('user_id', user.id);
    const validProtos = (protocols || []).filter((p: any) => {
        const start = p.start_date;
        const end = p.end_date || '9999-12-31';
        return start <= dateISO && end >= dateISO;
    });
    const match = validProtos.find((p: any) => p.protocol_items?.some((pi: any) => pi.peptide_id === peptide_id));
    const protocolId = match?.id || validProtos[0]?.id || null;

    // Check Existing (Loose Lookup)
    const { data: existing } = await sa
        .from('doses')
        .select('id, status, dose_mg, site_label')
        .eq('user_id', user.id)
        .eq('peptide_id', peptide_id)
        .eq('date_for', dateISO)
        .maybeSingle();

    const currentStatus = existing?.status || 'PENDING';
    if (currentStatus === targetStatus && existing?.site_label === siteLabel) return;

    let doseAmount = existing?.dose_mg ? Number(existing.dose_mg) : 0;
    if (!doseAmount && protocolId) {
         const { data: pi } = await sa.from('protocol_items').select('dose_mg_per_administration').eq('protocol_id', protocolId).eq('peptide_id', peptide_id).maybeSingle();
         doseAmount = Number(pi?.dose_mg_per_administration || 0);
    }

    if (targetStatus === 'TAKEN' && currentStatus !== 'TAKEN') await updateInventoryUsage(sa, user.id, peptide_id, doseAmount);
    else if (currentStatus === 'TAKEN' && targetStatus !== 'TAKEN') await updateInventoryUsage(sa, user.id, peptide_id, -doseAmount);

    if (!existing?.id) {
        await sa.from('doses').insert({
            user_id: user.id,
            protocol_id: protocolId, 
            peptide_id,
            date: dateISO,
            date_for: dateISO,
            dose_mg: doseAmount,
            status: targetStatus,
            site_label: siteLabel || null, 
        });
    } else {
        const updateData: any = { status: targetStatus };
        if (siteLabel !== undefined) updateData.site_label = siteLabel;
        
        await sa.from('doses').update(updateData).eq('id', existing.id);
    }

    revalidatePath('/today');
    revalidatePath('/calendar');
}

export async function logDose(peptide_id: number, dateISO: string, siteLabel?: string | null) { 
    'use server'; 
    await upsertDoseStatus(peptide_id, dateISO, 'TAKEN', siteLabel); 
}

export async function skipDose(peptide_id: number, dateISO: string) { 
    'use server'; 
    await upsertDoseStatus(peptide_id, dateISO, 'SKIPPED'); 
}

export async function resetDose(peptide_id: number, dateISO: string) { 
    'use server'; 
    await upsertDoseStatus(peptide_id, dateISO, 'PENDING'); 
}
