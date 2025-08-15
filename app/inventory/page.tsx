"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type DbRow = {
  id: number;
  peptide_id: number;
  vials: number;
  mg_per_vial: number;
  bac_ml: number;
  peptides?: { canonical_name: string }[];
};

type Row = {
  id: number;
  peptide_id: number;
  vials: number;
  mg_per_vial: number;
  bac_ml: number;
  peptide_name: string;
};

export default function InventoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: inv, error: eInv } = await supabase
        .from("inventory_items")
        .select(`
          id, peptide_id, vials, mg_per_vial, bac_ml,
          peptides ( canonical_name )
        `)
        .order("id");

      if (eInv) {
        console.error(eInv);
        setErrorMsg("Error loading inventory");
        setRows([]);
        return;
      }

      // Normalize related arrays -> scalars















      const normalized: Row[] = (inv ?? []).map((r: DbRow) => ({
        id: r.id,
        peptide_id: r.peptide_id,
        vials: r.vials,
        mg_per_vial: r.mg_per_vial,
        bac_ml: r.bac_ml,
        peptide_name: r.peptides?.[0]?.canonical_name ?? "",
      }));

      setRows(normalized);
    })();
  }, []);

  if (errorMsg) {
    return <div className="p-6 text-red-600">{errorMsg}</div>;
  }

  return (
 

















   <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Inventory</h1>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="text-sm">
            {r.peptide_name || "Unknown peptide"} — Vials: {r.vials}, mg/vial: {r.mg_per_vial}, BAC (ml): {r.bac_ml}
          </li>
        ))}
        {rows.length === 0 && <li className="text-sm text-gray-500">No items yet.</li>}
      </ul>
    </div>
 










 );
}
