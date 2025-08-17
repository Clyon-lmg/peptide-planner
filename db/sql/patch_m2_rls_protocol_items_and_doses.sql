-- db/sql/patch_m2_rls_protocol_items_and_doses.sql
-- Ensure RLS + policies for protocol_items and doses, and user_id auto-fill on doses.

-- 1) protocol_items
alter table public.protocol_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='protocol_items' and policyname='protocol_items_sel_owner'
  ) then
    create policy protocol_items_sel_owner
      on public.protocol_items
      for select
      using (exists (
        select 1 from public.protocols p
        where p.id = protocol_items.protocol_id
          and p.user_id = auth.uid()
      ));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='protocol_items' and policyname='protocol_items_ins_owner'
  ) then
    create policy protocol_items_ins_owner
      on public.protocol_items
      for insert
      with check (exists (
        select 1 from public.protocols p
        where p.id = protocol_items.protocol_id
          and p.user_id = auth.uid()
      ));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='protocol_items' and policyname='protocol_items_upd_owner'
  ) then
    create policy protocol_items_upd_owner
      on public.protocol_items
      for update
      using (exists (
        select 1 from public.protocols p
        where p.id = protocol_items.protocol_id
          and p.user_id = auth.uid()
      ));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='protocol_items' and policyname='protocol_items_del_owner'
  ) then
    create policy protocol_items_del_owner
      on public.protocol_items
      for delete
      using (exists (
        select 1 from public.protocols p
        where p.id = protocol_items.protocol_id
          and p.user_id = auth.uid()
      ));
  end if;
end $$;

-- 2) doses
alter table public.doses enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='doses' and policyname='doses_sel_owner'
  ) then
    create policy doses_sel_owner
      on public.doses
      for select
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='doses' and policyname='doses_ins_owner'
  ) then
    create policy doses_ins_owner
      on public.doses
      for insert
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='doses' and policyname='doses_upd_owner'
  ) then
    create policy doses_upd_owner
      on public.doses
      for update
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='doses' and policyname='doses_del_owner'
  ) then
    create policy doses_del_owner
      on public.doses
      for delete
      using (user_id = auth.uid());
  end if;
end $$;

-- BEFORE INSERT trigger to set doses.user_id = auth.uid() when missing
create or replace function public.set_dose_user_id()
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

drop trigger if exists trg_set_dose_user_id on public.doses;

create trigger trg_set_dose_user_id
before insert on public.doses
for each row
execute procedure public.set_dose_user_id();
