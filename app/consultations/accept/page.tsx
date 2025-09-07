// app/consultations/accept/page.tsx
import { createServerComponentSupabase } from '@/lib/supabaseServer';

export default async function AcceptConsultationPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token;
  const supabase = createServerComponentSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!token) {
    return (
      <div className="mx-auto max-w-xl p-4">
        <p>Missing token.</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl p-4">
        <p>You must sign in to accept this consultation.</p>
      </div>
    );
  }

  const { data, error } = await supabase
    .from('consultations')
    .select('id, status')
    .eq('token', token)
    .maybeSingle();

  if (error || !data) {
    return (
      <div className="mx-auto max-w-xl p-4">
        <p>Invalid or expired token.</p>
      </div>
    );
  }

  if (data.status !== 'pending') {
    return (
      <div className="mx-auto max-w-xl p-4">
        <p>This consultation is not pending.</p>
      </div>
    );
  }

  await supabase
    .from('consultations')
    .update({ status: 'active', provider_id: user.id })
    .eq('id', data.id);

  return (
    <div className="mx-auto max-w-xl p-4">
      <p>Consultation accepted. You may now close this window.</p>
    </div>
  );
}