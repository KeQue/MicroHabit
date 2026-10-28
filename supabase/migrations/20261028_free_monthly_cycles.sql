-- Batch 1, LOCAL REVIEW ONLY. Apply to production only after explicit approval.
-- Free cycles are separate from prize/payment settlement and never close leagues.
create schema if not exists commito_private;
revoke all on schema commito_private from public, anon, authenticated, service_role;

create or replace function commito_private.utc_now()
returns timestamptz language sql volatile set search_path = ''
as $$ select clock_timestamp(); $$;
revoke all on function commito_private.utc_now() from public, anon, authenticated, service_role;

create table public.free_league_cycles (
  league_id uuid not null references public.leagues(id) on delete cascade,
  month_start date not null check (extract(day from month_start) = 1),
  finalizes_at timestamptz not null,
  finalized_at timestamptz not null default commito_private.utc_now(),
  primary key (league_id, month_start)
);

create table public.free_league_cycle_results (
  league_id uuid not null,
  month_start date not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  days_completed integer not null check (days_completed between 0 and 31),
  longest_streak integer not null check (longest_streak between 0 and days_completed),
  position integer not null check (position > 0),
  primary key (league_id, month_start, user_id),
  unique (league_id, month_start, position),
  foreign key (league_id, month_start)
    references public.free_league_cycles(league_id, month_start) on delete cascade
);

alter table public.free_league_cycles enable row level security;
alter table public.free_league_cycle_results enable row level security;
revoke all on public.free_league_cycles, public.free_league_cycle_results
  from public, anon, authenticated, service_role;
grant select on public.free_league_cycles, public.free_league_cycle_results to authenticated;
create policy free_cycle_member_read on public.free_league_cycles for select to authenticated
  using (public.is_league_member(league_id));
create policy free_cycle_result_member_read on public.free_league_cycle_results for select to authenticated
  using (public.is_league_member(league_id));

create or replace function commito_private.free_month_scores(p_league_id uuid, p_month date)
returns table(user_id uuid, display_name text, days_completed integer, longest_streak integer, "position" integer)
language sql stable set search_path = '' as $$
  with bounds as (
    select p_month as first_day, (p_month + interval '1 month')::date as next_month
  ), roster as (
    select lm.user_id,
      coalesce(nullif(btrim(p.username), ''), nullif(btrim(p.name), ''), 'User') as raw_name
    from public.league_members lm
    join public.profiles p on p.id = lm.user_id
    join public.leagues l on l.id = lm.league_id
    cross join bounds b
    where lm.league_id = p_league_id
      and ((coalesce(lm.joined_at, l.created_at) at time zone 'utc')::date < b.next_month
        or exists (
          select 1 from public.daily_logs dl where dl.league_id = p_league_id
            and dl.user_id = lm.user_id and dl.log_date >= b.first_day and dl.log_date < b.next_month
        ))
  ), completed as (
    select dl.user_id, dl.log_date,
      dl.log_date - (row_number() over (partition by dl.user_id order by dl.log_date))::integer as island
    from public.daily_logs dl cross join bounds b
    where dl.league_id = p_league_id and dl.completed is true
      and dl.log_date >= b.first_day and dl.log_date < b.next_month
  ), streaks as (
    select c.user_id, count(*)::integer as length from completed c group by c.user_id, c.island
  ), totals as (
    select r.user_id,
      case when strpos(r.raw_name, '@') > 1 then split_part(r.raw_name, '@', 1) else r.raw_name end as display_name,
      (select count(*)::integer from completed c where c.user_id = r.user_id) as days_completed,
      coalesce((select max(s.length) from streaks s where s.user_id = r.user_id), 0) as longest_streak
    from roster r
  )
  select t.user_id, t.display_name, t.days_completed, t.longest_streak,
    (row_number() over (order by t.days_completed desc, t.display_name collate "C", t.user_id))::integer as "position"
  from totals t;
$$;
revoke all on function commito_private.free_month_scores(uuid,date) from public, anon, authenticated, service_role;

create or replace function commito_private.free_cycle_cutoff(p_month date)
returns timestamptz language sql immutable set search_path = ''
as $$ select (p_month + interval '1 month 1 day') at time zone 'utc'; $$;
revoke all on function commito_private.free_cycle_cutoff(date) from public, anon, authenticated, service_role;

create or replace function commito_private.finalize_free_month(p_league_id uuid, p_month date)
returns void language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('commito-free-cycle:' || p_league_id::text, 0));
  if commito_private.utc_now() < commito_private.free_cycle_cutoff(p_month) then return; end if;
  if exists(select 1 from public.free_league_cycles where league_id=p_league_id and month_start=p_month) then return; end if;
  insert into public.free_league_cycles(league_id,month_start,finalizes_at)
    values(p_league_id,p_month,commito_private.free_cycle_cutoff(p_month));
  insert into public.free_league_cycle_results
    (league_id,month_start,user_id,display_name,days_completed,longest_streak,position)
    select p_league_id,p_month,s.user_id,s.display_name,s.days_completed,s.longest_streak,s.position
    from commito_private.free_month_scores(p_league_id,p_month) s;
end;
$$;
revoke all on function commito_private.finalize_free_month(uuid,date) from public, anon, authenticated, service_role;

create or replace function public.get_free_league_history(
  p_league_id uuid, p_before date default null, p_limit integer default 12
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_first date;
  v_current date;
  v_before date;
  v_month date;
  v_final boolean;
  v_results jsonb;
  v_history jsonb := '[]'::jsonb;
  v_league public.leagues;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists(select 1 from public.league_members where league_id=p_league_id and user_id=auth.uid()) then
    raise exception 'not_league_member';
  end if;
  select * into v_league from public.leagues where id=p_league_id;
  if v_league.is_free is distinct from true then raise exception 'free_league_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('commito-free-cycle:' || p_league_id::text, 0));
  v_current := date_trunc('month',commito_private.utc_now() at time zone 'utc')::date;
  v_before := coalesce(p_before,v_current);
  if p_limit is null or p_limit < 1 or p_limit > 24 or extract(day from v_before) <> 1 or v_before > v_current then
    raise exception 'invalid_history_request';
  end if;
  select date_trunc('month',least(
    coalesce((v_league.created_at at time zone 'utc')::date,v_current),
    coalesce(min(log_date),v_current)))::date into v_first
  from public.daily_logs where league_id=p_league_id;
  -- Generate only the requested page, independent of how old the league is.
  for v_month in select (v_before - make_interval(months=>i))::date
      from generate_series(1,p_limit) i
      where (v_before - make_interval(months=>i))::date >= v_first order by i
  loop
    v_final := commito_private.utc_now() >= commito_private.free_cycle_cutoff(v_month);
    if v_final then
      perform commito_private.finalize_free_month(p_league_id,v_month);
      select coalesce(jsonb_agg(to_jsonb(r)-'league_id'-'month_start' order by r.position),'[]'::jsonb)
        into v_results from public.free_league_cycle_results r
        where league_id=p_league_id and month_start=v_month;
    else
      select coalesce(jsonb_agg(to_jsonb(r) order by r.position),'[]'::jsonb)
        into v_results from commito_private.free_month_scores(p_league_id,v_month) r;
    end if;
    v_history := v_history || jsonb_build_array(jsonb_build_object(
      'month_start',v_month,'status',case when v_final then 'final' else 'provisional' end,
      'finalizes_at',to_char(commito_private.free_cycle_cutoff(v_month) at time zone 'utc',
        'YYYY-MM-DD"T"HH24:MI:SS"Z"'),'results',v_results));
  end loop;
  return v_history;
end;
$$;
revoke all on function public.get_free_league_history(uuid,date,integer) from public, anon, service_role;
grant execute on function public.get_free_league_history(uuid,date,integer) to authenticated;

create or replace function commito_private.guard_free_cycle_log()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_now date;
  v_date date;
  v_league uuid;
begin
  -- Foreign-key cascades must still remove data for account/league deletion.
  -- Direct client deletes run at depth 1 and remain subject to this guard/RLS.
  if tg_op='DELETE' and pg_trigger_depth()>1 then return old; end if;
  for v_league in
    select distinct input_leagues.league_id from unnest(case
      when tg_op='INSERT' then array[new.league_id]
      when tg_op='DELETE' then array[old.league_id]
      else array[old.league_id,new.league_id] end) as input_leagues(league_id)
      where exists(select 1 from public.leagues l where l.id=input_leagues.league_id and l.is_free is true)
      order by input_leagues.league_id
  loop
    perform pg_advisory_xact_lock(hashtextextended('commito-free-cycle:' || v_league::text,0));
  end loop;
  -- Read real time after obtaining the same lock used by finalization. A long
  -- transaction cannot use an old now() value to modify a newly closed month.
  v_now := (commito_private.utc_now() at time zone 'utc')::date;
  if tg_op <> 'INSERT' and exists(select 1 from public.leagues where id=old.league_id and is_free is true) then
    v_date := old.log_date;
    if exists(select 1 from public.free_league_cycles where league_id=old.league_id
        and month_start=date_trunc('month',v_date)::date)
        or v_date < v_now-1 or v_date > v_now then
      raise exception 'month_checkin_locked' using errcode='42501';
    end if;
  end if;
  if tg_op <> 'DELETE' and exists(select 1 from public.leagues where id=new.league_id and is_free is true) then
    v_date := new.log_date;
    if exists(select 1 from public.free_league_cycles where league_id=new.league_id
        and month_start=date_trunc('month',v_date)::date)
        or v_date < v_now-1 or v_date > v_now then
      raise exception 'month_checkin_locked' using errcode='42501';
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function commito_private.guard_free_cycle_log() from public, anon, authenticated, service_role;
create trigger guard_free_cycle_log before insert or update or delete on public.daily_logs
  for each row execute function commito_private.guard_free_cycle_log();

-- Display-name edits must not retroactively reorder a closed month whose
-- snapshot has not yet been read. Capture closed results before the edit.
create or replace function commito_private.freeze_cycles_before_name_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_league record;
  v_month date;
  v_last date;
  v_first date;
  v_pending integer := 0;
begin
  if new.username is not distinct from old.username and new.name is not distinct from old.name then return new; end if;
  v_last := (date_trunc('month',commito_private.utc_now() at time zone 'utc') - interval '1 month')::date;
  for v_league in select l.id,l.created_at from public.leagues l
      join public.league_members lm on lm.league_id=l.id
      where lm.user_id=old.id and l.is_free is true order by l.id
  loop
    perform pg_advisory_xact_lock(hashtextextended('commito-free-cycle:' || v_league.id::text,0));
    select date_trunc('month',least(coalesce((v_league.created_at at time zone 'utc')::date,v_last),
        coalesce(min(log_date),v_last)))::date into v_first
      from public.daily_logs where league_id=v_league.id;
    -- Refuse an exceptional/corrupt backfill rather than blocking a profile
    -- update indefinitely or silently rewriting unsnapshotted history.
    if not isfinite(v_first) or v_first < v_last - interval '100 years' then
      raise exception 'history_backfill_required';
    end if;
    for v_month in select s::date
      from generate_series(v_first::timestamp,v_last::timestamp,interval '1 month') s
      where commito_private.free_cycle_cutoff(s::date) <= commito_private.utc_now()
        and not exists(select 1 from public.free_league_cycles c
          where c.league_id=v_league.id and c.month_start=s::date)
    loop
      v_pending := v_pending + 1;
      if v_pending > 240 then raise exception 'history_backfill_required'; end if;
      perform commito_private.finalize_free_month(v_league.id,v_month);
    end loop;
  end loop;
  return new;
end;
$$;
revoke all on function commito_private.freeze_cycles_before_name_change() from public, anon, authenticated, service_role;
create trigger freeze_cycles_before_name_change before update of username,name on public.profiles
  for each row execute function commito_private.freeze_cycles_before_name_change();
