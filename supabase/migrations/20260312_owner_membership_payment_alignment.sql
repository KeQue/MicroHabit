update public.league_members lm
set
  payment_status = 'paid',
  agreed_at = coalesce(lm.agreed_at, lm.joined_at, now()),
  paid_at = coalesce(lm.paid_at, lm.joined_at, now())
from public.leagues l
where l.id = lm.league_id
  and lm.role = 'owner'
  and coalesce(l.is_free, false) = false
  and l.plan_tier in ('A', 'B', 'C')
  and lm.payment_status <> 'paid';

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
    v_owner_payment_status := 'paid';
    v_owner_agreed_at := now();
    v_owner_paid_at := now();
  elsif v_is_free then
    v_entry_fee_cents := 0;
    v_platform_fee_cents := 0;
    v_winner_share_bps := 0;
    v_charity_share_bps := 0;
    v_qualification_days_min := 0;
    v_owner_payment_status := 'free';
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

  return v_league_id;
end;
$$;
