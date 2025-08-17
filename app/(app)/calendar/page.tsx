
"use client";
import React from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type Dose = { id: number; date_for: string; status: "PENDING" | "TAKEN" | "SKIPPED"; dose_mg: number; peptide_id: number; peptides?: { id:number; canonical_name:string } | null };

function localDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function addDays(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }

function badgeClassForDay(statuses: ("PENDING"|"TAKEN"|"SKIPPED")[]) {
  if (statuses.some(s => s === "SKIPPED")) return "bg-red-100 text-red-800";
  if (statuses.length > 0 && statuses.every(s => s === "TAKEN")) return "bg-emerald-100 text-emerald-800";
  return "bg-blue-100 text-blue-800";
}

function pillClass(status: "PENDING"|"TAKEN"|"SKIPPED") {
  if (status === "SKIPPED") return "bg-red-100 text-red-800";
  if (status === "TAKEN") return "bg-emerald-100 text-emerald-800";
  return "bg-blue-100 text-blue-800";
}

export default function CalendarPage() {
  const supabase = React.useMemo(() => createClientComponentClient(), []);
  const [cursor, setCursor] = React.useState(new Date());
  const [byDayStatuses, setByDayStatuses] = React.useState<Record<string, ("PENDING"|"TAKEN"|"SKIPPED")[]>>({});
  const [selected, setSelected] = React.useState<Date>(new Date());
  const [selectedDoses, setSelectedDoses] = React.useState<Dose[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingList, setLoadingList] = React.useState(false);

  const loadMonth = React.useCallback(async (d: Date) => {
    setLoading(true);
    const start = startOfMonth(d);
    const end = endOfMonth(d);
    const { data, error } = await supabase
      .from("doses")
      .select("id, date_for, status")
      .gte("date_for", localDateStr(start))
      .lte("date_for", localDateStr(end));
    if (error) { console.error(error); setLoading(false); return; }
    const map: Record<string, ("PENDING"|"TAKEN"|"SKIPPED")[]> = {};
    (data || []).forEach((row: any) => {
      const k = row.date_for;
      if (!map[k]) map[k] = [];
      map[k].push((row.status as "PENDING"|"TAKEN"|"SKIPPED") || "PENDING");
    });
    setByDayStatuses(map);
    setLoading(false);
  }, [supabase]);

  const loadDay = React.useCallback(async (d: Date) => {
    setLoadingList(true);
    const key = localDateStr(d);
    const { data, error } = await supabase
      .from("doses")
      .select("id, date_for, status, dose_mg, peptide_id, peptides:peptide_id ( id, canonical_name )")
      .eq("date_for", key)
      .order("peptide_id", { ascending: true });
    if (error) { console.error(error); setLoadingList(false); return; }
    setSelectedDoses((data || []) as any);
    setLoadingList(false);
  }, [supabase]);

  React.useEffect(() => { loadMonth(cursor); }, [cursor, loadMonth]);
  React.useEffect(() => { loadDay(selected); }, [selected, loadDay]);

  const start = startOfMonth(cursor);
  const firstDow = start.getDay();
  const gridStart = addDays(start, -firstDow);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) days.push(addDays(gridStart, i));

  const isSameMonth = (a: Date, b: Date) => a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const isToday = (d: Date) => localDateStr(d) === localDateStr(new Date());
  const isSelected = (d: Date) => localDateStr(d) === localDateStr(selected);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex gap-2">
          <button className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300" onClick={() => { const t = new Date(); setCursor(t); setSelected(t); }}>Today</button>
          <button className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth()-1, 1))}>Prev</button>
          <button className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth()+1, 1))}>Next</button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-sm font-semibold mb-2">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((w) => (
          <div key={w} className="text-center">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((d, idx) => {
          const key = localDateStr(d);
          const statuses = byDayStatuses[key] || [];
          const badgeClass = badgeClassForDay(statuses);
          const count = statuses.length;
          const inMonth = isSameMonth(d, cursor);
          const selectedClass = isSelected(d) ? "ring-2 ring-blue-500" : "";
          const todayClass = isToday(d) ? "border-blue-500" : "border-gray-200";

          return (
            <button
              key={idx}
              className={`h-24 border ${todayClass} rounded-lg p-2 flex flex-col justify-between text-left ${inMonth ? "" : "opacity-40"} ${selectedClass}`}
              onClick={() => setSelected(d)}
            >
              <div className="text-xs">{d.getDate()}</div>
              {loading ? (
                <div className="text-xs text-gray-400">…</div>
              ) : count > 0 ? (
                <div className={`text-xs rounded px-2 py-1 self-start ${badgeClass}`}>{count} dose{count>1?"s":""}</div>
              ) : (
                <div className="text-xs text-gray-400">none</div>
              )}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border p-3">
        <h2 className="font-semibold mb-2">Doses on {localDateStr(selected)}</h2>
        {loadingList ? (
          <div className="text-gray-500">Loading…</div>
        ) : selectedDoses.length === 0 ? (
          <div className="text-gray-500">No doses scheduled.</div>
        ) : (
          <ul className="space-y-2">
            {selectedDoses.map((d) => (
              <li key={d.id} className="flex items-center justify-between border rounded-xl p-3">
                <div>
                  <div className="font-medium">{d.peptides?.canonical_name ?? `Peptide #${d.peptide_id}`}</div>
                  <div className="text-xs text-gray-600">{d.dose_mg} mg</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${pillClass(d.status)}`}>{d.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
