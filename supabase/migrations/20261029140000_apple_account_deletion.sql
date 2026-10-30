-- LOCAL REVIEW ONLY. Apply after separate production approval and Edge setup.
-- No provider tokens are stored: this receipt contains only a SHA-256 digest.
create table commito_private.apple_deletion_receipts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  apple_subject text not null check (char_length(apple_subject) between 1 and 255),
  token_hash text check (token_hash ~ '^[0-9a-f]{64}$'),
  state text not null check (state in ('pending','revoked','manual')),
  updated_at timestamptz not null default clock_timestamp(),
  check ((state = 'manual' and token_hash is null) or
         (state in ('pending','revoked') and token_hash is not null))
);
alter table commito_private.apple_deletion_receipts enable row level security;
revoke all on commito_private.apple_deletion_receipts from public, anon, authenticated, service_role;

create function public.get_apple_deletion_context(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_subject text; v_receipt jsonb;
begin
  select i.identity_data->>'sub' into v_subject from auth.identities i
  where i.user_id=p_user_id and i.provider='apple';
  if exists(select 1 from auth.identities i where i.user_id=p_user_id and i.provider='apple')
     and (v_subject is null or v_subject='') then
    raise exception 'apple_identity_invalid';
  end if;
  select jsonb_build_object('state',r.state,'token_hash',r.token_hash) into v_receipt
  from commito_private.apple_deletion_receipts r
  where r.user_id=p_user_id and r.apple_subject=v_subject;
  return jsonb_build_object('uses_apple',v_subject is not null,
    'apple_subject',v_subject,'receipt',v_receipt);
end;
$$;

create function public.prepare_apple_deletion(p_user_id uuid,p_apple_subject text,p_token_hash text,p_state text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_existing commito_private.apple_deletion_receipts%rowtype;
begin
  -- Serialize receipt transitions and the deletion guard for this account.
  perform 1 from auth.users where id=p_user_id for update;
  if not found or p_apple_subject is null or not exists(
    select 1 from auth.identities i where i.user_id=p_user_id and i.provider='apple'
      and i.identity_data->>'sub'=p_apple_subject
  ) then raise exception 'apple_identity_mismatch'; end if;
  if p_state is null or p_state not in ('pending','revoked','manual')
     or (p_state='manual' and p_token_hash is not null)
     or (p_state<>'manual' and (p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'))
  then raise exception 'apple_receipt_invalid'; end if;
  select * into v_existing from commito_private.apple_deletion_receipts where user_id=p_user_id;
  if v_existing.apple_subject=p_apple_subject and v_existing.state in ('revoked','manual') then
    -- A failed/repeated retry must never lower an established disconnection.
    return;
  end if;
  if p_state='revoked' and (v_existing.state is distinct from 'pending'
     or v_existing.apple_subject is distinct from p_apple_subject
     or v_existing.token_hash is distinct from p_token_hash)
  then raise exception 'apple_pending_receipt_required'; end if;
  insert into commito_private.apple_deletion_receipts(user_id,apple_subject,token_hash,state)
  values(p_user_id,p_apple_subject,p_token_hash,p_state)
  on conflict(user_id) do update set apple_subject=excluded.apple_subject,
    token_hash=excluded.token_hash,state=excluded.state,updated_at=clock_timestamp();
end;
$$;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  perform 1 from auth.users where id=v_uid for update;
  if exists(select 1 from auth.identities i where i.user_id=v_uid and i.provider='apple'
    and not exists(select 1 from commito_private.apple_deletion_receipts r
      where r.user_id=v_uid and r.apple_subject=i.identity_data->>'sub'
        and r.state in ('revoked','manual')))
  then raise exception 'apple_disconnect_required'; end if;
  delete from public.league_invites where created_by=v_uid;
  delete from public.leagues where created_by=v_uid;
  delete from auth.users where id=v_uid;
end;
$$;

create function public.invalidate_apple_sessions(p_apple_subject text,p_event_time bigint)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer; v_cutoff timestamptz;
begin
  if p_apple_subject is null or char_length(p_apple_subject) not between 1 and 255
     or p_event_time is null or p_event_time<=0
     or p_event_time>extract(epoch from clock_timestamp())+300
  then raise exception 'apple_event_invalid'; end if;
  v_cutoff := to_timestamp(p_event_time);
  -- Refresh tokens cascade through auth.refresh_tokens_session_id_fkey.
  -- A delayed signed event must not invalidate a newly authorized session.
  delete from auth.sessions s using auth.identities i
  where i.provider='apple' and i.identity_data->>'sub'=p_apple_subject
    and s.user_id=i.user_id and (s.created_at<=v_cutoff or s.created_at is null);
  get diagnostics v_count = row_count;
  delete from commito_private.apple_deletion_receipts r using auth.identities i
  where i.provider='apple' and i.identity_data->>'sub'=p_apple_subject
    and r.user_id=i.user_id and r.updated_at<=v_cutoff;
  return v_count;
end;
$$;

create function public.is_current_session_valid()
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=auth.uid(); v_session uuid;
begin
  if v_uid is null then return false; end if;
  begin v_session:=(auth.jwt()->>'session_id')::uuid;
  exception when invalid_text_representation then return false; end;
  return exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=v_session and s.user_id=v_uid
      and (s.not_after is null or s.not_after>clock_timestamp()));
end;
$$;

revoke all on function public.get_apple_deletion_context(uuid),
  public.prepare_apple_deletion(uuid,text,text,text),
  public.invalidate_apple_sessions(text,bigint),public.is_current_session_valid()
  from public,anon,authenticated,service_role;
grant execute on function public.get_apple_deletion_context(uuid),
  public.prepare_apple_deletion(uuid,text,text,text),
  public.invalidate_apple_sessions(text,bigint) to service_role;
grant execute on function public.is_current_session_valid() to authenticated;
-- delete_my_account keeps its existing grants; auth.uid() remains mandatory.
