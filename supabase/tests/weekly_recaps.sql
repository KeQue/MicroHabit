-- Synthetic isolated database ONLY. All fixtures and clock overrides roll back.
begin;
create function pg_temp.recap_assert(p_ok boolean,p_message text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'FAIL: %',p_message; end if;
end;
$$;
create function pg_temp.recap_clock(p_at timestamptz)
returns void language plpgsql as $$
begin
  execute format('create or replace function commito_private.utc_now() returns timestamptz language sql volatile set search_path = '''' as %L',
    'select ' || quote_literal(p_at::text) || '::timestamptz');
end;
$$;
do $$
declare
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); zero_user uuid:=gen_random_uuid();
  late_user uuid:=gen_random_uuid(); later_user uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
  league uuid; paid uuid:=gen_random_uuid(); empty_league uuid:=gen_random_uuid();
  uid uuid; start_day date; log_day date; monday date; result jsonb; same_result jsonb;
  failed boolean; names text[];
begin
  perform pg_temp.recap_assert(has_function_privilege('authenticated','public.get_free_league_weekly_recap(uuid)','execute'),
    'authenticated member endpoint unavailable');
  perform pg_temp.recap_assert(not has_function_privilege('anon','public.get_free_league_weekly_recap(uuid)','execute')
    and not has_function_privilege('service_role','public.get_free_league_weekly_recap(uuid)','execute'),
    'anon/service_role inherited recap execution');
  perform pg_temp.recap_assert((select prosecdef and proowner='postgres'::regrole and proconfig=array['search_path=""']
    from pg_proc where oid='public.get_free_league_weekly_recap(uuid)'::regprocedure),
    'definer owner/search path differs');
  perform pg_temp.recap_assert(not has_schema_privilege('authenticated','commito_private','usage')
    and not has_function_privilege('authenticated','commito_private.utc_now()','execute'),
    'app role can set or call private clock');
  foreach uid in array array[a,b,zero_user,late_user,later_user,outsider] loop
    insert into auth.users(id,email) values(uid,uid::text || '@example.invalid');
    insert into public.profiles(id) values(uid) on conflict(id) do nothing;
  end loop;
  -- Use a leap-day week and a week spanning December/January. Repeated names
  -- must not merge accounts; an email-shaped display name must omit its domain.
  update public.profiles set username='Same name',name='Same name' where id in(a,b);
  update public.profiles set username='zero@example.test' where id=zero_user;
  foreach start_day in array array[date '2024-02-26',date '2026-12-28'] loop
    league:=gen_random_uuid(); monday:=start_day+7;
    perform pg_temp.recap_clock(start_day::timestamp at time zone 'utc');
    insert into public.leagues(id,name,activity,invite_code,created_by,month_key,is_free,created_at)
      values(league,'Local recap fixture','Walk',league::text,a,to_char(start_day,'YYYY-MM'),true,
        start_day::timestamp at time zone 'utc');
    insert into public.league_members(league_id,user_id,role,payment_status,joined_at)
    values(league,a,'owner','free',start_day::timestamp at time zone 'utc'),
      (league,b,'member','free',start_day::timestamp at time zone 'utc'),
      (league,zero_user,'member','free',(start_day+6)::timestamp at time zone 'utc'),
      (league,late_user,'member','free',monday::timestamp at time zone 'utc'),
      (league,later_user,'member','free',monday::timestamp at time zone 'utc');
    foreach log_day in array array[start_day,start_day+3,start_day+6,start_day+7] loop
      perform pg_temp.recap_clock(log_day::timestamp at time zone 'utc');
      insert into public.daily_logs(league_id,user_id,log_date,completed)
        values(league,a,log_day,log_day<>start_day+3);
    end loop;
    perform pg_temp.recap_clock((start_day+6)::timestamp at time zone 'utc');
    insert into public.daily_logs(league_id,user_id,log_date,completed)
      values(league,b,start_day+6,true),(league,late_user,start_day+6,true),
        (league,outsider,start_day+6,true);

    -- Monday: include the prior seven dates, zero-activity current members,
    -- and a Monday joiner's Sunday exception; exclude later members without logs.
    perform pg_temp.recap_clock(monday::timestamp at time zone 'utc');
    perform set_config('request.jwt.claim.sub',a::text,true);
    set local role authenticated;
    result:=public.get_free_league_weekly_recap(league);
    reset role;
    perform pg_temp.recap_assert(result->>'week_start'=start_day::text and result->>'week_end'=(start_day+6)::text,
      'leap/month/year UTC week bounds incorrect');
    perform pg_temp.recap_assert((result->>'provisional')::boolean
      and result->>'finalizes_at'=to_char((monday+1)::timestamp,'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'Monday correction window missing');
    perform pg_temp.recap_assert((result->>'total_member_days')::integer=4
      and (result->>'group_active_days')::integer=2 and jsonb_array_length(result->'members')=4,
      'wrong totals, false/current-week/outsider logs included or missing roster');
    perform pg_temp.recap_assert((select count(*)=2 from jsonb_array_elements(result->'members') m
      where m->>'display_name'='Same name'),'duplicate names merged');
    perform pg_temp.recap_assert((select (m->>'active_days')::integer=0 and m->>'display_name'='zero'
      from jsonb_array_elements(result->'members') m where m->>'user_id'=zero_user::text),
      'zero member omitted or email domain exposed');
    select array_agg(k order by k) into names from jsonb_object_keys(result) k;
    perform pg_temp.recap_assert(names=array['finalizes_at','generated_at','group_active_days','members',
      'provisional','total_member_days','week_end','week_start'],'unexpected top-level/private fields');
    perform pg_temp.recap_assert(not exists(select 1 from jsonb_array_elements(result->'members') m
      where (select array_agg(k order by k) from jsonb_object_keys(m) k)<>array['active_days','display_name','user_id']),
      'unexpected member/private fields');
    -- Different session timezones produce byte-equivalent UTC dates/timestamps.
    set local timezone='Pacific/Kiritimati';
    perform set_config('request.jwt.claim.sub',b::text,true);
    set local role authenticated;
    same_result:=public.get_free_league_weekly_recap(league);
    reset role;
    perform pg_temp.recap_assert(result=same_result,'timezone or requesting peer changes recap');
    set local timezone='UTC';
    -- A saved Sunday correction is reflected while Monday remains open.
    perform pg_temp.recap_clock((monday::timestamp + interval '23 hours 59 minutes 59 seconds') at time zone 'utc');
    update public.daily_logs set completed=false where league_id=league and user_id=b and log_date=start_day+6;
    result:=public.get_free_league_weekly_recap(league);
    perform pg_temp.recap_assert((result->>'provisional')::boolean and result->>'total_member_days'='3',
      'Monday correction not reflected or cutoff closes early');
    update public.daily_logs set completed=true where league_id=league and user_id=b and log_date=start_day+6;
    perform pg_temp.recap_clock((monday+1)::timestamp at time zone 'utc');
    result:=public.get_free_league_weekly_recap(league);
    perform pg_temp.recap_assert(not (result->>'provisional')::boolean,'Tuesday cutoff off by one');
    perform pg_temp.recap_clock((monday+6)::timestamp at time zone 'utc');
    result:=public.get_free_league_weekly_recap(league);
    perform pg_temp.recap_assert(result->>'week_start'=start_day::text,'Sunday returned incomplete current week');
    perform pg_temp.recap_clock((monday+7)::timestamp at time zone 'utc');
    result:=public.get_free_league_weekly_recap(league);
    perform pg_temp.recap_assert(result->>'week_start'=monday::text and result->>'total_member_days'='1'
      and jsonb_array_length(result->'members')=5,'next Monday failed to roll recap into next week');

    perform set_config('request.jwt.claim.sub',outsider::text,true);
    set local role authenticated;
    failed:=false;
    begin perform public.get_free_league_weekly_recap(league);
    exception when others then if sqlerrm<>'not_league_member' then raise; end if; failed:=true; end;
    perform pg_temp.recap_assert(failed,'outsider including one with a retained log read recap');
    perform set_config('request.jwt.claim.sub','',true);
    failed:=false;
    begin perform public.get_free_league_weekly_recap(league);
    exception when others then if sqlerrm<>'not_authenticated' then raise; end if; failed:=true; end;
    perform pg_temp.recap_assert(failed,'missing identity read recap');
    reset role;
    set local role anon;
    failed:=false;
    begin perform public.get_free_league_weekly_recap(league);
    exception when insufficient_privilege then failed:=true; end;
    perform pg_temp.recap_assert(failed,'anonymous role invoked recap');
    reset role;
  end loop;
  perform set_config('request.jwt.claim.sub',a::text,true);
  insert into public.leagues(id,name,activity,invite_code,created_by,month_key,is_free)
    values(paid,'Local paid denial','Walk',paid::text,a,'2026-12',false),
      (empty_league,'Local new league','Read',empty_league::text,a,'2026-12',true);
  insert into public.league_members(league_id,user_id,role,payment_status,joined_at)
    values(paid,a,'owner','free',commito_private.utc_now()),
      (empty_league,a,'owner','free',commito_private.utc_now());
  set local role authenticated;
  failed:=false;
  begin perform public.get_free_league_weekly_recap(paid);
  exception when others then if sqlerrm<>'free_league_required' then raise; end if; failed:=true; end;
  perform pg_temp.recap_assert(failed,'paid league returned recap');
  result:=public.get_free_league_weekly_recap(empty_league);
  reset role;
  perform pg_temp.recap_assert(result->'members'='[]'::jsonb and result->>'total_member_days'='0'
    and result->>'group_active_days'='0','new league lacks clean zero state');
  perform pg_temp.recap_assert(not exists(select 1 from public.free_league_cycles where league_id in(league,empty_league)),
    'read-only recap unexpectedly wrote monthly snapshot');
  raise notice 'PASS: weekly bounds/leap/year/UTC/cutoff, zero/late/duplicate members, saved true-only totals, privacy and role/member/free access';
end;
$$;
rollback;
