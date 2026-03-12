alter table public.leagues
  add column if not exists commito_margin_cents integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leagues_commito_margin_cents_check'
  ) then
    alter table public.leagues
      add constraint leagues_commito_margin_cents_check check (commito_margin_cents >= 0);
  end if;
end
$$;

create or replace function public.plan_qualification_days_min(p_plan_tier text) returns integer
    language sql
    immutable
    set search_path to 'public'
as $$
  select case p_plan_tier
    when 'C' then 20
    else 0
  end
$$;

create or replace function public.minimum_players_for_rewards(p_plan_tier text) returns integer
    language sql
    immutable
    set search_path to 'public'
as $$
  select case p_plan_tier
    when 'B' then 2
    when 'C' then 3
    else 1
  end
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
      when coalesce(p_players_count, 0) >= 8 then 4500
      when coalesce(p_players_count, 0) >= 6 then 3500
      when coalesce(p_players_count, 0) >= 4 then 2200
      when coalesce(p_players_count, 0) >= 2 then 1200
      else 0
    end
    when 'C' then case
      when coalesce(p_players_count, 0) >= 7 then 8000
      when coalesce(p_players_count, 0) >= 5 then 5500
      when coalesce(p_players_count, 0) >= 3 then 3200
      else 0
    end
    else 0
  end
$$;

create or replace function public.fixed_charity_amount_cents(
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
      when coalesce(p_players_count, 0) >= 8 then 700
      when coalesce(p_players_count, 0) >= 6 then 500
      when coalesce(p_players_count, 0) >= 4 then 300
      when coalesce(p_players_count, 0) >= 2 then 100
      else 0
    end
    when 'C' then case
      when coalesce(p_players_count, 0) >= 7 then 1000
      when coalesce(p_players_count, 0) >= 5 then 600
      when coalesce(p_players_count, 0) >= 3 then 300
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
  v_prize integer := 0;
  v_target_charity integer := 0;
  v_charity integer := 0;
  v_margin integer := 0;
  v_min_players integer := 1;
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

  if coalesce(v_league.plan_tier, '') = 'A' then
    v_prize := 0;
    v_charity := v_net;
    v_margin := 0;
  else
    v_min_players := public.minimum_players_for_rewards(v_league.plan_tier);

    if v_players_count < v_min_players then
      v_prize := 0;
      v_charity := 0;
      v_margin := v_net;
    else
      v_prize := least(public.fixed_prize_amount_cents(v_league.plan_tier, v_players_count), v_net);
      v_target_charity := public.fixed_charity_amount_cents(v_league.plan_tier, v_players_count);
      v_charity := least(v_target_charity, greatest(v_net - v_prize, 0));
      v_margin := greatest(v_net - v_prize - v_charity, 0);
    end if;
  end if;

  update public.leagues
  set
    qualification_days_min = case
      when coalesce(plan_tier, '') = 'C' then 20
      else qualification_days_min
    end,
    players_count = v_players_count,
    gross_revenue_cents = v_gross,
    estimated_store_fee_cents = v_estimated_store_fee,
    net_revenue_cents = v_net,
    prize_amount_cents = v_prize,
    charity_amount_cents = v_charity,
    commito_margin_cents = v_margin
  where id = p_league_id
  returning * into v_league;

  return v_league;
end;
$$;

update public.leagues
set qualification_days_min = 20
where plan_tier = 'C';

do $$
declare
  v_league_id uuid;
begin
  for v_league_id in
    select id from public.leagues
  loop
    perform public.recompute_league_financials(v_league_id);
  end loop;
end
$$;

grant execute on function public.minimum_players_for_rewards(text) to authenticated;
