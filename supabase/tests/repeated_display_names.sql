-- Isolated synthetic database ONLY. Every fixture and clock override rolls back.
-- Before the migration this reproduces profiles_username_unique; after it,
-- duplicates must work without changing UUID ownership, privacy or history.
begin;
create function pg_temp.name_assert(p_ok boolean,p_message text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'FAIL: %',p_message; end if;
end;
$$;
create function pg_temp.name_clock(p_at timestamptz)
returns void language plpgsql as $$
begin
  execute format('create or replace function commito_private.utc_now() returns timestamptz language sql volatile as %L',
    'select ' || quote_literal(p_at::text) || '::timestamptz');
end;
$$;
do $$
declare
  a uuid:=gen_random_uuid();
  b uuid:=gen_random_uuid();
  c uuid:=gen_random_uuid();
  league uuid:=gen_random_uuid();
  other_league uuid:=gen_random_uuid();
  uid uuid;
  shared_name text:='Sadu_' || left(replace(a::text,'-',''),8);
  old_a text:='Original_' || left(replace(a::text,'-',''),8);
  old_b text:='Original_' || left(replace(b::text,'-',''),8);
  n integer;
  denied boolean;
  ordered uuid[];
  today date:=(clock_timestamp() at time zone 'utc')::date;
  current_month date:=date_trunc('month',clock_timestamp() at time zone 'utc')::date;
begin
  perform pg_temp.name_clock('2026-09-30T12:00:00Z');
  foreach uid in array array[a,b,c] loop
    insert into auth.users(id,email) values(uid,uid::text || '@example.invalid');
    insert into public.profiles(id) values(uid) on conflict(id) do nothing;
  end loop;
  update public.profiles set username=old_a,name=old_a where id=a;
  update public.profiles set username=old_b,name=old_b where id=b;
  insert into public.leagues(id,name,activity,invite_code,created_by,month_key,is_free,created_at)
  values(league,'Local same-name fixture','Walk',league::text,a,'2026-09',true,'2026-09-01T00:00:00Z'),
    (other_league,'Local unrelated fixture','Read',other_league::text,c,'2026-09',true,'2026-09-01T00:00:00Z');
  insert into public.league_members(league_id,user_id,role,payment_status,joined_at)
  values(league,a,'owner','free','2026-09-01T00:00:00Z'),
    (league,b,'member','free','2026-09-01T00:00:00Z'),
    (other_league,c,'owner','free','2026-09-01T00:00:00Z');
  insert into public.daily_logs(league_id,user_id,log_date,completed)
  values(league,a,'2026-09-30',true),(league,b,'2026-09-30',false);

  perform pg_temp.name_clock('2026-10-02T12:00:00Z');
  perform set_config('request.jwt.claim.sub',a::text,true);
  set local role authenticated;
  update public.profiles set username=shared_name,name=shared_name where id=a;
  reset role;
  -- A separate league/account can use a case variant of the same display name.
  perform set_config('request.jwt.claim.sub',c::text,true);
  set local role authenticated;
  update public.profiles set username=upper(shared_name),name=upper(shared_name) where id=c;
  reset role;
  -- Members in the same league can also use the exact same display name.
  perform set_config('request.jwt.claim.sub',b::text,true);
  set local role authenticated;
  update public.profiles set username=shared_name,name=shared_name where id=b;
  reset role;
  perform pg_temp.name_assert((select count(*)=3 from public.profiles where id in(a,b,c)
    and lower(username)=lower(shared_name)),'repeat names were rejected or accounts merged');
  perform pg_temp.name_assert((select display_name=old_a and days_completed=1
    from public.free_league_cycle_results where league_id=league and user_id=a and month_start='2026-09-01'),
    'renaming rewrote final original name or score');
  perform pg_temp.name_assert((select display_name=old_b and days_completed=0
    from public.free_league_cycle_results where league_id=league and user_id=b and month_start='2026-09-01'),
    'renaming rewrote the other member history');

  -- Authenticated check-in policies use the real current UTC date. Restore the
  -- genuine clock before exercising them; do not weaken policies for fixtures.
  execute 'create or replace function commito_private.utc_now() returns timestamptz language sql volatile set search_path = '''' as ''select clock_timestamp();''';

  perform set_config('request.jwt.claim.sub',a::text,true);
  set local role authenticated;
  update public.profiles set username='Unauthorized' where id=b;
  get diagnostics n=row_count;
  perform pg_temp.name_assert(n=0,'same name allowed editing another profile');
  select count(*) into n from public.profiles where id=b;
  perform pg_temp.name_assert(n=0,'same name exposed another private profile');
  select count(*) into n from public.get_league_member_profiles(league) p
    where p.id in(a,b) and p.username=shared_name;
  perform pg_temp.name_assert(n=2,'member RPC merged or omitted same-name members');
  denied:=false;
  begin
    perform public.get_league_member_profiles(other_league);
  exception when others then
    if sqlerrm<>'not_league_member' then raise; end if;
    denied:=true;
  end;
  perform pg_temp.name_assert(denied,'shared name granted outsider league access');
  insert into public.daily_logs(league_id,user_id,log_date,completed)
    values(league,a,today,true);
  reset role;
  perform set_config('request.jwt.claim.sub',b::text,true);
  set local role authenticated;
  insert into public.daily_logs(league_id,user_id,log_date,completed)
    values(league,b,today,false);
  update public.daily_logs set completed=false where league_id=league and user_id=a and log_date=today;
  get diagnostics n=row_count;
  perform pg_temp.name_assert(n=0,'same name allowed editing another member progress');
  reset role;
  perform pg_temp.name_assert((select days_completed=1 from commito_private.free_month_scores(league,current_month) where user_id=a),
    'first account score changed');
  perform pg_temp.name_assert((select days_completed=0 from commito_private.free_month_scores(league,current_month) where user_id=b),
    'second account inherited the first score');
  perform set_config('request.jwt.claim.sub',b::text,true);
  set local role authenticated;
  update public.daily_logs set completed=true where league_id=league and user_id=b and log_date=today;
  -- Existing input bounds still apply, and failed updates retain the old name.
  denied:=false;
  begin
    update public.profiles set username='ab' where id=b;
  exception when check_violation then denied:=true;
  end;
  perform pg_temp.name_assert(denied,'minimum username length lost');
  denied:=false;
  begin
    update public.profiles set username=repeat('x',21) where id=b;
  exception when check_violation then denied:=true;
  end;
  perform pg_temp.name_assert(denied,'maximum username length lost');
  reset role;
  select array_agg(s.user_id order by s.position) into ordered from commito_private.free_month_scores(league,current_month) s;
  perform pg_temp.name_assert(ordered=(select array_agg(x order by x) from unnest(array[a,b]) x),
    'identical names/scores no longer use stable UUID ordering');
  perform pg_temp.name_assert((select count(*)=2 from public.league_members where league_id=league),
    'names changed membership identities');
  raise notice 'PASS: repeated names across/in leagues, account/privacy/check-in isolation, stable ranking, final history and input bounds';
end;
$$;
rollback;
