-- Batch 2 LOCAL REVIEW ONLY. Production execution needs separate approval.
-- No collector or extra personal-data store: aggregate existing retained rows.
-- Preserve legacy records and operator/service grants, close unused app writes.
revoke all on table public.analytics_events from public, anon, authenticated;
drop policy if exists analytics_events_insert_client on public.analytics_events;

create or replace function commito_private.free_engagement_report(
  p_as_of timestamptz default clock_timestamp(),
  p_excluded_leagues uuid[] default '{}'::uuid[]
) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_day date;
  v_month date;
  v_first_month date;
  v_first_week date;
  v_report jsonb;
begin
  if p_as_of is null or not isfinite(p_as_of) then
    raise exception 'invalid_report_cutoff';
  end if;
  v_day := (p_as_of at time zone 'utc')::date;
  v_month := date_trunc('month',p_as_of at time zone 'utc')::date;
  v_first_month := (v_month - interval '11 months')::date;
  v_first_week := (date_trunc('week',p_as_of at time zone 'utc') - interval '11 weeks')::date;

  with leagues as materialized (
    select l.id,l.created_by,l.created_at,
      (l.created_at at time zone 'utc')::date as created_date
    from public.leagues l
    where l.is_free is true and l.created_at <= p_as_of
      and not exists(select 1 from unnest(coalesce(p_excluded_leagues,'{}'::uuid[])) x(id) where x.id=l.id)
  ), members as materialized (
    select lm.league_id,lm.user_id,lm.joined_at
    from public.league_members lm join leagues l on l.id=lm.league_id
    where lm.user_id<>l.created_by and lm.joined_at<=p_as_of
  ), logs as materialized (
    select dl.league_id,dl.user_id,dl.log_date,
      date_trunc('month',dl.log_date::timestamp)::date as month_start,
      date_trunc('week',dl.log_date::timestamp)::date as week_start
    from public.daily_logs dl join leagues l on l.id=dl.league_id
    where dl.completed is true and dl.created_at<=p_as_of
      and dl.log_date>=v_first_month and dl.log_date<=v_day
  ), months as (
    select (v_first_month + make_interval(months=>i))::date as month_start
    from generate_series(0,11) i
  ), weeks as (
    select (v_first_week + i*7)::date as week_start from generate_series(0,11) i
  ), month_leagues as materialized (
    select month_start,league_id,count(*) as completion_days,count(distinct user_id) as participants
    from logs group by month_start,league_id
  ), month_members as materialized (
    select distinct month_start,league_id,user_id from logs
  ), week_leagues as materialized (
    select week_start,league_id,count(*) as completion_days,count(distinct user_id) as participants
    from logs where log_date>=v_first_week group by week_start,league_id
  ), activation as materialized (
    select l.id,date_trunc('month',l.created_date::timestamp)::date as created_month,
      ((l.created_date+8)::timestamp at time zone 'utc')<=p_as_of as fully_observed,
      count(distinct dl.user_id)>=2 as activated
    from leagues l left join logs dl on dl.league_id=l.id
      and dl.log_date>=l.created_date and dl.log_date<l.created_date+7
    where l.created_date>=v_first_month
    group by l.id,l.created_date
  ), weekly as (
    select w.week_start,
      p_as_of<((w.week_start+7)::timestamp at time zone 'utc') as partial_calendar_week,
      p_as_of>=((w.week_start+7)::timestamp at time zone 'utc')
        and p_as_of<((w.week_start+8)::timestamp at time zone 'utc') as correction_window_open,
      count(wl.league_id) as active_leagues,
      count(wl.league_id) filter(where wl.participants>=2) as socially_active_leagues,
      coalesce(sum(wl.participants),0)::bigint as active_member_league_pairs,
      coalesce(sum(wl.completion_days),0)::bigint as completed_league_member_days
    from weeks w left join week_leagues wl on wl.week_start=w.week_start
    group by w.week_start
  ), activation_cohorts as (
    select m.month_start as created_month,count(a.id) as created_leagues,
      count(a.id) filter(where a.fully_observed) as fully_observed_leagues,
      count(a.id) filter(where a.fully_observed and a.activated) as activated_fully_observed_leagues,
      count(a.id) filter(where not a.fully_observed) as provisional_leagues,
      count(a.id) filter(where not a.fully_observed and a.activated) as activated_provisional_leagues
    from months m left join activation a on a.created_month=m.month_start
    group by m.month_start
  ), monthly as (
    select m.month_start,
      case when p_as_of>=commito_private.free_cycle_cutoff(m.month_start) then 'ended'
        when p_as_of>=((m.month_start+interval '1 month') at time zone 'utc') then 'correction_window'
        else 'in_progress' end as cycle_status,
      (select count(*) from leagues l where l.created_date>=m.month_start
        and l.created_date<(m.month_start+interval '1 month')::date) as leagues_created,
      (select count(*) from members lm where lm.joined_at>=(m.month_start::timestamp at time zone 'utc')
        and lm.joined_at<((m.month_start+interval '1 month') at time zone 'utc')) as noncreator_membership_joins,
      (select count(*) from month_leagues ml where ml.month_start=m.month_start) as active_leagues,
      (select count(*) from month_leagues ml where ml.month_start=m.month_start and ml.participants>=2) as socially_active_leagues,
      (select count(*) from month_members mm where mm.month_start=m.month_start) as active_member_league_pairs,
      coalesce((select sum(ml.completion_days) from month_leagues ml where ml.month_start=m.month_start),0)::bigint as completed_league_member_days,
      case when p_as_of>=commito_private.free_cycle_cutoff(m.month_start)
        then (select count(*) from leagues l where l.created_date<(m.month_start+interval '1 month')::date)
        else 0 end as all_ended_league_calendar_cycles,
      case when p_as_of>=commito_private.free_cycle_cutoff(m.month_start)
        then (select count(*) from month_leagues ml where ml.month_start=m.month_start)
        else 0 end as active_ended_league_calendar_cycles,
      (m.month_start+interval '1 month')::date as followup_month,
      case when (m.month_start+interval '1 month')::date>v_day then 'future'
        when p_as_of>=commito_private.free_cycle_cutoff((m.month_start+interval '1 month')::date) then 'complete'
        when p_as_of>=((m.month_start+interval '2 months') at time zone 'utc') then 'correction_window'
        else 'partial' end as followup_status,
      (select count(*) from month_leagues ml where ml.month_start=m.month_start) as continuation_denominator_active_leagues,
      (select count(*) from month_leagues a join month_leagues b on b.league_id=a.league_id
        and b.month_start=(m.month_start+interval '1 month')::date where a.month_start=m.month_start) as continuing_leagues_observed,
      (select count(*) from month_members mm where mm.month_start=m.month_start) as return_denominator_member_league_pairs,
      (select count(*) from month_members a join month_members b on b.league_id=a.league_id and b.user_id=a.user_id
        and b.month_start=(m.month_start+interval '1 month')::date where a.month_start=m.month_start) as returning_member_league_pairs_observed
    from months m
  )
  select jsonb_build_object(
    'as_of_utc',to_char(p_as_of at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'basis','retained_saved_state',
    'as_of_is_not_a_historical_state_restore',true,
    'window',jsonb_build_object('first_month',v_first_month,'first_week',v_first_week,
      'current_month',v_month,'current_utc_date',v_day,'months',12,'weeks',12),
    'totals_12_months',jsonb_build_object(
      'leagues_created',(select count(*) from leagues where created_date>=v_first_month),
      'noncreator_membership_joins',(select count(*) from members where joined_at>=(v_first_month::timestamp at time zone 'utc')),
      'completed_league_member_days',(select count(*) from logs)),
    'weekly',(select jsonb_agg(to_jsonb(w) order by w.week_start) from weekly w),
    'activation_7_utc_dates',(select jsonb_agg(to_jsonb(a) order by a.created_month) from activation_cohorts a),
    'monthly',(select jsonb_agg(to_jsonb(m) order by m.month_start) from monthly m)
  ) into v_report;
  return v_report;
end;
$$;
revoke all on function commito_private.free_engagement_report(timestamptz,uuid[])
  from public, anon, authenticated, service_role;
