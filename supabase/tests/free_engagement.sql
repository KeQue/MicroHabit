-- ISOLATED SYNTHETIC DATABASE ONLY, after monthly-cycle + Batch 2 migrations.
-- All fixtures, deletions, and private-clock overrides roll back.
-- p_as_of tests period/maturity boundaries, not historical-state restoration.
begin;

create function pg_temp.engagement_assert(p_ok boolean,p_message text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'FAIL: %',p_message; end if;
end;
$$;

create function pg_temp.engagement_clock(p_at timestamptz)
returns void language plpgsql as $$
begin
  execute format('create or replace function commito_private.utc_now() returns timestamptz language sql volatile as %L',
    'select ' || quote_literal(p_at::text) || '::timestamptz');
end;
$$;

do $$
#variable_conflict use_variable
declare
  a uuid:=gen_random_uuid();
  b uuid:=gen_random_uuid();
  c uuid:=gen_random_uuid();
  social uuid:=gen_random_uuid();
  solo uuid:=gen_random_uuid();
  empty_league uuid:=gen_random_uuid();
  excluded uuid:=gen_random_uuid();
  paid uuid:=gen_random_uuid();
  mature uuid:=gen_random_uuid();
  provisional uuid:=gen_random_uuid();
  report jsonb;
  result jsonb;
  after_report jsonb;
  uid uuid;
  row record;
  denied boolean;
  baseline_exclusions uuid[];
  report_exclusions uuid[];
  baseline_snapshots bigint;
begin
  -- Preserve any other synthetic fixtures in the disposable clone; isolate
  -- this report with explicit exclusions rather than deleting unrelated data.
  select coalesce(array_agg(id),'{}'::uuid[]) into baseline_exclusions from public.leagues;
  report_exclusions:=baseline_exclusions || array[excluded]::uuid[];
  select count(*) into baseline_snapshots from public.free_league_cycles;
  foreach uid in array array[a,b,c] loop
    insert into auth.users(id,email) values(uid,uid::text || '@example.invalid');
    insert into public.profiles(id) values(uid) on conflict(id) do nothing;
  end loop;

  insert into public.leagues(id,name,activity,invite_code,created_by,month_key,is_free,plan_tier,created_at)
  values
    (social,'Local social fixture','Walk',social::text,a,'2023-12',true,null,'2023-12-29T12:00:00Z'),
    (solo,'Local solo fixture','Read',solo::text,a,'2024-02',true,null,'2024-02-01T10:00:00Z'),
    (empty_league,'Local empty fixture','Read',empty_league::text,b,'2024-02',true,null,'2024-02-05T10:00:00Z'),
    (excluded,'Local excluded fixture','Read',excluded::text,b,'2024-01',true,null,'2024-01-05T10:00:00Z'),
    (paid,'Local paid fixture','Read',paid::text,c,'2024-01',false,'B','2024-01-05T10:00:00Z'),
    (mature,'Local mature fixture','Walk',mature::text,a,'2024-02',true,null,'2024-02-22T10:00:00Z'),
    (provisional,'Local provisional fixture','Read',provisional::text,c,'2024-02',true,null,'2024-02-23T10:00:00Z');
  insert into public.league_members(league_id,user_id,role,payment_status,joined_at)
  values
    (social,a,'owner','free','2023-12-29T12:00:00Z'),
    (social,b,'member','free','2023-12-30T12:00:00Z'),
    (social,c,'member','free','2024-01-02T12:00:00Z'),
    (solo,a,'owner','free','2024-02-01T10:00:00Z'),
    (solo,c,'member','free','2024-03-02T12:00:00Z'),
    (empty_league,b,'owner','free','2024-02-05T10:00:00Z'),
    (excluded,b,'owner','free','2024-01-05T10:00:00Z'),
    (paid,c,'owner','paid','2024-01-05T10:00:00Z'),
    (mature,a,'owner','free','2024-02-22T10:00:00Z'),
    (mature,b,'member','free','2024-02-22T12:00:00Z'),
    (provisional,c,'owner','free','2024-02-23T10:00:00Z'),
    (provisional,b,'member','free','2024-02-23T12:00:00Z');
  -- A repeated retained membership cannot inflate the join proxy.
  insert into public.league_members(league_id,user_id,role,payment_status,joined_at)
    values(social,b,'member','free','2024-02-25T12:00:00Z')
    on conflict(league_id,user_id) do nothing;

  -- Seed while each date is current on the private fixture clock. As DB owner,
  -- this checks the new monthly guard; real-clock RLS has its separate suite.
  for row in
    select * from (values
      (social,a,'2023-12-31'::date,true),
      (social,a,'2024-01-01'::date,true),
      (social,b,'2024-01-01'::date,true),
      (social,c,'2024-01-02'::date,true),
      (social,c,'2024-01-03'::date,false),
      (social,a,'2024-01-31'::date,true),
      (social,b,'2024-02-01'::date,true),
      (social,a,'2024-02-29'::date,true),
      (social,a,'2024-03-01'::date,true),
      (social,a,'2024-03-02'::date,true),
      (solo,a,'2024-02-10'::date,true),
      (solo,a,'2024-02-11'::date,false),
      (mature,a,'2024-02-22'::date,true),
      (mature,b,'2024-02-28'::date,true),
      (provisional,c,'2024-02-23'::date,true),
      (provisional,b,'2024-02-29'::date,true),
      (excluded,b,'2024-01-05'::date,true),
      (paid,c,'2024-01-05'::date,true)
    ) f(league_id,user_id,log_date,completed) order by log_date
  loop
    perform pg_temp.engagement_clock((row.log_date::text || 'T12:00:00Z')::timestamptz);
    insert into public.daily_logs(league_id,user_id,log_date,completed,created_at,updated_at)
    values(row.league_id,row.user_id,row.log_date,row.completed,
      (row.log_date::text || 'T12:00:00Z')::timestamptz,(row.log_date::text || 'T12:00:00Z')::timestamptz);
  end loop;

  perform pg_temp.engagement_assert((select count(*) from public.free_league_cycles)=baseline_snapshots,
    'fixture unexpectedly contains lazy snapshots');
  report:=commito_private.free_engagement_report('2024-03-01T12:00:00Z',report_exclusions || array[null]::uuid[]);
  perform pg_temp.engagement_assert((report->'totals_12_months'->>'leagues_created')::int=5,'created free/excluded league count');
  perform pg_temp.engagement_assert((report->'totals_12_months'->>'noncreator_membership_joins')::int=4,
    'join proxy includes creator, repeated membership, future join or excluded league');
  perform pg_temp.engagement_assert((report->'totals_12_months'->>'completed_league_member_days')::int=13,
    'completion count includes false rows, future saves or paid/excluded data');
  perform pg_temp.engagement_assert(jsonb_array_length(report->'weekly')=12
    and jsonb_array_length(report->'monthly')=12
    and jsonb_array_length(report->'activation_7_utc_dates')=12,'report windows are not bounded');
  perform pg_temp.engagement_assert(report->'window'->>'first_week'='2023-12-11','Monday UTC week/year boundary');
  select value into result from jsonb_array_elements(report->'weekly') where value->>'week_start'='2024-01-01';
  perform pg_temp.engagement_assert((result->>'active_leagues')::int=1
    and (result->>'socially_active_leagues')::int=1
    and (result->>'active_member_league_pairs')::int=3
    and (result->>'completed_league_member_days')::int=3,'weekly distinct participants or false rows');
  select value into result from jsonb_array_elements(report->'weekly') where value->>'week_start'='2024-02-26';
  perform pg_temp.engagement_assert((result->>'active_leagues')::int=3
    and (result->>'socially_active_leagues')::int=0
    and (result->>'completed_league_member_days')::int=4
    and (result->>'partial_calendar_week')::boolean,'partial-week cohort mixed with completed weeks');

  select value into result from jsonb_array_elements(report->'activation_7_utc_dates') where value->>'created_month'='2024-02-01';
  perform pg_temp.engagement_assert((result->>'created_leagues')::int=4
    and (result->>'fully_observed_leagues')::int=3
    and (result->>'activated_fully_observed_leagues')::int=1
    and (result->>'provisional_leagues')::int=1
    and (result->>'activated_provisional_leagues')::int=1,
    'first-seven-date activation ignores correction maturity or inactive denominator');

  select value into result from jsonb_array_elements(report->'monthly') where value->>'month_start'='2024-01-01';
  perform pg_temp.engagement_assert(result->>'cycle_status'='ended'
    and (result->>'all_ended_league_calendar_cycles')::int=1
    and (result->>'active_ended_league_calendar_cycles')::int=1,
    'finished cycles incorrectly depend on materialized snapshots');
  perform pg_temp.engagement_assert(result->>'followup_status'='correction_window'
    and (result->>'continuation_denominator_active_leagues')::int=1
    and (result->>'continuing_leagues_observed')::int=1
    and (result->>'return_denominator_member_league_pairs')::int=3
    and (result->>'returning_member_league_pairs_observed')::int=2,
    'consecutive monthly return numerator/denominator or grace status');
  select value into result from jsonb_array_elements(report->'monthly') where value->>'month_start'='2024-02-01';
  perform pg_temp.engagement_assert(result->>'cycle_status'='correction_window'
    and (result->>'all_ended_league_calendar_cycles')::int=0
    and (result->>'active_ended_league_calendar_cycles')::int=0
    and (result->>'active_leagues')::int=4
    and (result->>'socially_active_leagues')::int=3
    and (result->>'completed_league_member_days')::int=7,
    'leap February prematurely ended or active days miscounted');
  perform pg_temp.engagement_assert(result->>'followup_status'='partial'
    and (result->>'continuation_denominator_active_leagues')::int=4
    and (result->>'continuing_leagues_observed')::int=1
    and (result->>'return_denominator_member_league_pairs')::int=7
    and (result->>'returning_member_league_pairs_observed')::int=1,
    'current followup reported as a complete retention cohort');
  select value into result from jsonb_array_elements(report->'monthly') where value->>'month_start'='2024-03-01';
  perform pg_temp.engagement_assert(result->>'followup_status'='future'
    and (result->>'returning_member_league_pairs_observed')::int=0,'future followup represented as observed retention');
  select value into result from jsonb_array_elements(report->'monthly') where value->>'month_start'='2023-12-01';
  perform pg_temp.engagement_assert(result->>'followup_status'='complete'
    and (result->>'continuing_leagues_observed')::int=1
    and (result->>'returning_member_league_pairs_observed')::int=1,
    'fully observed year-transition followup is not identified');
  after_report:=commito_private.free_engagement_report('2024-01-08T12:00:00Z',report_exclusions);
  select value into result from jsonb_array_elements(after_report->'weekly') where value->>'week_start'='2024-01-01';
  perform pg_temp.engagement_assert(not (result->>'partial_calendar_week')::boolean
    and (result->>'correction_window_open')::boolean,
    'ended calendar week loses its last-day correction window');

  set local timezone='America/Los_Angeles';
  perform pg_temp.engagement_assert(commito_private.free_engagement_report('2024-03-01T12:00:00Z',report_exclusions)=report,
    'report depends on database session timezone');
  set local timezone='UTC';
  after_report:=commito_private.free_engagement_report('2024-03-02T00:00:00Z',report_exclusions);
  select value into result from jsonb_array_elements(after_report->'monthly') where value->>'month_start'='2024-02-01';
  perform pg_temp.engagement_assert(result->>'cycle_status'='ended'
    and (result->>'all_ended_league_calendar_cycles')::int=5
    and (result->>'active_ended_league_calendar_cycles')::int=4,'day-two cutoff/all-vs-active ended denominator');
  select value into result from jsonb_array_elements(after_report->'activation_7_utc_dates') where value->>'created_month'='2024-02-01';
  perform pg_temp.engagement_assert((result->>'fully_observed_leagues')::int=4
    and (result->>'activated_fully_observed_leagues')::int=2
    and (result->>'provisional_leagues')::int=0,'creation-date+8 exact activation cutoff');
  perform pg_temp.engagement_assert((select count(*) from public.free_league_cycles)=baseline_snapshots,'read-only report materialized snapshots');
  after_report:=commito_private.free_engagement_report('2025-03-01T12:00:00Z',report_exclusions);
  select value into result from jsonb_array_elements(after_report->'monthly') where value->>'month_start'='2025-02-01';
  perform pg_temp.engagement_assert(result->>'cycle_status'='correction_window',
    'non-leap February uses a fixed 30-day cycle');
  after_report:=commito_private.free_engagement_report('2025-03-02T00:00:00Z',report_exclusions);
  select value into result from jsonb_array_elements(after_report->'monthly') where value->>'month_start'='2025-02-01';
  perform pg_temp.engagement_assert(result->>'cycle_status'='ended'
    and (result->>'all_ended_league_calendar_cycles')::int=5
    and (result->>'active_ended_league_calendar_cycles')::int=0,
    'inactive elapsed cycles are confused with active completed cycles');

  foreach uid in array array[a,b,c,social,solo,empty_league,excluded,paid,mature,provisional] loop
    perform pg_temp.engagement_assert(strpos(report::text,uid::text)=0,'report exposes user/league/exclusion identifiers');
  end loop;
  perform pg_temp.engagement_assert(strpos(report::text,'Local social fixture')=0
    and strpos(report::text,'example.invalid')=0,'report exposes names or email');
  perform pg_temp.engagement_assert(not exists(select 1 from pg_policies where schemaname='public'
    and tablename='analytics_events' and policyname='analytics_events_insert_client'),'legacy anonymous event writer policy remains');
  perform set_config('request.jwt.claim.sub',a::text,true);
  for row in select unnest(array['anon','authenticated','service_role']) as role_name loop
    perform pg_temp.engagement_assert(not has_function_privilege(row.role_name,
      'commito_private.free_engagement_report(timestamptz,uuid[])','EXECUTE'),'nonoperator report execution granted');
  end loop;
  perform pg_temp.engagement_assert(not has_table_privilege('anon','public.analytics_events','INSERT')
    and not has_table_privilege('authenticated','public.analytics_events','INSERT')
    and not has_table_privilege('authenticated','public.analytics_events','SELECT'),
    'unused analytics table still exposes app privileges');
  perform pg_temp.engagement_assert(has_table_privilege('service_role','public.analytics_events','INSERT'),
    'existing operator/service analytics permission was removed');
  denied:=false;
  begin
    perform commito_private.free_engagement_report(null);
  exception when others then
    if sqlerrm<>'invalid_report_cutoff' then raise; end if;
    denied:=true;
  end;
  perform pg_temp.engagement_assert(denied,'null report cutoff accepted');
  denied:=false;
  begin
    perform commito_private.free_engagement_report('infinity'::timestamptz);
  exception when others then
    if sqlerrm<>'invalid_report_cutoff' then raise; end if;
    denied:=true;
  end;
  perform pg_temp.engagement_assert(denied,'nonfinite report cutoff accepted');
  denied:=false;
  set local role authenticated;
  begin
    perform commito_private.free_engagement_report();
  exception when insufficient_privilege then denied:=true;
  end;
  reset role;
  perform pg_temp.engagement_assert(denied,'authenticated user executed private report');

  -- Owner deletion changes retained metrics: this is deliberately not a
  -- lifetime immutable event count or a copy of lazily saved result rows.
  perform pg_temp.engagement_clock('2024-03-02T12:00:00Z');
  perform set_config('request.jwt.claim.sub',a::text,true);
  set local role authenticated;
  perform public.delete_my_account();
  reset role;
  after_report:=commito_private.free_engagement_report('2024-03-01T12:00:00Z',report_exclusions);
  perform pg_temp.engagement_assert((after_report->'totals_12_months'->>'leagues_created')::int=2
    and (after_report->'totals_12_months'->>'noncreator_membership_joins')::int=1
    and (after_report->'totals_12_months'->>'completed_league_member_days')::int=2,
    'deletion semantics incorrectly preserve removed personal/owned league activity');
  raise notice 'PASS: private retained-state metrics, exclusions, joins, true days, UTC weeks/year/leap, social activation, correction maturity, monthly cycle/return denominators, privacy, ACLs and deletion';
end;
$$;

rollback;
