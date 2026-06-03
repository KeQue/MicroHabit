-- Production launch guardrail: paid leagues stay closed until server-side
-- purchase verification exists.
--
-- The app currently has PAID_LEAGUES_AVAILABLE=false, but public Supabase RPCs
-- must enforce the same rule because clients can call RPCs directly.

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
    raise exception 'not_authenticated';
  end if;

  if coalesce(p_is_free, false) is not true or p_plan_tier is not null then
    raise exception 'payment_required';
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
    null,
    p_month_key,
    true,
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
    'free'
  )
  on conflict (league_id, user_id) do update
    set role = 'owner',
        joined_at = excluded.joined_at,
        payment_status = excluded.payment_status;

  return v_league_id;
end;
$$;

grant execute on function public.create_league_and_join(text, text, text, text, boolean) to authenticated;
grant execute on function public.create_league_and_join(text, text, text, text, boolean) to service_role;

create or replace function public.join_league_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_league_id uuid;
  v_is_free boolean;
  v_month_key text;
  v_free_used_month text;
  v_already_member boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_code is null or length(trim(p_code)) = 0 then
    raise exception 'invalid_invite_code';
  end if;

  select id, is_free, month_key
    into v_league_id, v_is_free, v_month_key
  from public.leagues
  where invite_code = upper(trim(p_code))
  limit 1;

  if v_league_id is null then
    raise exception 'invalid_invite_code';
  end if;

  if coalesce(v_is_free, false) is not true then
    raise exception 'payment_required';
  end if;

  select exists (
    select 1
    from public.league_members lm
    where lm.league_id = v_league_id
      and lm.user_id = v_uid
  )
    into v_already_member;

  if v_already_member then
    return v_league_id;
  end if;

  select free_league_used_month
    into v_free_used_month
  from public.profiles
  where id = v_uid;

  if v_free_used_month is not null then
    raise exception 'free_league_already_used';
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
  );

  update public.profiles
  set free_league_used_month = v_month_key,
      free_used_at = now()
  where id = v_uid;

  return v_league_id;
end;
$$;

grant execute on function public.join_league_by_code(text) to authenticated;
grant execute on function public.join_league_by_code(text) to service_role;

create or replace function public.accept_invite_and_agree(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_is_free boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select l.is_free
    into v_is_free
  from public.leagues l
  where l.id = p_league_id;

  if v_is_free is null then
    raise exception 'league_not_found';
  end if;

  if coalesce(v_is_free, false) is not true then
    raise exception 'payment_required';
  end if;

  update public.league_members
    set agreed_at = coalesce(agreed_at, now()),
        payment_status = 'free'
  where league_id = p_league_id
    and user_id = v_uid;

  if not found then
    raise exception 'not_a_member';
  end if;
end;
$$;

grant execute on function public.accept_invite_and_agree(uuid) to authenticated;
grant execute on function public.accept_invite_and_agree(uuid) to service_role;

drop policy if exists daily_logs_insert_access_member_recent on public.daily_logs;
drop policy if exists daily_logs_update_access_member_recent on public.daily_logs;
drop policy if exists daily_logs_delete_access_member_recent on public.daily_logs;

create policy daily_logs_insert_free_member_recent
on public.daily_logs
for insert
to authenticated
with check (
  user_id = auth.uid()
  and log_date between ((now() at time zone 'utc')::date - 1) and (now() at time zone 'utc')::date
  and exists (
    select 1
    from public.league_members lm
    join public.leagues l on l.id = lm.league_id
    where lm.league_id = daily_logs.league_id
      and lm.user_id = auth.uid()
      and l.is_free = true
      and daily_logs.log_date >= (lm.joined_at)::date
  )
);

create policy daily_logs_update_free_member_recent
on public.daily_logs
for update
to authenticated
using (
  user_id = auth.uid()
  and log_date between ((now() at time zone 'utc')::date - 1) and (now() at time zone 'utc')::date
  and exists (
    select 1
    from public.league_members lm
    join public.leagues l on l.id = lm.league_id
    where lm.league_id = daily_logs.league_id
      and lm.user_id = auth.uid()
      and l.is_free = true
      and daily_logs.log_date >= (lm.joined_at)::date
  )
)
with check (
  user_id = auth.uid()
  and log_date between ((now() at time zone 'utc')::date - 1) and (now() at time zone 'utc')::date
  and exists (
    select 1
    from public.league_members lm
    join public.leagues l on l.id = lm.league_id
    where lm.league_id = daily_logs.league_id
      and lm.user_id = auth.uid()
      and l.is_free = true
      and daily_logs.log_date >= (lm.joined_at)::date
  )
);

create policy daily_logs_delete_free_member_recent
on public.daily_logs
for delete
to authenticated
using (
  user_id = auth.uid()
  and log_date between ((now() at time zone 'utc')::date - 1) and (now() at time zone 'utc')::date
  and exists (
    select 1
    from public.league_members lm
    join public.leagues l on l.id = lm.league_id
    where lm.league_id = daily_logs.league_id
      and lm.user_id = auth.uid()
      and l.is_free = true
      and daily_logs.log_date >= (lm.joined_at)::date
  )
);
