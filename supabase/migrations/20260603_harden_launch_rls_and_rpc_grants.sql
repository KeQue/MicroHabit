-- Launch hardening for public Supabase API access.
--
-- Supabase permissive RLS policies are ORed together. These drops remove older
-- broad self-write policies that bypass the stricter paid/member/date rules.

drop policy if exists daily_logs_insert_after_join on public.daily_logs;
drop policy if exists daily_logs_update_after_join on public.daily_logs;
drop policy if exists daily_logs_update_self on public.daily_logs;
drop policy if exists daily_logs_upsert_self on public.daily_logs;
drop policy if exists daily_logs_write_only_paid_or_free on public.daily_logs;
drop policy if exists "delete own daily logs" on public.daily_logs;
drop policy if exists "insert own daily logs" on public.daily_logs;
drop policy if exists "update own daily logs" on public.daily_logs;
drop policy if exists daily_logs_no_direct_delete on public.daily_logs;
drop policy if exists daily_logs_no_direct_insert on public.daily_logs;
drop policy if exists daily_logs_no_direct_update on public.daily_logs;

create policy daily_logs_insert_access_member_recent
on public.daily_logs
for insert
to authenticated
with check (
  user_id = auth.uid()
  and log_date between ((now() at time zone 'utc')::date - 1) and (now() at time zone 'utc')::date
  and exists (
    select 1
    from public.league_members lm
    join public.leagues l on l.id = lm.league_id
    where lm.league_id = daily_logs.league_id
      and lm.user_id = auth.uid()
      and daily_logs.log_date >= (lm.joined_at)::date
      and (
        l.is_free = true
        or lm.role = 'owner'
        or lm.payment_status in ('free', 'trial', 'agreed', 'paid')
      )
  )
);

create policy daily_logs_update_access_member_recent
on public.daily_logs
for update
to authenticated
using (
  user_id = auth.uid()
  and log_date between ((now() at time zone 'utc')::date - 1) and (now() at time zone 'utc')::date
  and exists (
    select 1
    from public.league_members lm
    join public.leagues l on l.id = lm.league_id
    where lm.league_id = daily_logs.league_id
      and lm.user_id = auth.uid()
      and daily_logs.log_date >= (lm.joined_at)::date
      and (
        l.is_free = true
        or lm.role = 'owner'
        or lm.payment_status in ('free', 'trial', 'agreed', 'paid')
      )
  )
)
with check (
  user_id = auth.uid()
  and log_date between ((now() at time zone 'utc')::date - 1) and (now() at time zone 'utc')::date
  and exists (
    select 1
    from public.league_members lm
    join public.leagues l on l.id = lm.league_id
    where lm.league_id = daily_logs.league_id
      and lm.user_id = auth.uid()
      and daily_logs.log_date >= (lm.joined_at)::date
      and (
        l.is_free = true
        or lm.role = 'owner'
        or lm.payment_status in ('free', 'trial', 'agreed', 'paid')
      )
  )
);

create policy daily_logs_delete_access_member_recent
on public.daily_logs
for delete
to authenticated
using (
  user_id = auth.uid()
  and log_date between ((now() at time zone 'utc')::date - 1) and (now() at time zone 'utc')::date
  and exists (
    select 1
    from public.league_members lm
    join public.leagues l on l.id = lm.league_id
    where lm.league_id = daily_logs.league_id
      and lm.user_id = auth.uid()
      and daily_logs.log_date >= (lm.joined_at)::date
      and (
        l.is_free = true
        or lm.role = 'owner'
        or lm.payment_status in ('free', 'trial', 'agreed', 'paid')
      )
  )
);

-- Users must join through invite/payment RPCs, not direct table writes.
drop policy if exists league_members_insert_self on public.league_members;
drop policy if exists league_members_delete_self on public.league_members;

revoke insert, update, delete on public.league_members from anon, authenticated;

-- Paywall/admin toggles and legacy toggle RPCs are not public app APIs.
revoke all on function public.set_paywall_enabled(boolean) from public;
revoke all on function public.set_paywall_enabled(boolean) from anon;
revoke all on function public.set_paywall_enabled(boolean) from authenticated;
grant execute on function public.set_paywall_enabled(boolean) to service_role;

revoke all on function public.toggle_daily_log(uuid, date) from public;
revoke all on function public.toggle_daily_log(uuid, date) from anon;
revoke all on function public.toggle_daily_log(uuid, date) from authenticated;
grant execute on function public.toggle_daily_log(uuid, date) to service_role;

revoke all on function public.toggle_daily_log(uuid, date, boolean) from public;
revoke all on function public.toggle_daily_log(uuid, date, boolean) from anon;
revoke all on function public.toggle_daily_log(uuid, date, boolean) from authenticated;
grant execute on function public.toggle_daily_log(uuid, date, boolean) to service_role;

revoke execute on function public.accept_invite_and_agree(uuid) from anon;
revoke execute on function public.create_league_and_join(text, text, text, text, boolean) from anon;
revoke execute on function public.join_league_by_code(text) from anon;
revoke execute on function public.join_league_by_id(uuid) from anon;

-- Deleting an account should remove owned leagues too, because created_by is
-- not nullable and otherwise keeps user-linked records after profile deletion.
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

  delete from public.leagues
  where created_by = v_uid;

  delete from auth.users
  where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
