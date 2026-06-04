-- Allow the app's today/yesterday edit window even when a user joins or creates
-- a free league today. Paid league writes stay blocked until payment is live.

drop policy if exists daily_logs_insert_access_member_recent on public.daily_logs;
drop policy if exists daily_logs_update_access_member_recent on public.daily_logs;
drop policy if exists daily_logs_delete_access_member_recent on public.daily_logs;
drop policy if exists daily_logs_insert_free_member_recent on public.daily_logs;
drop policy if exists daily_logs_update_free_member_recent on public.daily_logs;
drop policy if exists daily_logs_delete_free_member_recent on public.daily_logs;

create policy daily_logs_insert_free_member_recent
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
      and l.is_free = true
      and daily_logs.log_date >= (((lm.joined_at at time zone 'utc')::date) - 1)
  )
);

create policy daily_logs_update_free_member_recent
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
      and l.is_free = true
      and daily_logs.log_date >= (((lm.joined_at at time zone 'utc')::date) - 1)
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
      and l.is_free = true
      and daily_logs.log_date >= (((lm.joined_at at time zone 'utc')::date) - 1)
  )
);

create policy daily_logs_delete_free_member_recent
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
      and l.is_free = true
      and daily_logs.log_date >= (((lm.joined_at at time zone 'utc')::date) - 1)
  )
);
