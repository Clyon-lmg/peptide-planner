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
    .from('inventory_capsules')
    .select('peptide_id, bottles, caps_per_bottle, mg_per_cap, peptides!inner(canonical_name)')
    .eq('user_id', user.id);

  const rows = (data ?? []).map((r: any) => ({
    peptide_id: r.peptide_id,
    name: r.peptides.canonical_name,
    bottles: r.bottles,
    caps_per_bottle: r.caps_per_bottle,
    mg_per_cap: Number(r.mg_per_cap ?? 0),
  }));
  return NextResponse.json(rows);
}
