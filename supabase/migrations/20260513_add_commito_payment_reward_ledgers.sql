-- Commito paid MVP accounting foundation.
--
-- The live project already has plan tiers, league payment status, league
-- results, and several frozen league-level financial fields. This migration is
-- intentionally idempotent so it can safely align local history with the live
-- database and add the missing ledgers for RevenueCat purchases, manual gift
-- card rewards, and monthly charity receipts.

alter table public.leagues
  add column if not exists entry_fee_cents integer,
  add column if not exists platform_fee_cents integer,
  add column if not exists winner_share_bps integer,
  add column if not exists charity_share_bps integer,
  add column if not exists qualification_days_min integer,
  add column if not exists players_count integer,
  add column if not exists gross_revenue_cents integer,
  add column if not exists estimated_store_fee_cents integer,
  add column if not exists net_revenue_cents integer,
  add column if not exists prize_amount_cents integer,
  add column if not exists charity_amount_cents integer,
  add column if not exists max_players integer,
  add column if not exists commito_margin_cents integer,
  add column if not exists financial_rules_locked_at timestamp with time zone;

create table if not exists public.league_results (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  winner_user_id uuid references public.profiles(id) on delete set null,
  winner_days_completed integer not null default 0,
  winner_longest_streak integer not null default 0,
  prize_amount_cents integer not null default 0,
  charity_amount_cents integer not null default 0,
  completed_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create unique index if not exists league_results_league_id_key
  on public.league_results (league_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  league_id uuid references public.leagues(id) on delete set null,
  plan_type text not null,
  store text not null,
  product_id text not null,
  purchase_id text not null,
  revenuecat_customer_id text,
  entitlement_id text,
  amount_gross_cents integer not null,
  estimated_store_fee_cents integer not null default 0,
  amount_net_cents integer not null,
  currency text not null default 'EUR',
  verified boolean not null default false,
  purchased_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint payments_plan_type_check check (plan_type in ('A', 'B', 'C', 'friendly', 'competitive', 'elite')),
  constraint payments_store_check check (store in ('apple', 'google', 'manual', 'unknown')),
  constraint payments_amounts_nonnegative_check check (
    amount_gross_cents >= 0
    and estimated_store_fee_cents >= 0
    and amount_net_cents >= 0
  )
);

create unique index if not exists payments_store_purchase_id_key
  on public.payments (store, purchase_id);

create index if not exists payments_user_id_idx
  on public.payments (user_id);

create index if not exists payments_league_id_idx
  on public.payments (league_id);

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  league_result_id uuid references public.league_results(id) on delete set null,
  winner_user_id uuid not null references public.profiles(id) on delete cascade,
  reward_amount_cents integer not null default 0,
  reward_type text not null default 'gift_card',
  status text not null default 'pending',
  provider text,
  provider_reward_id text,
  notes text,
  issued_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint rewards_status_check check (status in ('pending', 'reviewed', 'issued', 'cancelled')),
  constraint rewards_reward_type_check check (reward_type in ('gift_card', 'manual', 'none')),
  constraint rewards_amount_nonnegative_check check (reward_amount_cents >= 0)
);

create index if not exists rewards_league_id_idx
  on public.rewards (league_id);

create index if not exists rewards_winner_user_id_idx
  on public.rewards (winner_user_id);

create table if not exists public.charity_ledger (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references public.leagues(id) on delete set null,
  amount_cents integer not null default 0,
  currency text not null default 'EUR',
  charity_name text not null,
  status text not null default 'pending',
  receipt_url text,
  donated_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint charity_ledger_status_check check (status in ('pending', 'donated', 'receipt_uploaded', 'cancelled')),
  constraint charity_ledger_amount_nonnegative_check check (amount_cents >= 0)
);

create index if not exists charity_ledger_league_id_idx
  on public.charity_ledger (league_id);

alter table public.payments enable row level security;
alter table public.rewards enable row level security;
alter table public.charity_ledger enable row level security;
alter table public.league_results enable row level security;

drop policy if exists payments_select_own on public.payments;
create policy payments_select_own
on public.payments
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists rewards_select_league_members on public.rewards;
create policy rewards_select_league_members
on public.rewards
for select
to authenticated
using (
  exists (
    select 1
    from public.league_members lm
    where lm.league_id = rewards.league_id
      and lm.user_id = auth.uid()
  )
);

drop policy if exists charity_ledger_select_league_members on public.charity_ledger;
create policy charity_ledger_select_league_members
on public.charity_ledger
for select
to authenticated
using (
  league_id is not null
  and exists (
    select 1
    from public.league_members lm
    where lm.league_id = charity_ledger.league_id
      and lm.user_id = auth.uid()
  )
);

drop policy if exists league_results_select_league_members on public.league_results;
create policy league_results_select_league_members
on public.league_results
for select
to authenticated
using (
  exists (
    select 1
    from public.league_members lm
    where lm.league_id = league_results.league_id
      and lm.user_id = auth.uid()
  )
);

grant select on public.payments to authenticated;
grant select on public.rewards to authenticated;
grant select on public.charity_ledger to authenticated;
grant select on public.league_results to authenticated;
grant all on public.payments to service_role;
grant all on public.rewards to service_role;
grant all on public.charity_ledger to service_role;
grant all on public.league_results to service_role;
