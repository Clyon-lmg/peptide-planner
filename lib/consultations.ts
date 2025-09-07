import 'server-only';
import { createServerComponentSupabase } from '@/lib/supabaseServer';

/**
 * Fetch a client's inventory if the current user has an active consultation
 * with that client. Throws if not authenticated or no consultation exists.
 */
export async function getClientInventory(clientId: string) {
  const supabase = createServerComponentSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: consult } = await supabase
    .from('consultations')
    .select('id')
    .eq('client_id', clientId)
    .eq('provider_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!consult) throw new Error('No active consultation');

  const [vials, capsules] = await Promise.all([
    supabase
      .from('inventory_items')
      .select('id, peptide_id, vials, mg_per_vial, bac_ml, half_life_hours')
      .eq('user_id', clientId),
    supabase
      .from('inventory_capsules')
      .select('id, peptide_id, bottles, caps_per_bottle, mg_per_cap, half_life_hours')
      .eq('user_id', clientId),
  ]);

  return {
    vials: vials?.data ?? [],
    capsules: capsules?.data ?? [],
  };
}

/**
 * Fetch a client's protocols (and items) if an active consultation exists.
 */
export async function getClientProtocols(clientId: string) {
  const supabase = createServerComponentSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: consult } = await supabase
    .from('consultations')
    .select('id')
    .eq('client_id', clientId)
    .eq('provider_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!consult) throw new Error('No active consultation');

  const { data: protocols } = await supabase
    .from('protocols')
    .select('*, protocol_items(*)')
    .eq('user_id', clientId);

  return protocols ?? [];
}