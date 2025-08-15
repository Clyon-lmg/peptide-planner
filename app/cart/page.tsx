"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type DbCartRow = {
  id: number;
  vendor_id: number;
  peptide_id: number;
  quantity_vials: number;
  vendors?: { name: string }[];
  peptides?: { canonical_name: string }[];
};

type CartRow = {
  id: number;
  vendor_id: number;
  peptide_id: number;
  quantity_vials: number;
  vendor_name: string;
  peptide_name: string;
};

export default function CartPage() {
  const [rows, setRows] = useState<CartRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("cart_items")
        .select(`
          id, vendor_id, peptide_id, quantity_vials,
          vendors ( name ),
          peptides ( canonical_name )
        `)
        .order("id");

      if (error) {
        console.error(error);
        setErrorMsg("Error loading cart");
 












       setRows([]);
      } else {
        const base: CartRow[] = (data ?? []).map((r: DbCartRow) => ({
          id: r.id,
          vendor_id: r.vendor_id,
          peptide_id: r.peptide_id,
          quantity_vials: r.quantity_vials,
          vendor_name: r.vendors?.[0]?.name ?? "",
          peptide_name: r.peptides?.[0]?.canonical_name ?? "",
        }));
        setRows(base);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-6">Loading cart…</div>;
 
















 if (errorMsg) return <div className="p-6 text-red-600">{errorMsg}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Cart</h1>
      {rows.length === 0 ? (
        <div className="text-sm text-gray-500">Your cart is empty.</div>
      ) : (
        <ul className="space-y-2">
          {rows.map((line) => (
            <li key={line.id} className="text-sm">
 










             {line.vendor_name} — {line.peptide_name} — Qty: {line.quantity_vials}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
