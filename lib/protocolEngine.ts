
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
  const { error: delErr } = await supabase
    .from("doses")
    .delete()
    .gte("date_for", todayStr) // include today
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

  const startDateStr = localDateStr();

  // Deactivate others; activate this protocol
  let r = await supabase.from("protocols").update({ is_active: false }).neq("id", protocolId); if (r.error) throw r.error;
  r = await supabase.from("protocols").update({ is_active: true }).eq("id", protocolId); if (r.error) throw r.error;
  r = await supabase.from("protocols").update({ start_date: startDateStr }).eq("id", protocolId); if (r.error) throw r.error;

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

  // Clear future doses for this protocol based on the scheduled date (date_for),
  // ensuring uniqueness on (user_id, protocol_id, peptide_id, date). Past doses
  // remain intact for historical reference.
  const del = await supabase
    .from("doses")
    .delete()
    .or(`date.gte.${startDateStr},date_for.gte.${startDateStr}`)
    .eq("protocol_id", protocolId)
    .eq("user_id", uid);
  if (del.error) throw del.error;

  const { count: remaining, error: remErr } = await supabase
    .from("doses")
    .select("*", { head: true, count: "exact" })
    .or(`date.gte.${startDateStr},date_for.gte.${startDateStr}`)
    .eq("protocol_id", protocolId)
    .eq("user_id", uid);
  if (remErr) throw remErr;
  const result: ActivationResult = { ok: true };
  if (remaining) result.leftover = remaining;

  // Generate 12 months
  const start = new Date(startDateStr + "T00:00:00");
  const days = 365;
  const inserts: any[] = [];

  items.forEach((it: any) => {
    const onWeeks = Number(it.cycle_on_weeks || 0);
    const offWeeks = Number(it.cycle_off_weeks || 0);
    const cycleLenDays = (onWeeks + offWeeks) * 7;
    let elapsed = 0;
    const sites = it.site_list_id ? siteMap.get(it.site_list_id) || [] : [];
    for (const d of dateRangeDays(start, days)) {
      if (cycleLenDays > 0) {
        const inOn = elapsed % cycleLenDays < onWeeks * 7;
        if (!inOn) { elapsed++; continue; }
      }
      if (it.schedule === "WEEKDAYS" && isWeekend(d)) { elapsed++; continue; }
      if (it.schedule === "CUSTOM") {
        const arr = (it.custom_days || []) as number[];
        if (!isCustomDay(d, arr)) { elapsed++; continue; }
      }
      if (it.schedule === "EVERY_N_DAYS") {
        const n = Number(it.every_n_days || 0);
        if (n <= 0 || elapsed % n !== 0) { elapsed++; continue; }
      }
      const ds = localDateStr(d);
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

  // Deduplicate by (peptide_id, date) to avoid Postgres error when the
  // same row appears multiple times within a single upsert call. When
  // duplicates occur we merge them, summing doses and keeping the last
  // non-null site label.
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
    const chunk = deduped.slice(i, i + 1000);    const ins = await supabase
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