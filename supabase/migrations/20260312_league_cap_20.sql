alter table public.leagues
  add column if not exists max_players integer not null default 20;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leagues_max_players_check'
  ) then
    alter table public.leagues
      add constraint leagues_max_players_check check (max_players > 0 and max_players <= 20);
  end if;
end
$$;

update public.leagues
set max_players = 20
where coalesce(max_players, 0) <> 20;

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
    max_players,
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
    20,
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
  v_max_players integer := 20;
  v_member_count integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_code is null or length(trim(p_code)) = 0 then
    raise exception 'invalid_invite_code';
  end if;

  select id, is_free, plan_tier, status, max_players
    into v_league_id, v_is_free, v_plan_tier, v_status, v_max_players
  from public.leagues
  where invite_code = upper(trim(p_code))
  limit 1;

  if v_league_id is null then
    raise exception 'invalid_invite_code';
  end if;

  if v_status = 'completed' then
    raise exception 'league_closed';
  end if;

  if exists (
    select 1
    from public.league_members
    where league_id = v_league_id
      and user_id = v_uid
  ) then
    return v_league_id;
  end if;

  select count(*)
    into v_member_count
  from public.league_members
  where league_id = v_league_id;

  if v_member_count >= coalesce(v_max_players, 20) then
    raise exception 'league_full';
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

grant execute on function public.join_league_by_code(text) to authenticated;
grant execute on function public.create_league_and_join(text, text, text, text, boolean) to authenticated;
