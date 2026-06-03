-- App Store account deletion support.
--
-- Auth users cannot delete themselves with the public anon key, so the app calls
-- this authenticated RPC. Deleting from auth.users cascades to profiles, and
-- profiles cascade to the user's memberships, logs, payments, and related rows.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  delete from public.league_invites
  where created_by = v_uid;

  delete from auth.users
  where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
