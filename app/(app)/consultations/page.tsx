// app/(app)/consultations/page.tsx
import { createServerComponentSupabase } from '@/lib/supabaseServer';
import { inviteProviderAction, revokeConsultationAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function ConsultationsPage() {
  const supabase = createServerComponentSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-xl p-4">
        <p>You must sign in to manage consultations.</p>
      </div>
    );
  }

  const { data } = await supabase
    .from('consultations')
    .select('id, provider_identifier, provider_id, token, status')
    .eq('client_id', user.id)
    .in('status', ['pending', 'active']);

  const pending = (data ?? []).filter((c: any) => c.status === 'pending');
  const active = (data ?? []).filter((c: any) => c.status === 'active');

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';

  return (
    <div className="mx-auto max-w-xl space-y-6 p-4">
      <h1 className="text-2xl font-semibold">Consultations</h1>

      <form action={inviteProviderAction} className="space-y-2 rounded border p-4">
        <h2 className="font-medium">Invite a provider</h2>
        <input
          type="text"
          name="identifier"
          placeholder="Email or username"
          className="w-full rounded border px-3 py-2 text-foreground"
          required
        />
        <button type="submit" className="rounded border px-3 py-2">Send invite</button>
      </form>

      {pending.length > 0 && (
        <div className="rounded border p-4">
          <h2 className="mb-2 font-medium">Pending invites</h2>
          <ul className="space-y-2">
            {pending.map((c: any) => (
              <li key={c.id} className="text-sm">
                <div>{c.provider_identifier}</div>
                <div className="break-all">{siteUrl}/consultations/accept?token={c.token}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded border p-4">
        <h2 className="mb-2 font-medium">Active consultations</h2>
        {active.length === 0 && <p className="text-sm">None yet.</p>}
        <ul className="space-y-2">
          {active.map((c: any) => (
            <li key={c.id} className="flex items-center justify-between text-sm">
              <span>{c.provider_identifier}</span>
              <form action={revokeConsultationAction}>
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" className="rounded border px-2 py-1 text-xs">Revoke</button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}