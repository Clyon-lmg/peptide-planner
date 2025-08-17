
-- db/sql/patch_m2_status_normalization.sql
-- Canonicalize dose_status to PENDING/TAKEN/SKIPPED and coerce synonyms.

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'dose_status' and e.enumlabel = 'TAKEN'
  ) then
    execute 'alter type dose_status add value ''TAKEN''';
  end if;
end$$;

-- Normalize any old synonyms to TAKEN
update public.doses
set status = 'TAKEN'::dose_status
where status::text in ('COMPLETED','DONE','SUCCESS');

create or replace function public.coerce_dose_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare s text;
begin
  if new.status is null then
    new.status := 'PENDING'::dose_status;
    return new;
  end if;

  s := upper(new.status::text);
  if s in ('TAKEN','COMPLETED','DONE','SUCCESS') then
    new.status := 'TAKEN'::dose_status;
  elsif s = 'SKIPPED' then
    new.status := 'SKIPPED'::dose_status;
  elsif s = 'PENDING' then
    new.status := 'PENDING'::dose_status;
  else
    new.status := 'PENDING'::dose_status;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_coerce_dose_status on public.doses;
create trigger trg_coerce_dose_status
before insert or update on public.doses
for each row execute procedure public.coerce_dose_status();
