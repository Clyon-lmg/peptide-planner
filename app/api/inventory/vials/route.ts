import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
    error: uerr,
  } = await supabase.auth.getUser();
  if (uerr || !user) {
    return NextResponse.json({ error: uerr?.message ?? 'Not authenticated' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('inventory_items')
    .select('peptide_id, vials, mg_per_vial, bac_ml, peptides(canonical_name)')
    .eq('user_id', user.id)
    .order('peptide_id', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows =
    (data ?? []).map((r: any) => ({
      peptide_id: r.peptide_id,
      name: r.peptides?.canonical_name ?? '',
      vials: Number(r.vials ?? 0),
      mg_per_vial: Number(r.mg_per_vial ?? 0),
      bac_ml: Number(r.bac_ml ?? 0),
    })) ?? [];

  return NextResponse.json(rows);
}
