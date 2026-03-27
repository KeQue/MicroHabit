create or replace function public.toggle_daily_log(
  p_league_id uuid,
  p_log_date date,
  p_completed boolean
) returns void
    language plpgsql
    security definer
    set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_is_free boolean := false;
  v_plan_tier text := null;
  v_league_status text := 'active';
  v_payment_status text := 'unpaid';
  v_joined_at timestamp with time zone := null;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_log_date is null then
    raise exception 'invalid_log_date';
  end if;

  if p_log_date < (now() at time zone 'utc')::date - 1
     or p_log_date > (now() at time zone 'utc')::date then
    raise exception 'Only today or yesterday can be edited';
  end if;

  select
    l.is_free,
    l.plan_tier,
    l.status,
    lm.payment_status,
    lm.joined_at
  into
    v_is_free,
    v_plan_tier,
    v_league_status,
    v_payment_status,
    v_joined_at
  from public.leagues l
  join public.league_members lm
    on lm.league_id = l.id
  where l.id = p_league_id
    and lm.user_id = v_uid
  limit 1;

  if v_joined_at is null then
    raise exception 'not_a_member';
  end if;

  if v_league_status = 'completed' then
    raise exception 'league_closed';
  end if;

  if p_log_date < v_joined_at::date then
    raise exception 'before_join_date';
  end if;

  if not coalesce(v_is_free, false)
     and v_plan_tier is not null
     and coalesce(v_payment_status, 'unpaid') not in ('paid', 'free') then
    raise exception 'payment_required';
  end if;

  insert into public.daily_logs (league_id, user_id, log_date, completed, created_at, updated_at)
  values (p_league_id, v_uid, p_log_date, p_completed, now(), now())
  on conflict (league_id, user_id, log_date)
  do update set
    completed = excluded.completed,
    updated_at = now();
end;
$$;

revoke all on function public.toggle_daily_log(uuid, date) from public;
revoke all on function public.toggle_daily_log(uuid, date) from anon;
revoke all on function public.toggle_daily_log(uuid, date) from authenticated;
grant execute on function public.toggle_daily_log(uuid, date) to authenticated;

revoke all on function public.toggle_daily_log(uuid, date, boolean) from public;
revoke all on function public.toggle_daily_log(uuid, date, boolean) from anon;
revoke all on function public.toggle_daily_log(uuid, date, boolean) from authenticated;
grant execute on function public.toggle_daily_log(uuid, date, boolean) to authenticated;

drop policy if exists "delete own daily logs" on public.daily_logs;
drop policy if exists "insert own daily logs" on public.daily_logs;
drop policy if exists "update own daily logs" on public.daily_logs;
drop policy if exists "daily_logs_update_self" on public.daily_logs;
drop policy if exists "daily_logs_upsert_self" on public.daily_logs;
drop policy if exists "daily_logs_write_only_paid_or_free" on public.daily_logs;
drop policy if exists "daily_logs_insert_after_join" on public.daily_logs;
drop policy if exists "daily_logs_update_after_join" on public.daily_logs;

drop policy if exists "league_members_insert_self" on public.league_members;
drop policy if exists "league_members_delete_self" on public.league_members;

drop policy if exists "leagues_insert_self" on public.leagues;
