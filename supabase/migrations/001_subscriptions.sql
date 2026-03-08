-- Run this in the Supabase SQL editor

create table if not exists subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid references auth.users(id) on delete cascade not null unique,
  stripe_customer_id     text,
  stripe_subscription_id text,
  status                 text not null default 'trialing',
  -- ^ values: trialing | active | canceled | past_due | incomplete
  trial_ends_at          timestamptz not null default (now() + interval '30 days'),
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table subscriptions enable row level security;

create policy "Users can view own subscription"
  on subscriptions for select
  using (auth.uid() = user_id);

-- Service role (used by webhook) can do everything
-- No additional policy needed — service role bypasses RLS
