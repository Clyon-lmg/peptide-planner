-- db/sql/patch_m2_create_protocol.sql
-- RPC to create a protocol owned by the current auth user without needing user_id from client.
-- Requires: Supabase PostgREST enabled; RLS should already restrict protocols.user_id = auth.uid().

create or replace function public.create_protocol(p_name text)
returns bigint
language plpgsql
security definer
as $$
declare
  new_id bigint;
begin
  insert into public.protocols (user_id, name, is_active)
  values (auth.uid(), p_name, false)
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.create_protocol(text) from public;
grant execute on function public.create_protocol(text) to authenticated;

-- Optional: Ensure select is RLS-safe; do not expose other users.
-- Policies should already exist; ensure they are correct:
-- Example (adapt if different):
-- create policy prot_sel on public.protocols for select using (user_id = auth.uid());
-- create policy prot_ins on public.protocols for insert with check (user_id = auth.uid());
