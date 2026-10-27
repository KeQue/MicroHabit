-- Run against an isolated database with repository migrations applied:
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/shared_profile_privacy.sql
-- Requires a database owner to seed synthetic fixtures and switch API roles.
-- No live accounts or external services are used. Everything rolls back.
begin;

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_peer uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_league uuid := gen_random_uuid();
  v_other_league uuid := gen_random_uuid();
  v_count integer;
  v_profile jsonb;
begin
  insert into auth.users (id, email)
  values (v_owner, v_owner::text || '@example.invalid'),
         (v_peer, v_peer::text || '@example.invalid'),
         (v_outsider, v_outsider::text || '@example.invalid');

  -- The existing auth trigger seeds profiles; upsert keeps this fixture usable
  -- with a schema whose auth trigger has not been installed.
  insert into public.profiles (id, email, username, name)
  values (v_owner, v_owner::text || '@example.invalid', null, 'Owner'),
         (v_peer, v_peer::text || '@example.invalid', null, 'Peer'),
         (v_outsider, v_outsider::text || '@example.invalid', null, 'Outsider')
  on conflict (id) do update set email = excluded.email, name = excluded.name;

  insert into public.leagues (id, name, activity, invite_code, created_by, month_key, is_free, plan_tier)
  values (v_league, 'Privacy fixture', 'Walk', upper(left(replace(v_league::text, '-', ''), 12)), v_owner, '2026-10', true, null),
         (v_other_league, 'Other privacy fixture', 'Read', upper(left(replace(v_other_league::text, '-', ''), 12)), v_outsider, '2026-10', true, null);
  insert into public.league_members (league_id, user_id, role)
  values (v_league, v_owner, 'owner'), (v_league, v_peer, 'member'),
         (v_other_league, v_outsider, 'owner');

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  set local role authenticated;

  select count(*) into v_count from public.profiles
  where id = v_owner and email = v_owner::text || '@example.invalid';
  if v_count <> 1 then raise exception 'Own private profile is not readable'; end if;

  -- Exercise the real own-profile upsert used during sign-in.
  insert into public.profiles (id, email)
  values (v_owner, v_owner::text || '@example.invalid')
  on conflict (id) do update set email = excluded.email;
  update public.profiles set name = 'Updated owner' where id = v_owner;
  if not found then raise exception 'Own display name cannot be updated'; end if;

  select count(*) into v_count from public.profiles where id = v_peer;
  if v_count <> 0 then raise exception 'Peer can directly read a private profile'; end if;
  update public.profiles set name = 'Unauthorized' where id = v_peer;
  if found then raise exception 'Peer can update another profile'; end if;

  select count(*) into v_count from public.get_league_member_profiles(v_league);
  if v_count <> 2 then raise exception 'League RPC omitted eligible members'; end if;
  select to_jsonb(p) into v_profile from public.get_league_member_profiles(v_league) p
  where p.id = v_peer;
  if v_profile is null or not (v_profile ?& array['id', 'username', 'name'])
     or (select count(*) from jsonb_object_keys(v_profile)) <> 3 then
    raise exception 'League RPC does not return exactly the safe display fields';
  end if;

  begin
    perform public.get_league_member_profiles(v_other_league);
    raise exception 'Caller accessed an unrelated league profile';
  exception when others then
    if sqlerrm <> 'not_league_member' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', v_peer::text, true);
  select count(*) into v_count from public.get_league_member_profiles(v_league);
  if v_count <> 2 then raise exception 'Ordinary member cannot use safe profiles RPC'; end if;
  select count(*) into v_count from public.profiles where id = v_owner;
  if v_count <> 0 then raise exception 'Ordinary member can directly read owner profile'; end if;

  perform set_config('request.jwt.claim.sub', v_outsider::text, true);
  begin
    perform public.get_league_member_profiles(v_league);
    raise exception 'Outsider accessed league profiles';
  exception when others then
    if sqlerrm <> 'not_league_member' then raise; end if;
  end;

  -- Even an authenticated DB role must supply an authenticated user identity.
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.get_league_member_profiles(v_league);
    raise exception 'Missing identity accessed league profiles';
  exception when others then
    if sqlerrm <> 'not_authenticated' then raise; end if;
  end;

  set local role anon;
  begin
    perform public.get_league_member_profiles(v_league);
    raise exception 'Anonymous role can execute safe profiles RPC';
  exception when insufficient_privilege then
    null;
  end;
  select count(*) into v_count from public.profiles;
  if v_count <> 0 then raise exception 'Anonymous role can read private profiles'; end if;

  reset role;
  raise notice 'Shared-profile privacy assertions passed; rolling fixtures back';
end;
$$;

rollback;
