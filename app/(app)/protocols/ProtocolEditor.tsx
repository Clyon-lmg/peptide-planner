"use client";
import React, { useEffect, useState } from "react";
import ProtocolItemRow, { ProtocolItemState, InventoryPeptide } from "./ProtocolItemRow";
import ProtocolGraph from "./ProtocolGraph";
import { onProtocolUpdated, setActiveProtocolAndRegenerate } from "@/lib/protocolEngine";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

const COLOR_PALETTE = [
  "#f87171",
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#a78bfa",
  "#f472b6",
  "#38bdf8",
  "#fb923c",
];

type Protocol = {
  id: number;
  user_id: string;
  is_active: boolean;
  name: string;
  start_date: string;
};

export default function ProtocolEditor({ protocol, onReload }: {
  protocol: Protocol;
  onReload: () => void;
}) {
  const supabase = React.useMemo(() => getSupabaseBrowser(), []);
  const [items, setItems] = useState<ProtocolItemState[]>([]);
  const [peptides, setPeptides] = useState<InventoryPeptide[]>([]);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: rawItems, error: itemsErr } = await supabase
        .from("protocol_items")
        .select("*")
        .eq("protocol_id", protocol.id)
        .order("id", { ascending: true });
      if (itemsErr) console.error(itemsErr);

const mapped: ProtocolItemState[] = (rawItems || []).map((r: any, idx: number) => ({
        id: r.id,
        peptide_id: r.peptide_id,
        dose_mg_per_administration: Number(r.dose_mg_per_administration || 0),
        schedule: (r.schedule || "EVERYDAY") as any,
        custom_days: r.custom_days || [],
        cycle_on_weeks: Number(r.cycle_on_weeks || 0),
        cycle_off_weeks: Number(r.cycle_off_weeks || 0),
        every_n_days: r.every_n_days ? Number(r.every_n_days) : null,
        color: r.color || COLOR_PALETTE[idx % COLOR_PALETTE.length],
    }));
      setItems(mapped);

      const { data: vialInv } = await supabase
        .from("inventory_items")
        .select("peptide_id, half_life_hours, peptides:peptide_id ( id, canonical_name )");
      const { data: capInv } = await supabase
        .from("inventory_capsules")
        .select("peptide_id, half_life_hours, peptides:peptide_id ( id, canonical_name )");

      const merged: Record<number, InventoryPeptide> = {};
      (vialInv || []).forEach((row: any) => {
        if (row.peptides)
          merged[row.peptides.id] = {
            id: row.peptides.id,
            canonical_name: row.peptides.canonical_name,
            half_life_hours: Number(row.half_life_hours || 0),
          };
          });
      (capInv || []).forEach((row: any) => {
        if (row.peptides)
          merged[row.peptides.id] = {
            id: row.peptides.id,
            canonical_name: row.peptides.canonical_name,
            half_life_hours: Number(row.half_life_hours || 0),
          };
          });
      setPeptides(Object.values(merged).sort((a, b) => a.canonical_name.localeCompare(b.canonical_name)));
    })();
  }, [protocol.id, supabase]);

  const addItem = () => {
    setItems(prev => {
      const nextColor = COLOR_PALETTE[prev.length % COLOR_PALETTE.length];
      return [
        ...prev,
        {
          peptide_id: null,
          dose_mg_per_administration: 0,
          schedule: "EVERYDAY",
          custom_days: [],
          cycle_on_weeks: 0,
          cycle_off_weeks: 0,
          every_n_days: 1,
          color: nextColor,
        },
      ];
    });
    };

  const save = async () => {
    setSaving(true);
    try {
      const { error: delErr } = await supabase
        .from("protocol_items")
        .delete()
        .eq("protocol_id", protocol.id);
      if (delErr) throw delErr;

      const rows = items
        .filter(i => i.peptide_id)
        .map(i => ({
          protocol_id: protocol.id,
          peptide_id: i.peptide_id,
          dose_mg_per_administration: i.dose_mg_per_administration,
          schedule: i.schedule,
          custom_days: i.schedule === "CUSTOM" ? i.custom_days : null,
          every_n_days: i.schedule === "EVERY_N_DAYS" ? i.every_n_days : null,
          cycle_on_weeks: i.cycle_on_weeks || 0,
          cycle_off_weeks: i.cycle_off_weeks || 0,
          color: i.color,
       }));

      if (rows.length) {
        const { error: insErr } = await supabase.from("protocol_items").insert(rows);
        if (insErr) throw insErr;
      }

      const { data: userRes } = await supabase.auth.getSession();
      const userId = userRes?.session?.user?.id;
      if (userId) await onProtocolUpdated(protocol.id, userId);

      onReload();
    } catch (e) {
      console.error(e);
      alert("Failed to save protocol items.");
    } finally {
      setSaving(false);
    }
  };

  const activate = async () => {
    setActivating(true);
    try {
      const { data: userRes } = await supabase.auth.getSession();
      const userId = userRes?.session?.user?.id;
      if (!userId) throw new Error("No session");

      await setActiveProtocolAndRegenerate(protocol.id, userId);
      onReload();
    } catch (e) {
      console.error(e);
      alert("Activation failed.");
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">{protocol.name}</h3>
        <div className="flex gap-2">
          <button
            className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            onClick={save}
            disabled={saving}
            type="button"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            className="px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            onClick={activate}
            disabled={activating}
            type="button"
          >
            {activating ? "Activating…" : "Set Active & Generate Doses"}
          </button>
        </div>
      </div>

      <div className="mb-2">
        {items.map((it, idx) => (
          <ProtocolItemRow
            key={idx}
            value={it}
            peptides={peptides}
            onChange={(v) => {
              const next = items.slice();
              next[idx] = v;
              setItems(next);
            }}
            onDelete={() => {
              const next = items.slice();
              next.splice(idx, 1);
              setItems(next);
            }}
          />
        ))}
      </div>

      <button
        className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100"
        onClick={addItem}
        type="button"
      >
        + Add peptide
      </button>
            </div>
      <ProtocolGraph items={items} peptides={peptides} />
    </div>
  );
}
