+44
-0

'use server';

import { createServerActionSupabase } from '@/lib/supabaseServer';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

async function getAuthed() {
  const supabase = createServerActionSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error('Not authenticated');
  return { supabase, userId: data.user.id as string };
}

export async function inviteProviderAction(formData: FormData) {
  const identifier = String(formData.get('identifier') || '').trim();
  if (!identifier) throw new Error('Identifier required');

  const { supabase, userId } = await getAuthed();
  const token = randomUUID();
  const { error } = await supabase.from('consultations').insert({
    client_id: userId,
    provider_identifier: identifier,
    token,
    status: 'pending',
  });
  if (error) throw error;

  // TODO: send email to provider with token

  revalidatePath('/consultations');
}

export async function revokeConsultationAction(formData: FormData) {
  const id = String(formData.get('id') || '');
  if (!id) return;
  const { supabase, userId } = await getAuthed();
  const { error } = await supabase
    .from('consultations')
    .update({ status: 'revoked' })
    .eq('id', id)
    .eq('client_id', userId);
  if (error) throw error;
  revalidatePath('/consultations');
}