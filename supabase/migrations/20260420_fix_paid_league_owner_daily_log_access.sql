-- Ensure owners of paid leagues can write daily logs.
--
-- Root cause:
-- create_league_and_join() inserted the league creator into league_members
-- without an explicit payment_status, so the table default of 'free' was used.
-- RLS for daily_logs only allows writes for free leagues or members whose
-- payment_status is 'paid', which caused optimistic UI toggles to revert.

-- 1) Repair existing paid-league owners that were created with the default
--    free payment status.
update public.league_members lm
set payment_status = 'paid'
from public.leagues l
where l.id = lm.league_id
  and l.is_free = false
  and lm.role = 'owner'
  and lm.payment_status = 'free';

-- 2) Fix the league creation function so future paid-league owners are marked
--    as paid immediately.
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
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.leagues (
    name,
    activity,
    plan_tier,
    month_key,
    is_free,
    status,
    invite_code,
    created_by
  )
  values (
    p_name,
    p_activity,
    p_plan_tier,
    p_month_key,
    p_is_free,
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
    payment_status
  )
  values (
    v_league_id,
    v_uid,
    'owner',
    now(),
    case when p_is_free then 'free' else 'paid' end
  )
  on conflict (league_id, user_id) do update
    set role = 'owner',
        joined_at = excluded.joined_at,
        payment_status = excluded.payment_status;

  return v_league_id;
end;
$$;

