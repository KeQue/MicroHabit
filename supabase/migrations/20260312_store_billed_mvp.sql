alter table public.leagues
  add column if not exists players_count integer not null default 0,
  add column if not exists gross_revenue_cents integer not null default 0,
  add column if not exists estimated_store_fee_cents integer not null default 0,
  add column if not exists net_revenue_cents integer not null default 0,
  add column if not exists prize_amount_cents integer not null default 0,
  add column if not exists charity_amount_cents integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leagues_players_count_check'
  ) then
    alter table public.leagues
      add constraint leagues_players_count_check check (players_count >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'leagues_gross_revenue_cents_check'
  ) then
    alter table public.leagues
      add constraint leagues_gross_revenue_cents_check check (gross_revenue_cents >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'leagues_estimated_store_fee_cents_check'
  ) then
    alter table public.leagues
      add constraint leagues_estimated_store_fee_cents_check check (estimated_store_fee_cents >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'leagues_net_revenue_cents_check'
  ) then
    alter table public.leagues
      add constraint leagues_net_revenue_cents_check check (net_revenue_cents >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'leagues_prize_amount_cents_check'
  ) then
    alter table public.leagues
      add constraint leagues_prize_amount_cents_check check (prize_amount_cents >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'leagues_charity_amount_cents_check'
  ) then
    alter table public.leagues
      add constraint leagues_charity_amount_cents_check check (charity_amount_cents >= 0);
  end if;
end
$$;

create table if not exists public.league_payments (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null,
  store_platform text not null,
  store_product_id text not null,
  transaction_id text not null,
  purchase_token text,
  amount_cents integer not null,
  verification_status text not null default 'pending',
  verified_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  raw_payload jsonb,
  constraint league_payments_store_platform_check check (store_platform in ('ios', 'android')),
  constraint league_payments_verification_status_check check (
    verification_status in ('pending', 'verified', 'failed')
  ),
  constraint league_payments_amount_cents_check check (amount_cents >= 0)
);

create unique index if not exists league_payments_platform_transaction_idx
  on public.league_payments (store_platform, transaction_id);

create unique index if not exists league_payments_purchase_token_idx
  on public.league_payments (purchase_token)
  where purchase_token is not null;

create unique index if not exists league_payments_verified_league_user_idx
  on public.league_payments (league_id, user_id)
  where verification_status = 'verified';

create index if not exists league_payments_league_idx
  on public.league_payments (league_id, created_at desc);

create table if not exists public.league_results (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null unique references public.leagues(id) on delete cascade,
  winner_user_id uuid,
  winner_days_completed integer not null default 0,
  winner_longest_streak integer not null default 0,
  prize_amount_cents integer not null default 0,
  charity_amount_cents integer not null default 0,
  completed_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  constraint league_results_winner_days_completed_check check (winner_days_completed >= 0),
  constraint league_results_winner_longest_streak_check check (winner_longest_streak >= 0),
  constraint league_results_prize_amount_cents_check check (prize_amount_cents >= 0),
  constraint league_results_charity_amount_cents_check check (charity_amount_cents >= 0)
);

create table if not exists public.reward_issuances (
  id uuid primary key default gen_random_uuid(),
  league_result_id uuid references public.league_results(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null,
  reward_type text not null default 'gift_card',
  reward_value_cents integer not null,
  reward_status text not null default 'pending',
  issued_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  note text,
  constraint reward_issuances_reward_value_cents_check check (reward_value_cents >= 0),
  constraint reward_issuances_reward_status_check check (
    reward_status in ('pending', 'issued', 'failed')
  )
);

create unique index if not exists reward_issuances_league_user_idx
  on public.reward_issuances (league_id, user_id);

create or replace function public.estimate_store_fee_cents(p_gross_cents integer) returns integer
    language sql
    immutable
    set search_path to 'public'
as $$
  select greatest(0, round(greatest(coalesce(p_gross_cents, 0), 0) * 0.15)::integer)
$$;

create or replace function public.fixed_prize_amount_cents(
  p_plan_tier text,
  p_players_count integer
) returns integer
    language sql
    immutable
    set search_path to 'public'
as $$
  select case p_plan_tier
    when 'A' then 0
    when 'B' then case
      when coalesce(p_players_count, 0) >= 6 then 4000
      when coalesce(p_players_count, 0) >= 4 then 2500
      when coalesce(p_players_count, 0) >= 2 then 1500
      else 0
    end
    when 'C' then case
      when coalesce(p_players_count, 0) >= 6 then 9000
      when coalesce(p_players_count, 0) >= 4 then 6000
      when coalesce(p_players_count, 0) >= 2 then 3000
      else 0
    end
    else 0
  end
$$;

create or replace function public.recompute_league_financials(p_league_id uuid) returns public.leagues
    language plpgsql
    security definer
    set search_path to 'public'
as $$
declare
  v_league public.leagues%rowtype;
  v_member_count integer := 0;
  v_paid_count integer := 0;
  v_players_count integer := 0;
  v_gross integer := 0;
  v_estimated_store_fee integer := 0;
  v_net integer := 0;
  v_platform_total integer := 0;
  v_prize integer := 0;
  v_charity integer := 0;
begin
  select *
    into v_league
  from public.leagues
  where id = p_league_id;

  if not found then
    raise exception 'league_not_found';
  end if;

  select count(*)
    into v_member_count
  from public.league_members
  where league_id = p_league_id;

  select
    count(*) filter (where verification_status = 'verified'),
    coalesce(sum(amount_cents) filter (where verification_status = 'verified'), 0)
    into v_paid_count, v_gross
  from public.league_payments
  where league_id = p_league_id;

  if coalesce(v_league.plan_tier, '') in ('A', 'B', 'C') then
    v_players_count := v_paid_count;
  else
    v_players_count := v_member_count;
  end if;

  v_estimated_store_fee := public.estimate_store_fee_cents(v_gross);
  v_net := greatest(v_gross - v_estimated_store_fee, 0);
  v_platform_total := greatest(coalesce(v_league.platform_fee_cents, 0), 0) * greatest(v_players_count, 0);
  v_prize := least(
    public.fixed_prize_amount_cents(v_league.plan_tier, v_players_count),
    greatest(v_net - v_platform_total, 0)
  );
  v_charity := greatest(v_net - v_platform_total - v_prize, 0);

  update public.leagues
  set
    players_count = v_players_count,
    gross_revenue_cents = v_gross,
    estimated_store_fee_cents = v_estimated_store_fee,
    net_revenue_cents = v_net,
    prize_amount_cents = v_prize,
    charity_amount_cents = v_charity
  where id = p_league_id
  returning * into v_league;

  return v_league;
end;
$$;

create or replace function public.create_league_and_join(
  p_name text,
  p_activity text,
  p_plan_tier text,
  p_month_key text,
  p_is_free boolean
) returns uuid
    language plpgsql
    security definer
    set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_league_id uuid;
  v_is_free boolean := coalesce(p_is_free, false);
  v_plan_tier text := nullif(trim(p_plan_tier), '');
  v_entry_fee_cents integer := 0;
  v_platform_fee_cents integer := 0;
  v_winner_share_bps integer := 0;
  v_charity_share_bps integer := 0;
  v_qualification_days_min integer := 0;
  v_owner_payment_status text := 'free';
  v_owner_agreed_at timestamp with time zone := null;
  v_owner_paid_at timestamp with time zone := null;
  v_league_status text := 'active';
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if v_plan_tier is not null then
    if v_plan_tier not in ('A', 'B', 'C') then
      raise exception 'invalid_plan_tier';
    end if;

    v_is_free := false;
    v_entry_fee_cents := public.plan_entry_fee_cents(v_plan_tier);
    v_platform_fee_cents := public.plan_platform_fee_cents(v_plan_tier);
    v_winner_share_bps := public.plan_winner_share_bps(v_plan_tier);
    v_charity_share_bps := public.plan_charity_share_bps(v_plan_tier);
    v_qualification_days_min := public.plan_qualification_days_min(v_plan_tier);
    v_owner_payment_status := 'unpaid';
    v_league_status := 'payment_required';
  elsif v_is_free then
    v_entry_fee_cents := 0;
    v_platform_fee_cents := 0;
    v_winner_share_bps := 0;
    v_charity_share_bps := 0;
    v_qualification_days_min := 0;
    v_owner_payment_status := 'free';
    v_owner_agreed_at := now();
    v_league_status := 'active';
  else
    raise exception 'plan_tier_required';
  end if;

  insert into public.leagues (
    name,
    activity,
    plan_tier,
    month_key,
    is_free,
    entry_fee_cents,
    platform_fee_cents,
    winner_share_bps,
    charity_share_bps,
    qualification_days_min,
    status,
    payment_status,
    invite_code,
    created_by
  )
  values (
    p_name,
    p_activity,
    v_plan_tier,
    p_month_key,
    v_is_free,
    v_entry_fee_cents,
    v_platform_fee_cents,
    v_winner_share_bps,
    v_charity_share_bps,
    v_qualification_days_min,
    v_league_status,
    case when v_is_free then 'free' else 'unpaid' end,
    public.generate_invite_code(),
    v_uid
  )
  returning id into v_league_id;

  insert into public.league_members (
    league_id,
    user_id,
    role,
    joined_at,
    payment_status,
    paid_at,
    agreed_at
  )
  values (
    v_league_id,
    v_uid,
    'owner',
    now(),
    v_owner_payment_status,
    v_owner_paid_at,
    v_owner_agreed_at
  )
  on conflict (league_id, user_id) do update
    set payment_status = excluded.payment_status,
        paid_at = coalesce(public.league_members.paid_at, excluded.paid_at),
        agreed_at = coalesce(public.league_members.agreed_at, excluded.agreed_at);

  perform public.recompute_league_financials(v_league_id);

  return v_league_id;
end;
$$;

create or replace function public.join_league_by_code(p_code text) returns uuid
    language plpgsql
    security definer
    set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_league_id uuid;
  v_is_free boolean;
  v_plan_tier text;
  v_status text;
  v_payment_status text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_code is null or length(trim(p_code)) = 0 then
    raise exception 'invalid_invite_code';
  end if;

  select id, is_free, plan_tier, status
    into v_league_id, v_is_free, v_plan_tier, v_status
  from public.leagues
  where invite_code = upper(trim(p_code))
  limit 1;

  if v_league_id is null then
    raise exception 'invalid_invite_code';
  end if;

  if v_status = 'completed' then
    raise exception 'league_closed';
  end if;

  if coalesce(v_is_free, false) or v_plan_tier is null then
    v_payment_status := 'free';
  else
    if v_plan_tier not in ('A', 'B', 'C') then
      raise exception 'payment_required';
    end if;

    v_payment_status := 'unpaid';
  end if;

  insert into public.league_members (
    league_id, user_id, role, joined_at, payment_status, share_cents
  )
  values (
    v_league_id, v_uid, 'member', now(), v_payment_status, 0
  )
  on conflict (league_id, user_id) do update
    set joined_at = excluded.joined_at,
        payment_status = case
          when public.league_members.payment_status in ('paid', 'free') then public.league_members.payment_status
          else excluded.payment_status
        end,
        share_cents = excluded.share_cents,
        role = case
          when public.league_members.role = 'owner' then 'owner'
          else excluded.role
        end;

  if v_payment_status = 'free' then
    perform public.recompute_league_financials(v_league_id);
  end if;

  return v_league_id;
end;
$$;

create or replace function public.verify_league_purchase(
  p_league_id uuid,
  p_store_platform text,
  p_store_product_id text,
  p_transaction_id text,
  p_purchase_token text default null,
  p_amount_cents integer default null,
  p_verification_status text default 'verified',
  p_raw_payload jsonb default null
) returns uuid
    language plpgsql
    security definer
    set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_payment_id uuid;
  v_amount_cents integer := 0;
  v_plan_tier text;
  v_is_free boolean;
  v_status text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_store_platform not in ('ios', 'android') then
    raise exception 'invalid_store_platform';
  end if;

  if p_verification_status not in ('pending', 'verified', 'failed') then
    raise exception 'invalid_verification_status';
  end if;

  if p_transaction_id is null or length(trim(p_transaction_id)) = 0 then
    raise exception 'transaction_id_required';
  end if;

  select plan_tier, is_free, status, entry_fee_cents
    into v_plan_tier, v_is_free, v_status, v_amount_cents
  from public.leagues
  where id = p_league_id;

  if v_status is null then
    raise exception 'league_not_found';
  end if;

  if v_status = 'completed' then
    raise exception 'league_closed';
  end if;

  if coalesce(v_is_free, false) or v_plan_tier is null then
    raise exception 'free_league_does_not_require_purchase';
  end if;

  if p_amount_cents is not null then
    v_amount_cents := p_amount_cents;
  end if;

  insert into public.league_members (
    league_id,
    user_id,
    role,
    joined_at,
    payment_status,
    share_cents
  )
  values (
    p_league_id,
    v_uid,
    'member',
    now(),
    'unpaid',
    0
  )
  on conflict (league_id, user_id) do nothing;

  insert into public.league_payments (
    league_id,
    user_id,
    store_platform,
    store_product_id,
    transaction_id,
    purchase_token,
    amount_cents,
    verification_status,
    verified_at,
    raw_payload
  )
  values (
    p_league_id,
    v_uid,
    p_store_platform,
    p_store_product_id,
    trim(p_transaction_id),
    nullif(trim(coalesce(p_purchase_token, '')), ''),
    greatest(coalesce(v_amount_cents, 0), 0),
    p_verification_status,
    case when p_verification_status = 'verified' then now() else null end,
    p_raw_payload
  )
  on conflict (store_platform, transaction_id) do update
    set
      verification_status = excluded.verification_status,
      verified_at = case
        when excluded.verification_status = 'verified' then coalesce(public.league_payments.verified_at, now())
        else public.league_payments.verified_at
      end,
      raw_payload = coalesce(excluded.raw_payload, public.league_payments.raw_payload),
      store_product_id = excluded.store_product_id
  returning id into v_payment_id;

  if p_verification_status = 'verified' then
    update public.league_members
      set payment_status = 'paid',
          agreed_at = coalesce(agreed_at, now()),
          paid_at = coalesce(paid_at, now())
    where league_id = p_league_id
      and user_id = v_uid;

    update public.leagues
      set status = 'active',
          payment_status = 'paid'
    where id = p_league_id
      and status = 'payment_required';
  end if;

  perform public.recompute_league_financials(p_league_id);

  return v_payment_id;
end;
$$;

create or replace function public.settle_league_results(p_league_id uuid) returns uuid
    language plpgsql
    security definer
    set search_path to 'public'
as $$
declare
  v_result_id uuid;
  v_plan_tier text;
  v_status text;
  v_prize integer := 0;
  v_charity integer := 0;
  v_qualification_days_min integer := 0;
  v_winner_user_id uuid;
  v_winner_days integer := 0;
  v_winner_streak integer := 0;
begin
  select plan_tier, status, prize_amount_cents, charity_amount_cents, qualification_days_min
    into v_plan_tier, v_status, v_prize, v_charity, v_qualification_days_min
  from public.leagues
  where id = p_league_id;

  if v_status is null then
    raise exception 'league_not_found';
  end if;

  if v_status = 'completed' then
    select id into v_result_id
    from public.league_results
    where league_id = p_league_id;

    return v_result_id;
  end if;

  perform public.recompute_league_financials(p_league_id);

  select prize_amount_cents, charity_amount_cents, qualification_days_min
    into v_prize, v_charity, v_qualification_days_min
  from public.leagues
  where id = p_league_id;

  select r.user_id, r.days_completed, r.longest_streak
    into v_winner_user_id, v_winner_days, v_winner_streak
  from public.v_month_results r
  join public.league_members lm
    on lm.league_id = r.league_id
   and lm.user_id = r.user_id
  where r.league_id = p_league_id
    and lm.payment_status in ('free', 'paid')
    and (
      coalesce(v_plan_tier, '') <> 'C'
      or r.days_completed >= coalesce(v_qualification_days_min, 0)
    )
  order by r.days_completed desc, r.longest_streak desc, r.user_id asc
  limit 1;

  insert into public.league_results (
    league_id,
    winner_user_id,
    winner_days_completed,
    winner_longest_streak,
    prize_amount_cents,
    charity_amount_cents,
    completed_at
  )
  values (
    p_league_id,
    v_winner_user_id,
    greatest(coalesce(v_winner_days, 0), 0),
    greatest(coalesce(v_winner_streak, 0), 0),
    greatest(coalesce(v_prize, 0), 0),
    greatest(coalesce(v_charity, 0), 0),
    now()
  )
  on conflict (league_id) do update
    set
      winner_user_id = excluded.winner_user_id,
      winner_days_completed = excluded.winner_days_completed,
      winner_longest_streak = excluded.winner_longest_streak,
      prize_amount_cents = excluded.prize_amount_cents,
      charity_amount_cents = excluded.charity_amount_cents,
      completed_at = excluded.completed_at
  returning id into v_result_id;

  if coalesce(v_prize, 0) > 0 and v_winner_user_id is not null then
    insert into public.reward_issuances (
      league_result_id,
      league_id,
      user_id,
      reward_type,
      reward_value_cents,
      reward_status
    )
    values (
      v_result_id,
      p_league_id,
      v_winner_user_id,
      'gift_card',
      v_prize,
      'pending'
    )
    on conflict (league_id, user_id) do update
      set reward_value_cents = excluded.reward_value_cents;
  end if;

  update public.leagues
    set status = 'completed'
  where id = p_league_id;

  return v_result_id;
end;
$$;

create or replace view public.v_pending_reward_issuances as
select
  r.id,
  r.league_id,
  l.name as league_name,
  l.month_key,
  r.user_id,
  r.reward_type,
  r.reward_value_cents,
  r.reward_status,
  r.created_at,
  r.issued_at
from public.reward_issuances r
join public.leagues l on l.id = r.league_id
where r.reward_status = 'pending';

create or replace view public.v_monthly_charity_totals as
select
  l.month_key,
  count(*) as leagues_count,
  sum(l.charity_amount_cents) as charity_amount_cents
from public.leagues l
where l.status = 'completed'
group by l.month_key;

create or replace view public.v_leagues_awaiting_completion as
select
  l.id,
  l.name,
  l.month_key,
  l.plan_tier,
  l.players_count,
  l.prize_amount_cents,
  l.charity_amount_cents
from public.leagues l
where l.status = 'active'
  and l.month_key <= to_char(current_date, 'YYYY-MM');

grant execute on function public.recompute_league_financials(uuid) to authenticated;
grant execute on function public.verify_league_purchase(uuid, text, text, text, text, integer, text, jsonb) to authenticated;
grant execute on function public.settle_league_results(uuid) to authenticated;
grant execute on function public.join_league_by_code(text) to authenticated;
grant execute on function public.create_league_and_join(text, text, text, text, boolean) to authenticated;
