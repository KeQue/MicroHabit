-- Batch 3 LOCAL REVIEW ONLY. Production execution needs separate approval.
-- Read retained check-ins for the most recently completed Monday-Sunday UTC
-- week. This is a live summary, not an immutable snapshot or prize result.
create function public.get_free_league_weekly_recap(p_league_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_now timestamptz := commito_private.utc_now();
  v_week_start date;
  v_week_end date;
  v_finalizes_at timestamptz;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists(select 1 from public.league_members lm
    where lm.league_id=p_league_id and lm.user_id=auth.uid()) then
    raise exception 'not_league_member';
  end if;
  if not exists(select 1 from public.leagues l where l.id=p_league_id and l.is_free is true) then
    raise exception 'free_league_required';
  end if;

  v_week_start := (date_trunc('week',v_now at time zone 'utc') - interval '7 days')::date;
  v_week_end := v_week_start + 6;
  -- Sunday remains correctable on Monday under today's/yesterday's UTC rule.
  v_finalizes_at := (v_week_start + 8)::timestamp at time zone 'utc';

  with week_logs as materialized (
    select distinct dl.user_id,dl.log_date
    from public.daily_logs dl
    where dl.league_id=p_league_id and dl.completed is true
      and dl.log_date between v_week_start and v_week_end
  ), roster as (
    select lm.user_id,
      coalesce(nullif(btrim(p.username),''),nullif(btrim(p.name),''),'User') as raw_name
    from public.league_members lm
    join public.profiles p on p.id=lm.user_id
    join public.leagues l on l.id=lm.league_id
    where lm.league_id=p_league_id
      and ((coalesce(lm.joined_at,l.created_at) at time zone 'utc')::date<=v_week_end
        or exists(select 1 from public.daily_logs dl where dl.league_id=p_league_id
          and dl.user_id=lm.user_id and dl.log_date between v_week_start and v_week_end))
  ), member_days as (
    select r.user_id,
      case when strpos(r.raw_name,'@')>1 then split_part(r.raw_name,'@',1) else r.raw_name end as display_name,
      count(w.log_date)::integer as active_days
    from roster r left join week_logs w on w.user_id=r.user_id
    group by r.user_id,r.raw_name
  )
  select jsonb_build_object(
    'week_start',v_week_start,'week_end',v_week_end,
    'provisional',v_now<v_finalizes_at,
    'finalizes_at',to_char(v_finalizes_at at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'generated_at',to_char(v_now at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'total_member_days',coalesce((select sum(m.active_days)::integer from member_days m),0),
    'group_active_days',(select count(distinct w.log_date)::integer from week_logs w join roster r on r.user_id=w.user_id),
    'members',coalesce((select jsonb_agg(to_jsonb(m) order by m.display_name collate "C",m.user_id)
      from member_days m),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
alter function public.get_free_league_weekly_recap(uuid) owner to postgres;
revoke all on function public.get_free_league_weekly_recap(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_free_league_weekly_recap(uuid) to authenticated;
