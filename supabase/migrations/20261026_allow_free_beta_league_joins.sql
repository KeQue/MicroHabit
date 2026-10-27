-- Free beta participants may join multiple leagues. Creation already permits
-- multiple free leagues in the 20260603 paid-access guard migration.
-- Keep historical profile allowance fields untouched for a later paid rollout.
create or replace function public.join_league_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_league_id uuid;
  v_is_free boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_code is null or length(trim(p_code)) = 0 then
    raise exception 'invalid_invite_code';
  end if;

  select id, is_free
    into v_league_id, v_is_free
  from public.leagues
  where invite_code = upper(trim(p_code))
  limit 1;

  if v_league_id is null then
    raise exception 'invalid_invite_code';
  end if;

  -- Apply the paid lock even when the caller already belongs to that league.
  if coalesce(v_is_free, false) is not true then
    raise exception 'payment_required';
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
    v_league_id,
    v_uid,
    'member',
    now(),
    'free',
    0
  )
  -- Repeated or simultaneous joins must not reset the original membership,
  -- including joined_at, owner/admin role, agreement, or payment information.
  on conflict (league_id, user_id) do nothing;

  return v_league_id;
end;
$$;

-- PUBLIC execute privileges otherwise also apply to anonymous callers.
revoke all on function public.join_league_by_code(text) from public;
revoke all on function public.join_league_by_code(text) from anon;
grant execute on function public.join_league_by_code(text) to authenticated;
grant execute on function public.join_league_by_code(text) to service_role;
