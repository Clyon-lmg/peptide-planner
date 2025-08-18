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
    .from('inventory_capsules')
    .select('peptide_id, bottles, caps_per_bottle, mg_per_cap, peptides(canonical_name)')
    .eq('user_id', user.id)
    .order('peptide_id', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows =
    (data ?? []).map((r: any) => ({
      peptide_id: r.peptide_id,
      name: r.peptides?.canonical_name ?? '',
      bottles: Number(r.bottles ?? 0),
      caps_per_bottle: Number(r.caps_per_bottle ?? 0),
      mg_per_cap: Number(r.mg_per_cap ?? 0),
    })) ?? [];

  return NextResponse.json(rows);
}
