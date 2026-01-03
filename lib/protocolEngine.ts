"use client";

import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

export type Schedule = "EVERYDAY" | "WEEKDAYS" | "CUSTOM" | "EVERY_N_DAYS";

export type ActivationResult = {
  ok: true;
  /** Number of leftover future doses that could not be deleted. */
  leftover?: number;
};

type ProtocolItem = {
  id: number;
  protocol_id: number;
  peptide_id: number;
  dose_mg_per_administration: number;
  schedule: Schedule;
  custom_days: number[] | null;
  cycle_on_weeks: number;
  cycle_off_weeks: number;
  every_n_days: number | null;
  titration_interval_days: number | null;
  titration_amount_mg: number | null;
  site_list_id: number | null;
};

function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
function isWeekend(d: Date) { const x = d.getDay(); return x===0 || x===6; }
function* dateRangeDays(start: Date, days: number) { for (let i=0;i<days;i++) yield addDays(start,i); }
function isCustomDay(d: Date, custom: number[]) { return custom.includes(d.getDay()); }

export async function onProtocolUpdated(protocolId: number, _userId: string) {
  const supabase = getSupabaseBrowser();
  const todayStr = localDateStr();
  // Safe update: Only clear Today + Future. History (Yesterday and back) is safe.
  const { error: delErr } = await supabase
    .from("doses")
    .delete()
    .gte("date_for", todayStr) 
    .eq("protocol_id", protocolId);
  if (delErr) throw delErr;
}

export async function setActiveProtocolAndRegenerate(
  protocolId: number,
  _userId: string,
  getSupabase: () => any = getSupabaseBrowser,
): Promise<ActivationResult> {
  const supabase = getSupabase();
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess?.session?.user?.id;
  if (!uid) throw new Error("No session");
  
  const today = new Date();
  const todayStr = localDateStr(today);
  
  // 🛡️ CUTOFF: We only touch doses starting Tomorrow.
  // This preserves "Today" (if you already logged it) and all History.
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = localDateStr(tomorrow);

  const { data: startData, error: startErr } = await supabase
    .from("protocols")
    .select("start_date")
    .eq("id", protocolId);
  if (startErr) throw startErr;
  
  let startDateStr = startData?.[0]?.start_date as string | null;
  const needsStartDateUpdate = !startDateStr;
  if (!startDateStr) startDateStr = todayStr;

  // Deactivate others; activate this protocol
  let r = await supabase.from("protocols").update({ is_active: false }).neq("id", protocolId); if (r.error) throw r.error;
  r = await supabase.from("protocols").update({ is_active: true }).eq("id", protocolId); if (r.error) throw r.error;
  if (needsStartDateUpdate) {
    r = await supabase.from("protocols").update({ start_date: startDateStr }).eq("id", protocolId); if (r.error) throw r.error;
  }

  // Fetch items
  const itemsRes = await supabase
    .from("protocol_items")
    .select("id, protocol_id, peptide_id, dose_mg_per_administration, schedule, custom_days, cycle_on_weeks, cycle_off_weeks, every_n_days, titration_interval_days, titration_amount_mg, site_list_id")
    .eq("protocol_id", protocolId);
  if (itemsRes.error) throw itemsRes.error;
  const items = itemsRes.data || [];

  // Load injection site lists for items
  const siteMap = new Map<number, string[]>();
  const siteListIds = Array.from(new Set(items.map((it: any) => it.site_list_id).filter((id: number | null) => id)));
  if (siteListIds.length) {
    const { data: sites, error: sitesErr } = await supabase
      .from("injection_sites")
      .select("list_id,name,position")
      .in("list_id", siteListIds)
      .order("position", { ascending: true });
    if (sitesErr) throw sitesErr;
    (sites || []).forEach((row: any) => {
      if (!siteMap.has(row.list_id)) siteMap.set(row.list_id, []);
      siteMap.get(row.list_id)!.push(row.name);
    });
  }

  // 🛡️ SAFE DELETE: Only delete FUTURE doses (Tomorrow+). 
  // Never touch History or Today.
  const del = await supabase
    .from("doses")
    .delete()
    .or(`date.gte.${tomorrowStr},date_for.gte.${tomorrowStr}`)
    .eq("protocol_id", protocolId)
    .eq("user_id", uid);
  if (del.error) throw del.error;

  const { count: remaining, error: remErr } = await supabase
    .from("doses")
    .select("*", { head: true, count: "exact" })
    .or(`date.gte.${tomorrowStr},date_for.gte.${tomorrowStr}`)
    .eq("protocol_id", protocolId)
    .eq("user_id", uid);
  if (remErr) throw remErr;
  const result: ActivationResult = { ok: true };
  if (remaining) result.leftover = remaining;

  // Generate 12 months from NOW (not just from start date)
  const start = new Date(startDateStr! + "T00:00:00");
  
  // Calculate how many days we need to simulate to reach "Today + 1 Year"
  // If protocol started 2 years ago, we need to sim ~3 years to get 1 year of future data.
  const oneDay = 24 * 60 * 60 * 1000;
  const daysSinceStart = Math.max(0, Math.floor((today.getTime() - start.getTime()) / oneDay));
  const daysToGenerate = daysSinceStart + 365; 

  const inserts: any[] = [];

  items.forEach((it: any) => {
    const onWeeks = Number(it.cycle_on_weeks || 0);
    const offWeeks = Number(it.cycle_off_weeks || 0);
    const cycleLenDays = (onWeeks + offWeeks) * 7;
    let elapsed = 0;
    const sites = it.site_list_id ? siteMap.get(it.site_list_id) || [] : [];
    
    for (const d of dateRangeDays(start, daysToGenerate)) {
      // 1. Cycle Logic
      if (cycleLenDays > 0) {
        const inOn = elapsed % cycleLenDays < onWeeks * 7;
        if (!inOn) { elapsed++; continue; }
      }
      // 2. Schedule Logic
      if (it.schedule === "WEEKDAYS" && isWeekend(d)) { elapsed++; continue; }
      if (it.schedule === "CUSTOM") {
        const arr = (it.custom_days || []) as number[];
        if (!isCustomDay(d, arr)) { elapsed++; continue; }
      }
      if (it.schedule === "EVERY_N_DAYS") {
        const n = Number(it.every_n_days || 0);
        if (n <= 0 || elapsed % n !== 0) { elapsed++; continue; }
      }

      // 3. 🛡️ HISTORY PROTECTION:
      // Even though we calculate the dose/state for past dates (to keep cycles correct),
      // we SKIP adding them to the database if they are in the past.
      const ds = localDateStr(d);
      if (ds < tomorrowStr) { 
          elapsed++; 
          continue; 
      }

      const baseDose = it.dose_mg_per_administration;
      let dose = baseDose;
      const interval = Number(it.titration_interval_days || 0);
      const amount = Number(it.titration_amount_mg || 0);
      if (interval > 0 && amount > 0) {
        dose = baseDose + Math.floor(elapsed / interval) * amount;
      }
      let site_label: string | null = null;
      if (sites.length) site_label = sites[elapsed % sites.length];
      
      inserts.push({
        protocol_id: protocolId,
        peptide_id: it.peptide_id,
        dose_mg: dose,
        date: ds,
        date_for: ds,
        status: "PENDING",
        site_label,
      });
      elapsed++;
    }
  });

  // Deduplicate and Upsert
  const unique = new Map<string, any>();
  for (const row of inserts) {
    const key = `${row.peptide_id}|${row.date}`;
    const prev = unique.get(key);
    if (prev) {
      prev.dose_mg += row.dose_mg;
      if (row.site_label != null) prev.site_label = row.site_label;
    } else {
      unique.set(key, { ...row });
    }
  }
  const deduped = Array.from(unique.values());

  for (let i = 0; i < deduped.length; i += 1000) {
    const chunk = deduped.slice(i, i + 1000);    
    const ins = await supabase
      .from("doses")
      .upsert(chunk, {
        onConflict: "user_id,protocol_id,peptide_id,date",
      });
    if (ins.error?.code === "23505") {
      console.debug("Duplicate dose insertion skipped", ins.error);
    } else if (ins.error) {
      throw ins.error;
    }
   }

  return result;
}
