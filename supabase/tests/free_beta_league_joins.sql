-- Run with psql -v ON_ERROR_STOP=1 -f supabase/tests/free_beta_league_joins.sql
-- against an isolated test database after applying repository migrations.
-- Requires a database owner to seed auth fixtures; all fixtures roll back.
begin;

create function pg_temp.expect_join_error(p_code text, p_expected text)
returns void language plpgsql as $$
begin
  begin
    perform public.join_league_by_code(p_code);
  exception when others then
    if sqlerrm = p_expected then
      return;
    end if;
    raise;
  end;
  raise exception 'Expected join error %, but call succeeded', p_expected;
end;
$$;

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_free_one uuid := gen_random_uuid();
  v_free_two uuid := gen_random_uuid();
  v_paid uuid := gen_random_uuid();
  v_code_one text := upper(left(replace(gen_random_uuid()::text, '-', ''), 12));
  v_code_two text := upper(left(replace(gen_random_uuid()::text, '-', ''), 12));
  v_code_paid text := upper(left(replace(gen_random_uuid()::text, '-', ''), 12));
  v_joined_at timestamptz := now() - interval '10 days';
  v_agreed_at timestamptz := now() - interval '9 days';
  v_result uuid;
begin
  insert into auth.users (id, email)
  values (v_owner, v_owner::text || '@example.invalid'),
         (v_member, v_member::text || '@example.invalid');

  insert into public.profiles (id, free_league_used_month, free_used_at)
  values (v_member, '2026-01', v_joined_at)
  on conflict (id) do update
    set free_league_used_month = excluded.free_league_used_month,
        free_used_at = excluded.free_used_at;

  insert into public.leagues (id, name, activity, invite_code, created_by, month_key, is_free, plan_tier)
  values (v_free_one, 'Beta test one', 'Walk', v_code_one, v_owner, '2026-10', true, null),
         (v_free_two, 'Beta test two', 'Read', v_code_two, v_owner, '2026-10', true, null),
         (v_paid, 'Paid lock test', 'Walk', v_code_paid, v_owner, '2026-10', false, 'B');

  perform set_config('request.jwt.claim.sub', '', true);
  perform pg_temp.expect_join_error(v_code_one, 'not_authenticated');
  perform set_config('request.jwt.claim.sub', v_member::text, true);
  perform pg_temp.expect_join_error(null, 'invalid_invite_code');
  perform pg_temp.expect_join_error('   ', 'invalid_invite_code');
  perform pg_temp.expect_join_error('NO-SUCH-' || gen_random_uuid()::text, 'invalid_invite_code');
  perform pg_temp.expect_join_error(v_code_paid, 'payment_required');

  v_result := public.join_league_by_code('  ' || lower(v_code_one) || '  ');
  if v_result <> v_free_one then
    raise exception 'Normalized invite did not return the expected league';
  end if;
  perform public.join_league_by_code(v_code_two);
  if (select count(*) from public.league_members where user_id = v_member and league_id in (v_free_one, v_free_two)) <> 2 then
    raise exception 'Previously used free allowance blocked joining multiple free leagues';
  end if;
  if not exists (
    select 1 from public.league_members
    where user_id = v_member and league_id = v_free_two
      and role = 'member' and payment_status = 'free' and share_cents = 0
  ) then
    raise exception 'New free membership has incorrect defaults';
  end if;

  update public.league_members
  set joined_at = v_joined_at, role = 'admin', agreed_at = v_agreed_at,
      payment_status = 'agreed', share_cents = 123
  where user_id = v_member and league_id = v_free_one;
  perform public.join_league_by_code(v_code_one);
  if not exists (
    select 1 from public.league_members
    where user_id = v_member and league_id = v_free_one
      and joined_at = v_joined_at and role = 'admin' and agreed_at = v_agreed_at
      and payment_status = 'agreed' and share_cents = 123
  ) then
    raise exception 'Repeated join altered the existing membership';
  end if;
  if not exists (
    select 1 from public.profiles where id = v_member
      and free_league_used_month = '2026-01' and free_used_at = v_joined_at
  ) then
    raise exception 'Free beta join altered historical allowance data';
  end if;

  insert into public.league_members (league_id, user_id, role)
  values (v_paid, v_member, 'owner');
  perform pg_temp.expect_join_error(v_code_paid, 'payment_required');

  -- Existing create RPC should also allow multiple free leagues.
  perform public.create_league_and_join('Beta create one', 'Walk', null, '2026-10', true);
  perform public.create_league_and_join('Beta create two', 'Read', null, '2026-10', true);
  if (select count(*) from public.leagues where created_by = v_member and is_free) <> 2 then
    raise exception 'Multiple free league creation failed';
  end if;
  begin
    perform public.create_league_and_join('Blocked paid create', 'Walk', 'B', '2026-10', false);
    raise exception 'Paid create unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'payment_required' then raise; end if;
  end;

  if has_function_privilege('anon', 'public.join_league_by_code(text)', 'EXECUTE') then
    raise exception 'Anonymous role can execute join RPC';
  end if;
  if not has_function_privilege('authenticated', 'public.join_league_by_code(text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.join_league_by_code(text)', 'EXECUTE') then
    raise exception 'Expected roles cannot execute join RPC';
  end if;
  raise notice 'Free beta league join assertions passed; rolling fixtures back';
end;
$$;

rollback;
