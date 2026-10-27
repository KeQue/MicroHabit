-- Run only in an isolated test database matching the live schema, after applying
-- 20261026160000_restrict_purchase_verification.sql. The legacy purchase RPC is
-- present in live schema but absent from the older repository schema dump.
-- Requires a database owner; synthetic auth/league fixtures always roll back.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/purchase_verification_access.sql
begin;

do $$
declare
  v_user uuid := gen_random_uuid();
  v_league uuid := gen_random_uuid();
begin
  if has_function_privilege('anon', 'public.verify_league_purchase(uuid,text,text,text,text,integer,text,jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.verify_league_purchase(uuid,text,text,text,text,integer,text,jsonb)', 'EXECUTE') then
    raise exception 'App roles can still execute the legacy purchase verification RPC';
  end if;
  if not has_function_privilege('service_role', 'public.verify_league_purchase(uuid,text,text,text,text,integer,text,jsonb)', 'EXECUTE') then
    raise exception 'Trusted backend execute permission was lost';
  end if;

  insert into auth.users (id, email)
  values (v_user, v_user::text || '@example.invalid');
  insert into public.leagues (id, name, activity, invite_code, created_by, month_key, is_free, plan_tier)
  values (v_league, 'Purchase access test', 'Walk', upper(left(replace(gen_random_uuid()::text, '-', ''), 12)), v_user, '2026-10', false, 'B');

  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config('commito_test.purchase_league_id', v_league::text, true);
end;
$$;

set local role authenticated;
do $$
begin
  begin
    perform public.verify_league_purchase(
      current_setting('commito_test.purchase_league_id')::uuid,
      'ios', 'test-product', 'invented-test-transaction'
    );
    raise exception 'Authenticated caller unexpectedly verified an invented purchase';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

set local role anon;
do $$
begin
  begin
    perform public.verify_league_purchase(
      current_setting('commito_test.purchase_league_id')::uuid,
      'ios', 'test-product', 'invented-test-transaction'
    );
    raise exception 'Anonymous role unexpectedly executed purchase verification';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
do $$
begin
  if exists (
    select 1 from public.league_members
    where league_id = current_setting('commito_test.purchase_league_id')::uuid
  ) or exists (
    select 1 from public.league_payments
    where league_id = current_setting('commito_test.purchase_league_id')::uuid
  ) then
    raise exception 'Denied calls changed membership or payment records';
  end if;
  raise notice 'Purchase verification access assertions passed; rolling fixtures back';
end;
$$;

rollback;
