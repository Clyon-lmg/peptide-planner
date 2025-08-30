
"use client";

import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

export type Schedule = "EVERYDAY" | "WEEKDAYS" | "CUSTOM" | "EVERY_N_DAYS";

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

export async function setActiveProtocolAndRegenerate(protocolId: number, _userId: string) {
  const supabase = getSupabaseBrowser();
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
    .select("id, protocol_id, peptide_id, dose_mg_per_administration, schedule, custom_days, cycle_on_weeks, cycle_off_weeks, every_n_days")
    .eq("protocol_id", protocolId);
  if (itemsRes.error) throw itemsRes.error;
  const items = itemsRes.data || [];

  // Clear future doses for this protocol, ensuring uniqueness on (user_id, protocol_id, peptide_id, date)
  const del = await supabase
    .from("doses")
    .delete()
    .gte("date", startDateStr)
    .eq("protocol_id", protocolId)
    .eq("user_id", uid);
  if (del.error) throw del.error;

  const { count: remaining, error: remErr } = await supabase
    .from("doses")
    .select("*", { head: true, count: "exact" })
    .gte("date", startDateStr)
    .eq("protocol_id", protocolId)
    .eq("user_id", uid);
  if (remErr) throw remErr;
  if (remaining) throw new Error("Existing doses remain after cleanup");

  // Generate 12 months
  const start = new Date(startDateStr + "T00:00:00");
  const days = 365;
  const inserts: any[] = [];

  items.forEach((it: any) => {
    const onWeeks = Number(it.cycle_on_weeks || 0);
    const offWeeks = Number(it.cycle_off_weeks || 0);
    const cycleLenDays = (onWeeks + offWeeks) * 7;
    let idx = 0;
    for (const d of dateRangeDays(start, days)) {
      if (cycleLenDays > 0) {
        const inOn = idx % cycleLenDays < onWeeks * 7;
        if (!inOn) { idx++; continue; }
      }
      if (it.schedule === "WEEKDAYS" && isWeekend(d)) { idx++; continue; }
      if (it.schedule === "CUSTOM") {
        const arr = (it.custom_days || []) as number[];
        if (!isCustomDay(d, arr)) { idx++; continue; }
      }
            if (it.schedule === "EVERY_N_DAYS") {
        const n = Number(it.every_n_days || 0);
        if (n <= 0 || idx % n !== 0) { idx++; continue; }
      }
      const ds = localDateStr(d);
      inserts.push({
        protocol_id: protocolId,
        peptide_id: it.peptide_id,
        dose_mg: it.dose_mg_per_administration,
        date: ds,
        date_for: ds,
        status: "PENDING",
        user_id: null, // trigger will set auth.uid()
      });
      idx++;
    }
  });

  for (let i=0;i<inserts.length;i+=1000) {
    const chunk = inserts.slice(i, i+1000);
    const ins = await supabase.from("doses").insert(chunk);
    if (ins.error) throw ins.error;
  }

  return true;
}
