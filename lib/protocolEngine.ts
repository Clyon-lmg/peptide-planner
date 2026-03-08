"use client";

import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

export type Schedule = "EVERYDAY" | "WEEKDAYS" | "CUSTOM" | "EVERY_N_DAYS";

export type ActivationResult = {
  ok: true;
  leftover?: number;
};

// ... (Helper functions localDateStr, addDays, etc. stay the same) ...
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

export async function onProtocolUpdated(protocolId: number, userId: string) {
  // Trigger regeneration
  return setActiveProtocolAndRegenerate(protocolId, userId);
}

export async function setActiveProtocolAndRegenerate(
  protocolId: number,
  userId: string,
  getSupabase: () => any = getSupabaseBrowser,
): Promise<ActivationResult> {
  const supabase = getSupabase();
  
  // 1. Fetch Protocol Details
  const { data: proto, error: pErr } = await supabase
    .from("protocols")
    .select("start_date, end_date")
    .eq("id", protocolId)
    .single();
  if (pErr) throw pErr;

  // Default start to today if missing, End can be null (forever)
  const todayStr = localDateStr(new Date());
  const startDateStr = proto.start_date || todayStr;

  // Compute tomorrowStr using local date (same as how the UI displays dates)
  const tDate = new Date();
  tDate.setDate(tDate.getDate() + 1);
  const tomorrowStr = localDateStr(tDate);

  // 2. Clear FUTURE Pending Doses Only
  const { error: delErr } = await supabase
    .from("doses")
    .delete()
    .eq("protocol_id", protocolId)
    .eq("status", "PENDING")
    .gte("date_for", tomorrowStr);
  if (delErr) throw delErr;

  // 3. Fetch Items
  const itemsRes = await supabase
    .from("protocol_items")
    .select("*")
    .eq("protocol_id", protocolId);
  if (itemsRes.error) throw itemsRes.error;
  const items = itemsRes.data || [];

  // 4. Generate Doses
  const inserts: any[] = [];

  // genStartStr: later of protocol start or tomorrow (string comparison works for ISO dates)
  const genStartStr = startDateStr >= tomorrowStr ? startDateStr : tomorrowStr;

  // If protocol has already ended, don't generate anything
  if (proto.end_date && proto.end_date < todayStr) {
    return { ok: true };
  }

  // All date arithmetic uses UTC midnight to match scheduleEngine.ts
  const genStart = new Date(genStartStr + "T00:00:00Z");
  const trueStart = new Date(startDateStr + "T00:00:00Z");

  // Generate for 1 year out, or until End Date
  let daysToGen = 365;
  if (proto.end_date) {
    const end = new Date(proto.end_date + "T00:00:00Z");
    const diff = Math.floor((end.getTime() - genStart.getTime()) / (24 * 60 * 60 * 1000));
    daysToGen = Math.min(365, diff + 1); // +1 to include end date
  }

  if (daysToGen <= 0) return { ok: true };

  items.forEach((it: any) => {
    const onWeeks = Number(it.cycle_on_weeks || 0);
    const offWeeks = Number(it.cycle_off_weeks || 0);
    const cycleLenDays = (onWeeks + offWeeks) * 7;

    for (const d of dateRangeDays(genStart, daysToGen)) {
      // Elapsed days from protocol start — uses Math.floor to match scheduleEngine.ts exactly
      const elapsed = Math.floor((d.getTime() - trueStart.getTime()) / (24 * 60 * 60 * 1000));

      // 1. Cycle Logic
      if (cycleLenDays > 0 && elapsed % cycleLenDays >= onWeeks * 7) continue;

      // 2. Schedule Logic — use UTC day-of-week to match isDoseDayUTC
      const dow = d.getUTCDay();
      if (it.schedule === "WEEKDAYS" && (dow === 0 || dow === 6)) continue;
      if (it.schedule === "CUSTOM") {
        if (!(it.custom_days || []).includes(dow)) continue;
      }
      if (it.schedule === "EVERY_N_DAYS") {
        const n = Number(it.every_n_days || 0);
        if (n <= 0 || elapsed % n !== 0) continue;
      }

      // 3. Titration Logic
      const baseDose = it.dose_mg_per_administration;
      let dose = baseDose;
      const interval = Number(it.titration_interval_days || 0);
      const amount = Number(it.titration_amount_mg || 0);
      const target = Number(it.titration_target_mg || 0);

      if (interval > 0 && amount > 0) {
        dose = baseDose + Math.floor(elapsed / interval) * amount;
        if (target > 0 && dose > target) dose = target;
      }

      // UTC ISO date string — consistent with scheduleEngine and calendar
      const ds = d.toISOString().slice(0, 10);

      inserts.push({
        user_id: userId,
        protocol_id: protocolId,
        peptide_id: it.peptide_id,
        dose_mg: dose,
        date: ds,
        date_for: ds,
        status: "PENDING",
        site_label: null,
      });
    }
  });

  // Batch Insert
  if (inserts.length > 0) {
    const { error } = await supabase.from("doses").upsert(inserts, { 
      onConflict: "user_id,protocol_id,peptide_id,date" 
    });
    if (error) throw error;
  }

  return { ok: true };
}
