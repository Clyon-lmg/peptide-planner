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
  
  // 2. Clear FUTURE Pending Doses Only
  // We do NOT touch 'LOGGED' doses. History is sacred.
  // We also don't touch today's doses if they are already there, to prevent flickering.
  // We strictly regenerate from "Tomorrow" onwards, OR "Start Date" if it's in the future.
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const tomorrowStr = localDateStr(tomorrow);

  const { error: delErr } = await supabase
    .from("doses")
    .delete()
    .eq("protocol_id", protocolId)
    .eq("status", "PENDING") // Only delete pending
    .gte("date_for", tomorrowStr); // Only future
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
  
  // Determine generation window
  // Start from the LATER of: Protocol Start Date OR Tomorrow
  // (Because we don't want to rewrite history or mess with today's logged status)
  let genStart = new Date(startDateStr);
  if (genStart < tomorrow) genStart = tomorrow;

  // If Protocol has passed (End Date < Now), don't generate anything
  if (proto.end_date && new Date(proto.end_date) < today) {
    return { ok: true };
  }

  // Generate for 1 year out, or until End Date
  let daysToGen = 365;
  if (proto.end_date) {
    const end = new Date(proto.end_date);
    const diff = Math.ceil((end.getTime() - genStart.getTime()) / (1000 * 60 * 60 * 24));
    daysToGen = Math.min(daysToGen, diff + 1); // +1 to include end date
  }

  if (daysToGen <= 0) return { ok: true };

  // Calculate "Elapsed Days" relative to the TRUE Start Date (for cycles/titration)
  const trueStart = new Date(startDateStr);
  
  items.forEach((it: any) => {
    // ... (Cycle/Schedule logic matches your existing code) ...
    const onWeeks = Number(it.cycle_on_weeks || 0);
    const offWeeks = Number(it.cycle_off_weeks || 0);
    const cycleLenDays = (onWeeks + offWeeks) * 7;
    
    // Iterate our generation window
    for (const d of dateRangeDays(genStart, daysToGen)) {
      // Calculate elapsed days from the Protocol START (not generation start)
      // This ensures cycles align with the start date, even if we are generating mid-protocol
      const diffTime = Math.abs(d.getTime() - trueStart.getTime());
      const elapsed = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

      // 1. Cycle Logic
      if (cycleLenDays > 0) {
        const inOn = elapsed % cycleLenDays < onWeeks * 7;
        if (!inOn) continue;
      }
      
      // 2. Schedule Logic
      if (it.schedule === "WEEKDAYS" && isWeekend(d)) continue;
      if (it.schedule === "CUSTOM") {
        if (!isCustomDay(d, it.custom_days || [])) continue;
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

      const ds = localDateStr(d);
      
      inserts.push({
        user_id: userId,
        protocol_id: protocolId,
        peptide_id: it.peptide_id,
        dose_mg: dose,
        date: ds,
        date_for: ds,
        status: "PENDING",
        site_label: null // simplified for brevity
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
