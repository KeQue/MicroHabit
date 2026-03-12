alter table public.leagues
  add column if not exists entry_fee_cents integer not null default 0,
  add column if not exists platform_fee_cents integer not null default 0,
  add column if not exists winner_share_bps integer not null default 0,
  add column if not exists charity_share_bps integer not null default 0,
  add column if not exists qualification_days_min integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leagues_entry_fee_cents_check'
  ) then
    alter table public.leagues
      add constraint leagues_entry_fee_cents_check check (entry_fee_cents >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'leagues_platform_fee_cents_check'
  ) then
    alter table public.leagues
      add constraint leagues_platform_fee_cents_check check (platform_fee_cents >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'leagues_winner_share_bps_check'
  ) then
    alter table public.leagues
      add constraint leagues_winner_share_bps_check check (winner_share_bps >= 0 and winner_share_bps <= 10000);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'leagues_charity_share_bps_check'
  ) then
    alter table public.leagues
      add constraint leagues_charity_share_bps_check check (charity_share_bps >= 0 and charity_share_bps <= 10000);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'leagues_qualification_days_min_check'
  ) then
    alter table public.leagues
      add constraint leagues_qualification_days_min_check check (qualification_days_min >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'leagues_share_split_check'
  ) then
    alter table public.leagues
      add constraint leagues_share_split_check check (
        winner_share_bps + charity_share_bps in (0, 10000)
      );
  end if;
end
$$;

create or replace function public.plan_entry_fee_cents(p_plan_tier text) returns integer
    language sql
    immutable
    set search_path to 'public'
as $$
  select case p_plan_tier
    when 'A' then 500
    when 'B' then 1000
    when 'C' then 2000
    else 0
  end
$$;

create or replace function public.plan_platform_fee_cents(p_plan_tier text) returns integer
    language sql
    immutable
    set search_path to 'public'
as $$
  select case
    when p_plan_tier in ('A', 'B', 'C') then 100
    else 0
  end
$$;

create or replace function public.plan_winner_share_bps(p_plan_tier text) returns integer
    language sql
    immutable
    set search_path to 'public'
as $$
  select case p_plan_tier
    when 'A' then 0
    when 'B' then 7000
    when 'C' then 8000
    else 0
  end
$$;

create or replace function public.plan_charity_share_bps(p_plan_tier text) returns integer
    language sql
    immutable
    set search_path to 'public'
as $$
  select case p_plan_tier
    when 'A' then 10000
    when 'B' then 3000
    when 'C' then 2000
    else 0
  end
$$;

create or replace function public.plan_qualification_days_min(p_plan_tier text) returns integer
    language sql
    immutable
    set search_path to 'public'
as $$
  select case p_plan_tier
    when 'C' then 12
    else 0
  end
$$;

update public.leagues
set
  entry_fee_cents = case plan_tier
    when 'A' then 500
    when 'B' then 1000
    when 'C' then 2000
    else 0
  end,
  platform_fee_cents = case
    when plan_tier in ('A', 'B', 'C') then 100
    else 0
  end,
  winner_share_bps = case plan_tier
    when 'A' then 0
    when 'B' then 7000
    when 'C' then 8000
    else 0
  end,
  charity_share_bps = case plan_tier
    when 'A' then 10000
    when 'B' then 3000
    when 'C' then 2000
    else 0
  end,
  qualification_days_min = case plan_tier
    when 'C' then 12
    else 0
  end
where
  coalesce(entry_fee_cents, 0) = 0
  and coalesce(platform_fee_cents, 0) = 0
  and coalesce(winner_share_bps, 0) = 0
  and coalesce(charity_share_bps, 0) = 0
  and coalesce(qualification_days_min, 0) = 0;

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
  elsif v_is_free then
    v_entry_fee_cents := 0;
    v_platform_fee_cents := 0;
    v_winner_share_bps := 0;
    v_charity_share_bps := 0;
    v_qualification_days_min := 0;
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
    'active',
    public.generate_invite_code(),
    v_uid
  )
  returning id into v_league_id;

  insert into public.league_members (league_id, user_id, role, joined_at)
  values (v_league_id, v_uid, 'owner', now())
  on conflict (league_id, user_id) do nothing;

  return v_league_id;
end;
$$;
