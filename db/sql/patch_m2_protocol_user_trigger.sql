-- db/sql/patch_m2_protocol_user_trigger.sql
-- Ensure new protocols automatically get user_id = auth.uid() server-side.
-- This avoids null user_id and removes the need to pass userId from the client.

create or replace function public.set_protocol_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_protocol_user_id on public.protocols;

create trigger trg_set_protocol_user_id
before insert on public.protocols
for each row
execute procedure public.set_protocol_user_id();

-- RLS policy (adjust name if you already have one)
-- This ensures only the owner can insert/select/update/delete their rows.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='protocols' and policyname='protocols_ins_owner'
  ) then
    create policy protocols_ins_owner on public.protocols
      for insert with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='protocols' and policyname='protocols_sel_owner'
  ) then
    create policy protocols_sel_owner on public.protocols
      for select using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='protocols' and policyname='protocols_upd_owner'
  ) then
    create policy protocols_upd_owner on public.protocols
      for update using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='protocols' and policyname='protocols_del_owner'
  ) then
    create policy protocols_del_owner on public.protocols
      for delete using (user_id = auth.uid());
  end if;
end $$;
