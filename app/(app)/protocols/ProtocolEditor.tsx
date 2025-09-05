"use client";
import React, { useEffect, useState } from "react";
import Card from "@/components/layout/Card";
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
        titration_interval_days: r.titration_interval_days ? Number(r.titration_interval_days) : null,
        titration_amount_mg: r.titration_amount_mg ? Number(r.titration_amount_mg) : null,
        color: r.color || COLOR_PALETTE[idx % COLOR_PALETTE.length],
        time_of_day: r.time_of_day || null,
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
          titration_interval_days: null,
          titration_amount_mg: null,
          color: nextColor,
          time_of_day: null,
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
          titration_interval_days: i.titration_interval_days,
          titration_amount_mg: i.titration_amount_mg,
          color: i.color,
          time_of_day: i.time_of_day,
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

      let result;
      try {
        result = await setActiveProtocolAndRegenerate(protocol.id, userId);
      } catch (e: any) {
        console.error(e);
        alert(e?.message || "Activation failed.");
        return;
      }

      if (result?.leftover) {
        alert(`${result.leftover} dose(s) could not be removed during activation.`);
      }

      try {
        await onReload();
      } catch (e) {
        console.error(e);
        alert("Reload failed.");
      }
      } catch (e) {
      console.error(e);
      alert("Activation failed.");
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="pp-h2">{protocol.name}</h3>
        <div className="flex gap-2">
          <button
                          className="btn bg-info hover:bg-info/90 text-white disabled:opacity-60"
            onClick={save}
            disabled={saving}
            type="button"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
                          className="btn bg-success hover:bg-success/90 text-white disabled:opacity-60"
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
                    className="btn"
                    onClick={addItem}
                    type="button"
                >
                    + Add peptide
                </button>
            </Card>
            <ProtocolGraph items={items} peptides={peptides} />
        </div>
    );
}