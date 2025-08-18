import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';

export async function GET() {
  const supabase = createRouteHandlerClient({
    cookies,
    supabaseUrl,
    supabaseKey: supabaseAnonKey,
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json([], { status: 200 });

  const { data } = await supabase
    .from('inventory_items')
    .select('peptide_id, vials, mg_per_vial, bac_ml, peptides!inner(canonical_name)')
    .eq('user_id', user.id);

  const rows = (data ?? []).map((r: any) => ({
    peptide_id: r.peptide_id,
    name: r.peptides.canonical_name,
    vials: r.vials,
    mg_per_vial: Number(r.mg_per_vial ?? 0),
    bac_ml: Number(r.bac_ml ?? 0),
  }));
  return NextResponse.json(rows);
}
