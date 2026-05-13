-- Explicitly define the RPC used by the join screen to move a paid/testing
-- invite from unpaid/trial into an accepted access state.
--
-- This is still MVP/testing behavior until RevenueCat verification updates
-- members to "paid" in production.

create or replace function public.accept_invite_and_agree(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_is_free boolean;
  v_plan_tier text;
  v_user_plan text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select l.is_free, l.plan_tier
    into v_is_free, v_plan_tier
  from public.leagues l
  where l.id = p_league_id;

  if v_is_free is null then
    raise exception 'league_not_found';
  end if;

  if v_is_free then
    update public.league_members
      set agreed_at = coalesce(agreed_at, now()),
          payment_status = coalesce(payment_status, 'free')
    where league_id = p_league_id
      and user_id = v_uid;

    if not found then
      raise exception 'not_a_member';
    end if;

    return;
  end if;

  select p.plan_tier
    into v_user_plan
  from public.profiles p
  where p.id = v_uid;

  v_user_plan := coalesce(v_user_plan, 'free');

  if v_user_plan = 'free' then
    raise exception 'payment_required';
  end if;

  if v_plan_tier is not null and v_user_plan <> v_plan_tier then
    raise exception 'payment_required';
  end if;

  update public.league_members
    set agreed_at = now(),
        payment_status = 'agreed'
  where league_id = p_league_id
    and user_id = v_uid;

  if not found then
    raise exception 'not_a_member';
  end if;
end;
$$;

grant execute on function public.accept_invite_and_agree(uuid) to authenticated;
grant execute on function public.accept_invite_and_agree(uuid) to service_role;
