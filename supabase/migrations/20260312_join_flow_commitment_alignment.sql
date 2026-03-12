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
  v_paywall_enabled boolean := public.get_paywall_enabled();
  v_payment_status text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_code is null or length(trim(p_code)) = 0 then
    raise exception 'invalid_invite_code';
  end if;

  select id, is_free, plan_tier
    into v_league_id, v_is_free, v_plan_tier
  from public.leagues
  where invite_code = upper(trim(p_code))
  limit 1;

  if v_league_id is null then
    raise exception 'invalid_invite_code';
  end if;

  if coalesce(v_is_free, false) or v_plan_tier is null then
    v_payment_status := 'free';
  else
    if v_plan_tier not in ('A', 'B', 'C') then
      raise exception 'payment_required';
    end if;

    if v_paywall_enabled then
      raise exception 'payment_required';
    end if;

    v_payment_status := 'paid';
  end if;

  insert into public.league_members (
    league_id, user_id, role, joined_at, payment_status, share_cents
  )
  values (
    v_league_id, v_uid, 'member', now(), v_payment_status, 0
  )
  on conflict (league_id, user_id) do update
    set joined_at = excluded.joined_at,
        payment_status = excluded.payment_status,
        share_cents = excluded.share_cents,
        role = case
          when public.league_members.role = 'owner' then 'owner'
          else excluded.role
        end;

  return v_league_id;
end;
$$;

create or replace function public.accept_invite_and_agree(p_league_id uuid) returns void
    language plpgsql
    security definer
    set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_is_free boolean;
  v_plan_tier text;
  v_payment_status text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select l.is_free, l.plan_tier
    into v_is_free, v_plan_tier
  from public.leagues l
  where l.id = p_league_id;

  if v_is_free is null and v_plan_tier is null then
    raise exception 'league_not_found';
  end if;

  if coalesce(v_is_free, false) or v_plan_tier is null then
    v_payment_status := 'free';
  else
    v_payment_status := 'agreed';
  end if;

  update public.league_members
    set agreed_at = coalesce(agreed_at, now()),
        payment_status = v_payment_status
  where league_id = p_league_id and user_id = v_uid;

  if not found then
    raise exception 'not_a_member';
  end if;
end;
$$;
