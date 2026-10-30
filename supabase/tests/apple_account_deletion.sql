-- ISOLATED DATABASE ONLY. Synthetic accounts and destructive assertions rollback.
begin;
do $$
declare
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
  d uuid:=gen_random_uuid(); l uuid:=gen_random_uuid();
  sa uuid:=gen_random_uuid(); sb uuid:=gen_random_uuid(); fresh uuid:=gen_random_uuid();
  event_time bigint:=floor(extract(epoch from clock_timestamp()))::bigint;
  subject text:='apple-fixture-'||a::text;
  hash text:=repeat('a',64); context jsonb; n integer;
begin
  insert into auth.users(id,email) values(a,a||'@example.invalid'),(b,b||'@example.invalid'),
    (c,c||'@example.invalid'),(d,d||'@example.invalid');
  insert into public.profiles(id) values(a),(b),(c),(d) on conflict do nothing;
  insert into auth.identities(provider_id,user_id,identity_data,provider)
  values(subject,a,jsonb_build_object('sub',subject),'apple'),
    ('google-'||a,a,jsonb_build_object('sub','google-'||a),'google'),
    ('apple-'||c,c,jsonb_build_object('sub','apple-'||c),'apple');
  insert into public.leagues(id,name,activity,invite_code,created_by,month_key,is_free,plan_tier)
  values(l,'Apple deletion fixture','Walk',l::text,a,to_char(now() at time zone 'utc','YYYY-MM'),true,null);
  insert into public.league_members(league_id,user_id,role,payment_status)
  values(l,a,'owner','free'),(l,b,'member','free');
  insert into public.daily_logs(league_id,user_id,log_date,completed)
  values(l,a,(now() at time zone 'utc')::date,true),(l,b,(now() at time zone 'utc')::date,true);
  insert into auth.sessions(id,user_id,created_at) values
    (sa,a,to_timestamp(event_time)-interval '1 hour'),
    (sb,b,to_timestamp(event_time)-interval '1 hour'),
    (fresh,a,to_timestamp(event_time)+interval '1 second');
  insert into auth.refresh_tokens(token,user_id,session_id) values
    ('old-'||sa,a::text,sa),('fresh-'||fresh,a::text,fresh),('peer-'||sb,b::text,sb);

  -- Public app roles cannot read private receipts or call service helpers.
  foreach context in array array['{"role":"anon"}'::jsonb,'{"role":"authenticated"}'::jsonb] loop
    execute 'set local role '||quote_ident(context->>'role');
    begin
      perform public.get_apple_deletion_context(a);
      raise exception 'App role read deletion context';
    exception when insufficient_privilege then null; end;
    begin
      perform public.prepare_apple_deletion(a,subject,hash,'pending');
      raise exception 'App role created trusted receipt';
    exception when insufficient_privilege then null; end;
    begin
      perform public.invalidate_apple_sessions(subject,event_time);
      raise exception 'App role invalidated sessions';
    exception when insufficient_privilege then null; end;
    begin
      perform 1 from commito_private.apple_deletion_receipts;
      raise exception 'App role read private receipts';
    exception when insufficient_privilege then null; end;
    reset role;
  end loop;

  perform set_config('request.jwt.claim.sub',a::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa)::text,true);
  set local role authenticated;
  if not public.is_current_session_valid() then raise exception 'Own session rejected'; end if;
  begin
    perform public.delete_my_account();
    raise exception 'Apple account deleted without disconnection';
  exception when others then if sqlerrm<>'apple_disconnect_required' then raise; end if; end;
  reset role;
  if not exists(select 1 from public.leagues where id=l) then raise exception 'Guard damaged data'; end if;

  set local role service_role;
  context:=public.get_apple_deletion_context(a);
  if context->>'apple_subject'<>subject or not (context->>'uses_apple')::boolean
    or context->'receipt'<>'null'::jsonb then raise exception 'Trusted identity context incorrect'; end if;
  context:=public.get_apple_deletion_context(b);
  if (context->>'uses_apple')::boolean or context->'apple_subject'<>'null'::jsonb then
    raise exception 'Email account acquired Apple identity'; end if;
  begin
    perform public.prepare_apple_deletion(b,subject,hash,'pending');
    raise exception 'Receipt bound to wrong account';
  exception when others then if sqlerrm<>'apple_identity_mismatch' then raise; end if; end;
  begin
    perform public.prepare_apple_deletion(a,subject,hash,'revoked');
    raise exception 'Revoked receipt created without pending';
  exception when others then if sqlerrm<>'apple_pending_receipt_required' then raise; end if; end;
  begin
    perform public.prepare_apple_deletion(a,subject,'not-a-hash','pending');
    raise exception 'Invalid hash accepted';
  exception when others then if sqlerrm<>'apple_receipt_invalid' then raise; end if; end;
  perform public.prepare_apple_deletion(a,subject,hash,'pending');
  reset role;
  set local role authenticated;
  begin
    perform public.delete_my_account();
    raise exception 'Pending receipt permitted deletion';
  exception when others then if sqlerrm<>'apple_disconnect_required' then raise; end if; end;
  reset role;
  set local role service_role;
  begin
    perform public.prepare_apple_deletion(a,subject,repeat('b',64),'revoked');
    raise exception 'Wrong token digest advanced receipt';
  exception when others then if sqlerrm<>'apple_pending_receipt_required' then raise; end if; end;
  perform public.prepare_apple_deletion(a,subject,hash,'revoked');
  perform public.prepare_apple_deletion(a,subject,repeat('b',64),'pending');
  context:=public.get_apple_deletion_context(a);
  if context->'receipt'->>'state'<>'revoked' or context->'receipt'->>'token_hash'<>hash then
    raise exception 'Retry lowered or changed successful receipt'; end if;
  reset role;

  -- A replaced identity never inherits an earlier revocation receipt.
  update auth.identities set identity_data=jsonb_build_object('sub',subject||'-changed')
    where user_id=a and provider='apple';
  set local role service_role;
  context:=public.get_apple_deletion_context(a);
  if context->'receipt'<>'null'::jsonb then raise exception 'Stale identity inherited receipt'; end if;
  reset role;
  set local role authenticated;
  begin
    perform public.delete_my_account();
    raise exception 'Stale identity receipt permitted deletion';
  exception when others then if sqlerrm<>'apple_disconnect_required' then raise; end if; end;
  reset role;
  update auth.identities set identity_data=jsonb_build_object('sub',subject) where user_id=a and provider='apple';

  -- Notification deletes only pre-event sessions/refresh tokens, not application data.
  update commito_private.apple_deletion_receipts set updated_at=to_timestamp(event_time)-interval '1 minute' where user_id=a;
  set local role service_role;
  n:=public.invalidate_apple_sessions(subject,event_time);
  if n<>1 then raise exception 'Wrong invalidated session count'; end if;
  if public.invalidate_apple_sessions(subject,event_time)<>0 then raise exception 'Event retry not idempotent'; end if;
  begin
    perform public.invalidate_apple_sessions(subject,event_time+1000);
    raise exception 'Future event accepted';
  exception when others then if sqlerrm<>'apple_event_invalid' then raise; end if; end;
  reset role;
  if exists(select 1 from auth.sessions where id=sa)
    or exists(select 1 from auth.refresh_tokens where session_id=sa)
    or exists(select 1 from commito_private.apple_deletion_receipts where user_id=a)
    or not exists(select 1 from auth.sessions where id=fresh)
    or not exists(select 1 from auth.refresh_tokens where session_id=fresh)
    or not exists(select 1 from auth.sessions where id=sb)
    or (select count(*) from auth.identities where user_id=a)<>2
    or not exists(select 1 from public.profiles where id=a)
    or not exists(select 1 from public.leagues where id=l)
    or (select count(*) from public.daily_logs where league_id=l)<>2
  then raise exception 'Notification isolation/preservation failed'; end if;

  -- Stale JWT, another user's session, missing/malformed/expired session all fail.
  set local role authenticated;
  if public.is_current_session_valid() then raise exception 'Deleted session accepted'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sb)::text,true);
  if public.is_current_session_valid() then raise exception 'Peer session accepted'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id','malformed')::text,true);
  if public.is_current_session_valid() then raise exception 'Malformed session accepted'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a)::text,true);
  if public.is_current_session_valid() then raise exception 'Missing session accepted'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',fresh)::text,true);
  if not public.is_current_session_valid() then raise exception 'Reauthorized session rejected'; end if;
  reset role;
  update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=fresh;
  set local role authenticated;
  if public.is_current_session_valid() then raise exception 'Expired session accepted'; end if;
  reset role;
  update auth.sessions set not_after=null where id=fresh;

  -- A newer successful receipt survives delayed notification and permits deletion.
  set local role service_role;
  perform public.prepare_apple_deletion(a,subject,hash,'pending');
  perform public.prepare_apple_deletion(a,subject,hash,'revoked');
  perform public.invalidate_apple_sessions(subject,event_time);
  context:=public.get_apple_deletion_context(a);
  if context->'receipt'->>'state'<>'revoked' then raise exception 'Delayed event removed newer receipt'; end if;
  reset role;
  set local role authenticated;
  perform public.delete_my_account();
  reset role;
  if exists(select 1 from auth.users where id=a)
    or exists(select 1 from public.leagues where id=l)
    or exists(select 1 from auth.identities where user_id=a)
    or exists(select 1 from commito_private.apple_deletion_receipts where user_id=a)
    or not exists(select 1 from auth.users where id=b) then raise exception 'Approved deletion cleanup failed'; end if;

  -- Explicit manual disconnect fallback is subject-bound and has no token digest.
  set local role service_role;
  perform public.prepare_apple_deletion(c,'apple-'||c,null,'manual');
  reset role;
  perform set_config('request.jwt.claim.sub',c::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',c)::text,true);
  set local role authenticated;
  perform public.delete_my_account();
  reset role;
  if exists(select 1 from auth.users where id=c) then raise exception 'Manual disconnected account remains'; end if;
  perform set_config('request.jwt.claim.sub',d::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',d)::text,true);
  set local role authenticated;
  perform public.delete_my_account();
  reset role;
  if exists(select 1 from auth.users where id=d) then raise exception 'Email account deletion regressed'; end if;

  if has_function_privilege('anon','public.is_current_session_valid()','execute')
    or has_function_privilege('service_role','public.is_current_session_valid()','execute')
    or has_table_privilege('service_role','commito_private.apple_deletion_receipts','select') then
    raise exception 'Excessive session/receipt privileges'; end if;
  raise notice 'PASS: Apple receipt transitions, identity binding, caller isolation, direct deletion guard, S2S cutoff/idempotence, preserved linked identity/data, session validity, manual/email cleanup';
end;
$$;
rollback;
