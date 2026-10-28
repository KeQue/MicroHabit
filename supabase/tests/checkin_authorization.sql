-- Isolated schema-only test database only. All synthetic fixtures roll back.
begin;
create temporary table beta_fixture_ids (name text primary key, value text);
insert into beta_fixture_ids values ('22222222-0000-0000-0000-000000000001',gen_random_uuid()::text);
insert into beta_fixture_ids values ('LOCAL-OWNER@EXAMPLE.INVALID',gen_random_uuid()::text || '@example.invalid');
insert into beta_fixture_ids values ('22222222-0000-0000-0000-000000000002',gen_random_uuid()::text);
insert into beta_fixture_ids values ('LOCAL-MEMBER@EXAMPLE.INVALID',gen_random_uuid()::text || '@example.invalid');
insert into beta_fixture_ids values ('22222222-0000-0000-0000-000000000003',gen_random_uuid()::text);
insert into beta_fixture_ids values ('LOCAL-OUTSIDER@EXAMPLE.INVALID',gen_random_uuid()::text || '@example.invalid');
insert into beta_fixture_ids values ('22222222-0000-0000-0000-000000000011',gen_random_uuid()::text);
insert into beta_fixture_ids values ('BETAONE',upper(left(replace(gen_random_uuid()::text,'-',''),12)));
insert into beta_fixture_ids values ('22222222-0000-0000-0000-000000000012',gen_random_uuid()::text);
insert into beta_fixture_ids values ('BETATWO',upper(left(replace(gen_random_uuid()::text,'-',''),12)));
insert into beta_fixture_ids values ('22222222-0000-0000-0000-000000000013',gen_random_uuid()::text);
insert into beta_fixture_ids values ('BETAPAID',upper(left(replace(gen_random_uuid()::text,'-',''),12)));
insert into auth.users (id,email) values
 ((select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000001')::uuid,(select value from beta_fixture_ids where name='LOCAL-OWNER@EXAMPLE.INVALID')),
 ((select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000002')::uuid,(select value from beta_fixture_ids where name='LOCAL-MEMBER@EXAMPLE.INVALID')),
 ((select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000003')::uuid,(select value from beta_fixture_ids where name='LOCAL-OUTSIDER@EXAMPLE.INVALID'));
insert into public.leagues (id,name,activity,invite_code,created_by,month_key,is_free,plan_tier) values
 ((select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000011')::uuid,'Local beta one','Walk',(select value from beta_fixture_ids where name='BETAONE'),(select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000001')::uuid,to_char(now() at time zone 'utc','YYYY-MM'),true,null),
 ((select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000012')::uuid,'Local beta two','Read',(select value from beta_fixture_ids where name='BETATWO'),(select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000001')::uuid,to_char(now() at time zone 'utc','YYYY-MM'),true,null),
 ((select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000013')::uuid,'Local paid lock','Walk',(select value from beta_fixture_ids where name='BETAPAID'),(select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000001')::uuid,to_char(now() at time zone 'utc','YYYY-MM'),false,'B');
insert into public.league_members (league_id,user_id,role,payment_status) values
 ((select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000011')::uuid,(select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000001')::uuid,'owner','free'),
 ((select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000012')::uuid,(select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000001')::uuid,'owner','free'),
 ((select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000013')::uuid,(select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000002')::uuid,'member','unpaid');
insert into public.daily_logs (league_id,user_id,log_date,completed)
values ((select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000011')::uuid,(select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000001')::uuid,(now() at time zone 'utc')::date,true);
update public.profiles set free_league_used_month='2026-01' where id=(select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000002')::uuid;

grant select on beta_fixture_ids to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000002'),true);
select public.join_league_by_code((select value from beta_fixture_ids where name='BETAONE'));
select public.join_league_by_code((select value from beta_fixture_ids where name='BETATWO'));
insert into public.daily_logs (league_id,user_id,log_date,completed)
values ((select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000011')::uuid,auth.uid(),(now() at time zone 'utc')::date,true)
on conflict (league_id,user_id,log_date) do update set completed=excluded.completed;
insert into public.daily_logs (league_id,user_id,log_date,completed)
values ((select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000011')::uuid,auth.uid(),(now() at time zone 'utc')::date-1,true);
do $$
begin
 if (select count(*) from public.league_members where league_id=(select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000011')::uuid)<>2 then raise exception 'Cannot read peer membership'; end if;
 if (select count(*) from public.daily_logs where league_id=(select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000011')::uuid)<>3 then raise exception 'Cannot read shared check-ins'; end if;
 begin
  insert into public.daily_logs (league_id,user_id,log_date,completed) values ((select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000013')::uuid,auth.uid(),(now() at time zone 'utc')::date,true);
  raise exception 'Paid write unexpectedly succeeded';
 exception when insufficient_privilege then null;
 end;
 begin
  insert into public.daily_logs (league_id,user_id,log_date,completed) values ((select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000011')::uuid,auth.uid(),(now() at time zone 'utc')::date-2,true);
  raise exception 'Old-date write unexpectedly succeeded';
 exception when insufficient_privilege then null;
 end;
 update public.daily_logs set completed=false where user_id=(select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000001')::uuid;
 if found then raise exception 'Another member check-in could be changed'; end if;
 begin
  insert into public.league_members (league_id,user_id) values ((select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000012')::uuid,(select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000003')::uuid);
  raise exception 'Direct membership insert unexpectedly succeeded';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.create_league_and_join('Blocked paid','Walk','B','2026-10',false);
  raise exception 'Paid creation unexpectedly succeeded';
 exception when others then if sqlerrm<>'payment_required' then raise; end if;
 end;
 begin
  perform public.accept_invite_and_agree((select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000013')::uuid);
  raise exception 'Paid acceptance unexpectedly succeeded';
 exception when others then if sqlerrm<>'payment_required' then raise; end if;
 end;

 begin
  update public.league_members set role='owner' where user_id=auth.uid();
  if found then raise exception 'Member can escalate role'; end if;
 exception when insufficient_privilege then null;
 end;
 begin
  delete from public.league_members where user_id=auth.uid();
  if found then raise exception 'Direct membership deletion unexpectedly succeeded'; end if;
 exception when insufficient_privilege then null;
 end;
 if exists(select 1 from pg_proc p where p.pronamespace='public'::regnamespace
     and p.proname in ('set_paywall_enabled','verify_league_purchase','settle_league_results','recompute_league_financials','toggle_daily_log')
     and (has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('anon',p.oid,'EXECUTE'))) then
   raise exception 'Privileged legacy RPC is callable by an app role';
 end if;
 raise notice 'Authenticated member write/read/security assertions passed';
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub',(select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000003'),true);
do $$
begin
 if exists (select 1 from public.v_month_results) then raise exception 'Outsider can read ranked results'; end if;
 if exists (select 1 from public.daily_logs) then raise exception 'Outsider can read check-ins'; end if;
 begin
  insert into public.daily_logs (league_id,user_id,log_date,completed) values ((select value from beta_fixture_ids where name='22222222-0000-0000-0000-000000000011')::uuid,auth.uid(),(now() at time zone 'utc')::date,true);
  raise exception 'Outsider write unexpectedly succeeded';
 exception when insufficient_privilege then null;
 end;
 raise notice 'Outsider read/write isolation assertions passed';
end;
$$;
rollback;
