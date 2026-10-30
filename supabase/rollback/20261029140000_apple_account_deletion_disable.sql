-- LOCAL REVIEW ONLY. Explicit approval required before production recovery.
-- Disable Edge endpoints separately before restoring the prior deletion behavior.
-- Retain private receipts for recovery; do not delete accounts or application data.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
CREATE OR REPLACE FUNCTION public.delete_my_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  delete from public.league_invites
  where created_by = v_uid;

  delete from public.leagues
  where created_by = v_uid;

  delete from auth.users
  where id = v_uid;
end;
$function$

revoke all on function public.get_apple_deletion_context(uuid),
 public.prepare_apple_deletion(uuid,text,text,text),
 public.invalidate_apple_sessions(text,bigint),public.is_current_session_valid()
 from public,anon,authenticated,service_role;
commit;
