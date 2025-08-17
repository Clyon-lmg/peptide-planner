
-- db/sql/check_m2_presence.sql
-- Quick verification script to run in Supabase SQL editor.

-- 1) Enum values
select t.typname as enum_type, e.enumlabel
from pg_type t join pg_enum e on e.enumtypid = t.oid
where t.typname = 'dose_status'
order by e.enumsortorder;

-- 2) Triggers on doses
select event_object_table as table_name, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where event_object_table = 'doses'
order by trigger_name;

-- 3) Sample: today's doses visible for current user (requires RLS passes)
select id, protocol_id, peptide_id, status, date_for
from public.doses
where date_for = current_date
limit 20;
