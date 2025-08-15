import { supabase } from '@/lib/supabaseClient';

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

export default async function CartPage() {
  const { data, error } = await supabase
    .from('cart_items')
    .select(\
      id, vendor_id, peptide_id, quantity_vials,
      vendors ( name ),
      peptides ( canonical_name )
    \)
    .order('id');

  if (error) {
    console.error(error);
    return <div>Error loading cart</div>;
  }

  // Normalize arrays -> scalars
  const base: CartRow[] = (data ?? []).map((r: DbCartRow) => ({
    id: r.id,
    vendor_id: r.vendor_id,
    peptide_id: r.peptide_id,
    quantity_vials: r.quantity_vials,
    vendor_name: r.vendors?.[0]?.name ?? '',
    peptide_name: r.peptides?.[0]?.can











onical_name ?? '',
  }));

  return (
    <div>
      <h1>Cart</h1>
      <ul>
        {base.map((line) => (
          <li key={line.id}>
            {line.vendor_name} - {line.peptide_name} - Qty: {line.quantity_vials}
          </li>
        ))}
      </ul>
    </div>
  );
}
