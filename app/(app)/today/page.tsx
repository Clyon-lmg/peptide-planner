
"use client";
import React from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type Dose = {
  id: number;
  protocol_id: number;
  peptide_id: number;
  dose_mg: number;
  date: string;
  date_for: string;
  status: "PENDING" | "TAKEN" | "SKIPPED";
  peptides?: { id: number; canonical_name: string } | null;
};

function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function pill(status: "PENDING" | "TAKEN" | "SKIPPED") {
  if (status === "TAKEN") return "bg-emerald-600 text-white";
  if (status === "SKIPPED") return "bg-red-600 text-white";
  return "bg-blue-600 text-white";
}

export default function TodayPage() {
  const supabase = React.useMemo(() => createClientComponentClient(), []);
  const [doses, setDoses] = React.useState<Dose[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    const todayStr = localDateStr();
    const { data, error } = await supabase
      .from("doses")
      .select("id, protocol_id, peptide_id, dose_mg, date, date_for, status, peptides:peptide_id ( id, canonical_name )")
      .eq("date_for", todayStr)
      .order("peptide_id", { ascending: true });
    if (error) { console.error(error); setLoading(false); return; }
    setDoses((data || []) as any);
    setLoading(false);
  }, [supabase]);

  React.useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange((_e,_s)=>load());
    return () => { sub?.subscription.unsubscribe(); };
  }, [load, supabase]);

  const setStatus = async (id: number, status: "PENDING" | "TAKEN" | "SKIPPED") => {
    const { data, error } = await supabase
      .from("doses")
      .update({ status })
      .eq("id", id)
      .select("id, status")
      .single();
    if (error) { console.error(error); return; }
    const accepted = (data?.status || status) as "PENDING" | "TAKEN" | "SKIPPED";
    setDoses(prev => prev.map(d => d.id === id ? { ...d, status: accepted } : d));
  };

  if (loading) return <div className="max-w-4xl mx-auto p-4">Loading today…</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Today</h1>
      {doses.length === 0 ? (
        <div className="text-gray-500 border rounded-xl p-6">No doses scheduled for today.</div>
      ) : (
        <ul className="space-y-2">
          {doses.map((d) => (
            <li key={d.id} className="flex items-center justify-between border rounded-xl p-3">
              <div>
                <div className="font-semibold">{d.peptides?.canonical_name ?? `Peptide #${d.peptide_id}`}</div>
                <div className="text-sm text-gray-600">{d.dose_mg} mg</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded ${pill(d.status)}`}>{d.status}</span>
                <button
                  className="px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => setStatus(d.id, "TAKEN")}
                >
                  Taken
                </button>
                <button
                  className="px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                  onClick={() => setStatus(d.id, "SKIPPED")}
                >
                  Skipped
                </button>
                <button
                  className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => setStatus(d.id, "PENDING")}
                >
                  Reset
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
