
-- db/sql/patch_m2_doses_date_default.sql
-- Ensure date/date_for and user_id are always filled on doses insert.

create or replace function public.set_dose_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;

  if new."date" is null and new.date_for is not null then
    new."date" := new.date_for;
  end if;
  if new.date_for is null and new."date" is not null then
    new.date_for := new."date";
  end if;
  if new."date" is null and new.date_for is null then
    new."date" := now()::date;
    new.date_for := new."date";
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_dose_user_id on public.doses;
drop trigger if exists trg_set_dose_defaults on public.doses;

create trigger trg_set_dose_defaults
before insert on public.doses
for each row execute procedure public.set_dose_defaults();
