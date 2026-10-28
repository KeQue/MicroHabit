-- Isolated database only: schema-only live copy plus the approved beta fixes.
-- Run as the test database owner with psql -X -v ON_ERROR_STOP=1 -f this_file.
-- Synthetic accounts only; all changes roll back, including account deletion.
begin;

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  shared_one uuid := gen_random_uuid();
  shared_two uuid := gen_random_uuid();
  b_owned uuid := gen_random_uuid();
  c_owned uuid := gen_random_uuid();
  today date := (now() at time zone 'utc')::date;
begin
  insert into auth.users (id,email)
  values (a,a::text || '@example.invalid'),
         (b,b::text || '@example.invalid'),
         (c,c::text || '@example.invalid');
  insert into public.profiles (id) values (a),(b),(c) on conflict (id) do nothing;
  insert into public.leagues
    (id,name,activity,invite_code,created_by,month_key,is_free,plan_tier)
  values
    (shared_one,'Deletion fixture one','Walk',shared_one::text,a,to_char(today,'YYYY-MM'),true,null),
    (shared_two,'Deletion fixture two','Read',shared_two::text,a,to_char(today,'YYYY-MM'),true,null),
    (b_owned,'Surviving peer league','Walk',b_owned::text,b,to_char(today,'YYYY-MM'),true,null),
    (c_owned,'Unrelated league','Walk',c_owned::text,c,to_char(today,'YYYY-MM'),true,null);
  insert into public.league_members (league_id,user_id,role,payment_status)
  values (shared_one,a,'owner','free'),(shared_one,b,'member','free'),
         (shared_two,a,'owner','free'),(shared_two,b,'member','free'),
         (b_owned,b,'owner','free'),(b_owned,a,'member','free'),
         (c_owned,c,'owner','free'),(c_owned,b,'member','free');
  insert into public.daily_logs (league_id,user_id,log_date,completed)
  values (shared_one,a,today,true),(shared_one,b,today,true),
         (shared_two,b,today,true),(b_owned,a,today,true),
         (b_owned,b,today,true),(c_owned,c,today,true),(c_owned,b,today,true);
  -- An invite created by A in a league owned by B must not block deletion.
  insert into public.league_invites (code,league_id,created_by)
  values (gen_random_uuid()::text,b_owned,a);

  perform set_config('request.jwt.claim.sub','',true);
  set local role anon;
  begin
    perform public.delete_my_account();
    raise exception 'Unauthenticated deletion unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'not_authenticated' then raise; end if;
  end;
  reset role;
  if not exists(select 1 from auth.users where id=a) then
    raise exception 'Rejected deletion changed account data';
  end if;

  perform set_config('request.jwt.claim.sub',a::text,true);
  set local role authenticated;
  perform public.delete_my_account();
  reset role;
  if exists(select 1 from auth.users where id=a)
     or exists(select 1 from public.profiles where id=a)
     or exists(select 1 from public.league_members where user_id=a)
     or exists(select 1 from public.daily_logs where user_id=a)
     or exists(select 1 from public.league_invites where created_by=a) then
    raise exception 'Deleted account data remains';
  end if;
  if exists(select 1 from public.leagues where id in (shared_one,shared_two))
     or exists(select 1 from public.league_members where league_id in (shared_one,shared_two))
     or exists(select 1 from public.daily_logs where league_id in (shared_one,shared_two)) then
    raise exception 'Owner deletion left shared leagues or peer history';
  end if;
  if (select count(*) from public.leagues where id in (b_owned,c_owned)) <> 2
     or not exists(select 1 from auth.users where id=b)
     or not exists(select 1 from public.daily_logs where league_id=b_owned and user_id=b and completed)
     or not exists(select 1 from public.daily_logs where league_id=c_owned and user_id=c and completed) then
    raise exception 'Owner deletion damaged surviving accounts or leagues';
  end if;

  perform set_config('request.jwt.claim.sub',b::text,true);
  set local role authenticated;
  if exists(select 1 from public.leagues where id in (shared_one,shared_two))
     or exists(select 1 from public.daily_logs where league_id in (shared_one,shared_two)) then
    raise exception 'Peer can still read deleted league data';
  end if;
  if not exists(select 1 from public.leagues where id=b_owned) then
    raise exception 'Peer lost access to their own surviving league';
  end if;
  perform public.delete_my_account();
  reset role;
  if exists(select 1 from auth.users where id=b)
     or exists(select 1 from public.leagues where id=b_owned)
     or exists(select 1 from public.daily_logs where user_id=b) then
    raise exception 'Second account deletion left data';
  end if;
  if not exists(select 1 from public.leagues where id=c_owned)
     or not exists(select 1 from public.daily_logs where league_id=c_owned and user_id=c and completed)
     or not exists(select 1 from public.league_members where league_id=c_owned and user_id=c and role='owner') then
    raise exception 'Deleting a member damaged another owner league';
  end if;
  raise notice 'PASS: account deletion, shared-history cascade, peer visibility, unrelated data preservation, anonymous rejection';
end;
$$;

rollback;
