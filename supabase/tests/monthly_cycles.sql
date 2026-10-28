-- Isolated schema-only database ONLY, after the monthly-cycle migration.
-- Run as database owner: psql -X -v ON_ERROR_STOP=1 -f monthly_cycles.sql
-- All accounts, clocks, snapshots, and destructive operations roll back.
-- The production clock accepts no caller override. This fixture replaces its
-- body as database owner INSIDE THIS ROLLBACK-ONLY TRANSACTION.
begin;

create function pg_temp.cycle_clock(p_at timestamptz)
returns void language plpgsql as $$
begin
  execute format(
    'create or replace function commito_private.utc_now() returns timestamptz language sql volatile as %L',
    'select ' || quote_literal(p_at::text) || '::timestamptz'
  );
end;
$$;

create function pg_temp.cycle_assert(p_ok boolean, p_message text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'FAIL: %', p_message; end if;
end;
$$;

create function pg_temp.cycle_expect_error(p_sql text, p_message text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    return;
  end;
  raise exception 'FAIL: %', p_message;
end;
$$;

create function pg_temp.cycle_expect_message(p_sql text, p_expected text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm <> p_expected then raise; end if;
    return;
  end;
  raise exception 'FAIL: expected error %',p_expected;
end;
$$;

do $$
#variable_conflict use_variable
declare
  owner_id uuid := gen_random_uuid();
  beta_id uuid := gen_random_uuid();
  twin_a uuid := gen_random_uuid();
  twin_b uuid := gen_random_uuid();
  late_id uuid := gen_random_uuid();
  future_id uuid := gen_random_uuid();
  outsider_id uuid := gen_random_uuid();
  league_id uuid := gen_random_uuid();
  leap_id uuid := gen_random_uuid();
  ordinary_id uuid := gen_random_uuid();
  year_id uuid := gen_random_uuid();
  survivor_id uuid := gen_random_uuid();
  paid_id uuid := gen_random_uuid();
  grace_id uuid := gen_random_uuid();
  corrupt_id uuid := gen_random_uuid();
  history jsonb;
  cycle jsonb;
  result jsonb;
  before_snapshot jsonb;
  month_date date;
  expected_twin uuid;
  uid uuid;
  next_page jsonb;
  original_invite text;
begin
  perform pg_temp.cycle_clock('2023-01-01 12:00:00+00');
  foreach uid in array array[owner_id,beta_id,twin_a,twin_b,late_id,future_id,outsider_id]
  loop
    insert into auth.users(id,email) values(uid, uid::text || '@example.invalid');
    insert into public.profiles(id) values(uid) on conflict(id) do nothing;
  end loop;
  update public.profiles set username=null, name='Alpha' where id=owner_id;
  update public.profiles set username=null, name='Beta' where id=beta_id;
  update public.profiles set username=null, name='Twin' where id in (twin_a,twin_b);
  update public.profiles set username=null, name='Late' where id=late_id;
  update public.profiles set username=null, name='Future' where id=future_id;

  insert into public.leagues
    (id,name,activity,invite_code,created_by,month_key,is_free,plan_tier,created_at)
  values
    (ordinary_id,'Non-leap fixture','Walk',ordinary_id::text,owner_id,'2023-02',true,null,'2023-02-01 00:00:00+00'),
    (year_id,'Year fixture','Read',year_id::text,owner_id,'2023-12',true,null,'2023-12-01 00:00:00+00'),
    (league_id,'History fixture','Walk',league_id::text,owner_id,'2024-01',true,null,'2024-01-01 00:00:00+00'),
    (leap_id,'Leap fixture','Read',leap_id::text,owner_id,'2024-02',true,null,'2024-02-01 00:00:00+00'),
    (survivor_id,'Peer-owned fixture','Walk',survivor_id::text,beta_id,'2024-01',true,null,'2024-01-01 00:00:00+00'),
    (grace_id,'Correction fixture','Walk',grace_id::text,owner_id,'2024-01',true,null,'2024-01-01 00:00:00+00'),
    (paid_id,'Paid fixture','Walk',paid_id::text,owner_id,'2024-01',false,'B','2024-01-01 00:00:00+00');
  insert into public.league_members(league_id,user_id,role,payment_status,joined_at)
  values
    (ordinary_id,owner_id,'owner','free','2023-02-01 00:00:00+00'),
    (year_id,owner_id,'owner','free','2023-12-01 00:00:00+00'),
    (league_id,owner_id,'owner','free','2024-01-01 00:00:00+00'),
    (league_id,beta_id,'member','free','2024-01-01 00:00:00+00'),
    (league_id,twin_a,'member','free','2024-01-01 00:00:00+00'),
    (league_id,twin_b,'member','free','2024-01-01 00:00:00+00'),
    (league_id,late_id,'member','free','2024-02-01 00:00:00+00'),
    (league_id,future_id,'member','free','2024-02-15 00:00:00+00'),
    (leap_id,owner_id,'owner','free','2024-02-01 00:00:00+00'),
    (survivor_id,beta_id,'owner','free','2024-01-01 00:00:00+00'),
    (survivor_id,owner_id,'member','free','2024-01-01 00:00:00+00'),
    (grace_id,owner_id,'owner','free','2024-01-01 00:00:00+00'),
    (paid_id,owner_id,'owner','paid','2024-01-01 00:00:00+00');

  -- Seed each historical row while its day is current on the server clock.
  perform pg_temp.cycle_clock('2023-02-28 12:00:00+00');
  insert into public.daily_logs(league_id,user_id,log_date,completed)
    values(ordinary_id,owner_id,'2023-02-28',true);
  perform pg_temp.cycle_clock('2023-12-31 12:00:00+00');
  insert into public.daily_logs(league_id,user_id,log_date,completed)
    values(year_id,owner_id,'2023-12-31',true);

  for month_date in select unnest(array['2024-01-01'::date,'2024-01-02'::date,'2024-01-03'::date,'2024-01-04'::date])
  loop
    perform pg_temp.cycle_clock((month_date::text || ' 12:00:00+00')::timestamptz);
    insert into public.daily_logs(league_id,user_id,log_date,completed)
      values(league_id,owner_id,month_date,month_date <> '2024-01-02'::date);
    if month_date <= '2024-01-03'::date then
      insert into public.daily_logs(league_id,user_id,log_date,completed)
        values(league_id,beta_id,month_date,true);
    end if;
    if month_date='2024-01-01'::date then
      insert into public.daily_logs(league_id,user_id,log_date,completed)
        values(league_id,twin_a,month_date,true),(league_id,twin_b,month_date,true),
              (survivor_id,beta_id,month_date,true),(survivor_id,owner_id,month_date,true);
    end if;
  end loop;

  -- An unauthenticated caller and unrelated user cannot obtain histories or
  -- force finalization, even by guessing the league UUID.
  perform pg_temp.cycle_clock('2024-02-01 12:00:00+00');
  perform pg_temp.cycle_assert(not has_function_privilege('service_role','public.get_free_league_history(uuid,date,integer)','EXECUTE'),
    'service role unexpectedly granted history RPC');
  perform pg_temp.cycle_assert(not exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='commito_private' and (
      has_function_privilege('anon',p.oid,'EXECUTE')
      or has_function_privilege('authenticated',p.oid,'EXECUTE')
      or has_function_privilege('service_role',p.oid,'EXECUTE'))),
    'private monthly helper callable by app/service role');
  perform set_config('request.jwt.claim.sub','',true);
  set local role anon;
  perform pg_temp.cycle_expect_error(
    format('select public.get_free_league_history(%L::uuid)',league_id),
    'anonymous history access succeeded');
  reset role;
  perform set_config('request.jwt.claim.sub',outsider_id::text,true);
  set local role authenticated;
  perform pg_temp.cycle_expect_error(
    format('select public.get_free_league_history(%L::uuid)',league_id),
    'outsider history access succeeded');
  perform pg_temp.cycle_assert(not exists(select 1 from public.free_league_cycles where free_league_cycles.league_id=league_id),
    'outsider can read cycle table');
  perform pg_temp.cycle_assert(not exists(select 1 from public.free_league_cycle_results where free_league_cycle_results.league_id=league_id),
    'outsider can read result table');
  reset role;

  -- Seed the documented day-one/yesterday exception as DATABASE OWNER.
  -- Existing RLS uses real now(), not the fixture clock: this intentionally
  -- exercises the new guard/roster logic, not fake-date authenticated RLS.
  -- Run checkin_authorization.sql separately for real-clock role enforcement.
  insert into public.daily_logs(league_id,user_id,log_date,completed)
    values(league_id,late_id,'2024-01-31',true);
  perform pg_temp.cycle_expect_error(
    format('insert into public.daily_logs(league_id,user_id,log_date,completed) values(%L,%L,%L,true)',league_id,late_id,'2024-01-30'),
    'new guard allowed an ineligible earlier date');

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  set local role authenticated;
  history := public.get_free_league_history(league_id,null,12)::jsonb;
  perform pg_temp.cycle_assert(jsonb_array_length(history)=1,'new league history contains phantom earlier months');
  cycle := history->0;
  perform pg_temp.cycle_assert(cycle->>'month_start'='2024-01-01','history returned wrong month');
  perform pg_temp.cycle_assert(cycle->>'status'='provisional','day-one results finalized before yesterday grace');
  perform pg_temp.cycle_assert((cycle->>'finalizes_at')::timestamptz='2024-02-02 00:00:00+00','wrong January cutoff');
  perform pg_temp.cycle_assert(jsonb_array_length(cycle->'results')=5,'future joiner received a phantom January result, or eligible late joiner was lost');
  select value into result from jsonb_array_elements(cycle->'results') where value->>'user_id'=owner_id::text;
  perform pg_temp.cycle_assert((result->>'days_completed')::int=3,'false completion row counted as active');
  perform pg_temp.cycle_assert((result->>'longest_streak')::int=2,'interrupted days incorrectly form one streak');
  perform pg_temp.cycle_assert((result->>'position')::int=1,'streak or UUID replaced documented name tiebreak');
  select value into result from jsonb_array_elements(cycle->'results') where value->>'user_id'=beta_id::text;
  perform pg_temp.cycle_assert((result->>'days_completed')::int=3 and (result->>'longest_streak')::int=3 and (result->>'position')::int=2,
    'equal-score ranking or consecutive streak is wrong');
  expected_twin := least(twin_a,twin_b);
  select value into result from jsonb_array_elements(cycle->'results') where value->>'user_id'=expected_twin::text;
  -- Late and both Twins have one day; Late sorts first, then UUID orders Twins.
  perform pg_temp.cycle_assert((result->>'position')::int=4,'identical-name tie does not use stable UUID order');

  -- No app role can fabricate, delete, or rewrite server-owned cycle results.
  perform pg_temp.cycle_expect_error(
    format('insert into public.free_league_cycles(league_id,month_start,finalizes_at) values(%L,%L,%L)',league_id,'2023-12-01','2024-01-02 00:00:00+00'),
    'client created a fake historical cycle');
  perform pg_temp.cycle_expect_error(
    format('update public.free_league_cycles set finalized_at=now() where league_id=%L',league_id),
    'client updated cycle status');
  perform pg_temp.cycle_expect_error(
    format('delete from public.free_league_cycles where league_id=%L',league_id),
    'client deleted a cycle');
  perform pg_temp.cycle_expect_error(
    format('insert into public.free_league_cycle_results(league_id,month_start,user_id,display_name,days_completed,longest_streak,position) values(%L,%L,%L,%L,99,99,1)',league_id,'2024-01-01',owner_id,'Fabricated'),
    'client inserted fake results');
  perform pg_temp.cycle_expect_error(
    format('update public.free_league_cycle_results set days_completed=99 where league_id=%L',league_id),
    'client updated results');
  perform pg_temp.cycle_expect_error(
    format('delete from public.free_league_cycle_results where league_id=%L',league_id),
    'client deleted results');
  perform pg_temp.cycle_expect_error(
    format('select public.get_free_league_history(%L::uuid,null,0)',league_id),
    'unbounded/invalid zero history limit accepted');
  perform pg_temp.cycle_expect_error(
    format('select public.get_free_league_history(%L::uuid,null,1000000)',league_id),
    'unbounded huge history request accepted');
  perform pg_temp.cycle_expect_error(
    format('select public.get_free_league_history(%L::uuid,%L::date,1)',league_id,'2024-01-15'),
    'non-month-start history boundary accepted');
  perform pg_temp.cycle_expect_error(
    format('select public.get_free_league_history(%L::uuid,%L::date,1)',league_id,'2025-01-01'),
    'future history boundary accepted');
  perform pg_temp.cycle_expect_error(
    format('select public.get_free_league_history(%L::uuid)',paid_id),
    'free history API exposes paid league settlement');
  history := public.get_free_league_history(grace_id,null,1)::jsonb;
  perform pg_temp.cycle_assert(history->0->>'status'='provisional'
    and (history->0->'results'->0->>'days_completed')::int=0,
    'empty grace-period month is not provisional');
  reset role;
  insert into public.daily_logs(league_id,user_id,log_date,completed)
    values(grace_id,owner_id,'2024-01-31',true);
  set local role authenticated;
  history := public.get_free_league_history(grace_id,null,1)::jsonb;
  perform pg_temp.cycle_assert(history->0->>'status'='provisional'
    and (history->0->'results'->0->>'days_completed')::int=1,
    'history request prematurely froze the first-day correction');
  reset role;

  -- Exact cutoff, non-UTC database session, immutable snapshot and idempotency.
  perform pg_temp.cycle_clock('2024-02-02 00:00:00+00');
  set local timezone='America/Los_Angeles';
  set local role authenticated;
  history := public.get_free_league_history(league_id,null,12)::jsonb;
  perform pg_temp.cycle_assert(history->0->>'status'='final','UTC cutoff depends on database timezone');
  before_snapshot := history;
  perform pg_temp.cycle_assert(public.get_free_league_history(league_id,null,12)::jsonb=before_snapshot,
    'repeated finalization changed results');
  reset role;
  set local timezone='UTC';
  set local role authenticated;
  history := public.get_free_league_history(grace_id,null,1)::jsonb;
  perform pg_temp.cycle_assert(history->0->>'status'='final'
    and (history->0->'results'->0->>'days_completed')::int=1,
    'final snapshot did not preserve the grace-day correction');
  reset role;
  insert into public.daily_logs(league_id,user_id,log_date,completed)
    values(league_id,owner_id,'2024-02-02',true);
  set local role authenticated;
  perform pg_temp.cycle_assert(public.get_free_league_history(league_id,null,12)::jsonb=before_snapshot,
    'new-cycle check-in changed a closed cycle');
  reset role;
  perform pg_temp.cycle_expect_error(
    format('update public.daily_logs set completed=false where league_id=%L and user_id=%L and log_date=%L',league_id,owner_id,'2024-01-01'),
    'closed log can be modified through a privileged ordinary update');
  perform pg_temp.cycle_expect_error(
    format('insert into public.daily_logs(league_id,user_id,log_date,completed) values(%L,%L,%L,true)',league_id,owner_id,'2024-01-30'),
    'closed log can be added through a privileged ordinary insert');
  perform pg_temp.cycle_expect_error(
    format('delete from public.daily_logs where league_id=%L and user_id=%L and log_date=%L',league_id,owner_id,'2024-01-01'),
    'closed log can be deleted through a privileged ordinary delete');
  perform pg_temp.cycle_expect_error(
    format('update public.daily_logs set log_date=%L where league_id=%L and user_id=%L and log_date=%L','2024-02-02',league_id,owner_id,'2024-01-01'),
    'moving closed log to current date bypassed OLD-row protection');
  update public.profiles set name='Zulu' where id=owner_id;
  set local role authenticated;
  perform pg_temp.cycle_assert(public.get_free_league_history(league_id,null,12)::jsonb=before_snapshot,
    'profile rename rewrote finalized names/rankings');
  reset role;

  -- A rename BEFORE anyone requests a finalized month must first snapshot the
  -- closed period under the old display name, rather than rewrite its ranking.
  update public.profiles set name='Alpha' where id=owner_id;
  perform pg_temp.cycle_clock('2024-02-28 12:00:00+00');
  insert into public.daily_logs(league_id,user_id,log_date,completed)
    values(leap_id,owner_id,'2024-02-28',true);
  perform pg_temp.cycle_clock('2024-02-29 12:00:00+00');
  insert into public.daily_logs(league_id,user_id,log_date,completed)
    values(leap_id,owner_id,'2024-02-29',true);
  perform pg_temp.cycle_clock('2024-03-01 23:59:59+00');
  set local role authenticated;
  history := public.get_free_league_history(leap_id,null,1)::jsonb;
  perform pg_temp.cycle_assert(history->0->>'status'='provisional','leap February grace closes too soon');
  perform pg_temp.cycle_assert((history->0->>'finalizes_at')::timestamptz='2024-03-02 00:00:00+00','leap February cutoff wrong');
  reset role;
  perform pg_temp.cycle_clock('2024-03-02 00:00:00+00');
  update public.profiles set name='Zulu' where id=owner_id;
  set local role authenticated;
  history := public.get_free_league_history(leap_id,null,1)::jsonb;
  perform pg_temp.cycle_assert(history->0->>'status'='final','leap February did not finalize');
  result := history->0->'results'->0;
  perform pg_temp.cycle_assert((result->>'days_completed')::int=2 and (result->>'longest_streak')::int=2,
    'leap day missing or streak interrupted at leap day');
  perform pg_temp.cycle_assert(result->>'display_name'='Alpha','unrequested closed month renamed before lazy finalization');

  history := public.get_free_league_history(ordinary_id,'2023-03-01',1)::jsonb;
  perform pg_temp.cycle_assert(history->0->>'month_start'='2023-02-01','non-leap February missing');
  perform pg_temp.cycle_assert((history->0->>'finalizes_at')::timestamptz='2023-03-02 00:00:00+00','non-leap February cutoff wrong');
  perform pg_temp.cycle_assert((history->0->'results'->0->>'days_completed')::int=1,'non-leap last day missing');
  history := public.get_free_league_history(year_id,'2024-01-01',1)::jsonb;
  perform pg_temp.cycle_assert(history->0->>'month_start'='2023-12-01','December/year transition missing');
  perform pg_temp.cycle_assert((history->0->>'finalizes_at')::timestamptz='2024-01-02 00:00:00+00','year transition cutoff wrong');
  history := public.get_free_league_history(year_id,'2024-03-01',1)::jsonb;
  perform pg_temp.cycle_assert(jsonb_array_length(history)=1 and history->0->>'month_start'='2024-02-01',
    'first history page did not exclude its before boundary');
  next_page := public.get_free_league_history(year_id,(history->0->>'month_start')::date,1)::jsonb;
  perform pg_temp.cycle_assert(jsonb_array_length(next_page)=1 and next_page->0->>'month_start'='2024-01-01',
    'history pagination duplicated or skipped a cycle');
  history := public.get_free_league_history(year_id,(next_page->0->>'month_start')::date,1)::jsonb;
  perform pg_temp.cycle_assert(history->0->>'month_start'='2023-12-01','history pagination lost oldest cycle');
  perform pg_temp.cycle_assert(public.get_free_league_history(year_id,'2023-12-01',1)::jsonb='[]'::jsonb,
    'pagination generated a cycle before league creation');
  reset role;

  select invite_code into original_invite from public.leagues where id=league_id;
  insert into public.daily_logs(league_id,user_id,log_date,completed)
    values(league_id,owner_id,'2024-03-02',true);
  perform pg_temp.cycle_assert((select count(*) from public.league_members where league_members.league_id=league_id)=6,
    'monthly continuation changed membership');
  perform pg_temp.cycle_assert((select invite_code from public.leagues where id=league_id)=original_invite
    and (select status from public.leagues where id=league_id)='active',
    'monthly continuation replaced invite code or completed entire league');
  set local role authenticated;
  history := public.get_free_league_history(league_id,'2024-02-01',12)::jsonb;
  perform pg_temp.cycle_assert(history=before_snapshot,'later monthly participation rewrote January results');
  reset role;

  -- Exceptional imported/corrupt spans must fail atomically instead of an
  -- unbounded rename backfill or silently dropping old cycle requirements.
  insert into public.leagues
    (id,name,activity,invite_code,created_by,month_key,is_free,plan_tier,created_at)
  values(corrupt_id,'Imported span fixture','Walk',corrupt_id::text,owner_id,'1800-01',true,null,'1800-01-01 00:00:00+00');
  insert into public.league_members(league_id,user_id,role,payment_status,joined_at)
    values(corrupt_id,owner_id,'owner','free','1800-01-01 00:00:00+00');
  perform pg_temp.cycle_expect_message(
    format('update public.profiles set name=%L where id=%L','Backfill rejection',owner_id),
    'history_backfill_required');
  perform pg_temp.cycle_assert((select name from public.profiles where id=owner_id)='Zulu',
    'failed backfill partially changed profile');
  delete from public.leagues where id=corrupt_id;

  -- Old completed-month rows can disappear ONLY through the already documented
  -- account/league deletion cascade. Another owner's league must survive.
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  set local role authenticated;
  perform public.delete_my_account();
  reset role;
  perform pg_temp.cycle_assert(not exists(select 1 from auth.users where id=owner_id),'owner account deletion failed');
  perform pg_temp.cycle_assert(not exists(select 1 from public.leagues where id=league_id),'deleted owner league remains');
  perform pg_temp.cycle_assert(not exists(select 1 from public.free_league_cycles where free_league_cycles.league_id=league_id),'cycle deletion cascade blocked');
  perform pg_temp.cycle_assert(not exists(select 1 from public.free_league_cycle_results where free_league_cycle_results.league_id=league_id),'result deletion cascade blocked');
  perform pg_temp.cycle_assert(exists(select 1 from public.leagues where id=survivor_id),'unrelated owner league deleted');
  perform pg_temp.cycle_assert(exists(select 1 from public.daily_logs where daily_logs.league_id=survivor_id and user_id=beta_id and completed),
    'peer activity deleted from surviving league');
  perform pg_temp.cycle_assert(not exists(select 1 from public.daily_logs where user_id=owner_id),'deleted member activity remains');
  raise notice 'PASS: month history, leap/non-leap/year boundaries, false rows, streaks, deterministic ties, late membership, access controls, lazy snapshots, UTC finality, rename protection and deletion cascades';
end;
$$;

rollback;
