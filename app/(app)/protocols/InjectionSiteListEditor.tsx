"use client";
import React from "react";
import Card from "@/components/layout/Card";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

type InjectionSiteList = {
  id: number;
  user_id: string;
  name: string;
};

export default function InjectionSiteListEditor({
  list,
  onReload,
}: {
  list: InjectionSiteList;
  onReload: () => void;
}) {
  const supabase = React.useMemo(() => getSupabaseBrowser(), []);
  const [sites, setSites] = React.useState<string[]>(Array(7).fill(""));
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("injection_sites")
        .select("name, position")
        .eq("list_id", list.id)
        .order("position", { ascending: true });
      if (!error && data) {
        const next = Array(7).fill("");
        data.forEach((row: any, idx: number) => {
          next[idx] = row.name || "";
        });
        setSites(next);
      }
    })();
  }, [list.id, supabase]);

  const updateSite = (idx: number, value: string) => {
    setSites((prev) => {
      const copy = [...prev];
      copy[idx] = value;
      return copy;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const { error: delErr } = await supabase
        .from("injection_sites")
        .delete()
        .eq("list_id", list.id);
      if (delErr) throw delErr;

      const rows = sites
        .map((name, idx) => ({ list_id: list.id, name, position: idx }))
        .filter((r) => r.name.trim().length > 0);
      if (rows.length) {
        const { error: insErr } = await supabase
          .from("injection_sites")
          .insert(rows);
        if (insErr) throw insErr;
      }
      await onReload();
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Failed to save sites.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="pp-h2 mb-3">{list.name}</h3>
        <div className="space-y-2">
          {sites.map((val, idx) => (
            <input
              key={idx}
              className="input w-full"
              placeholder={`Site ${idx + 1}`}
              value={val}
              onChange={(e) => updateSite(idx, e.target.value)}
            />
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            className="btn bg-info hover:bg-info/90 text-white disabled:opacity-60"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </Card>
    </div>
  );
}
