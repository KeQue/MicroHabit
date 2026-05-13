-- Repair paid/test league member write access for daily logs.
--
-- Joined paid members can be in these MVP/testing states:
-- - trial: temporary free/test access
-- - agreed: accepted the league plan before real IAP is wired
-- - paid: real paid access once purchases are implemented
--
-- The app writes daily_logs directly with an authenticated Supabase client, so
-- RLS must allow the signed-in member to insert/update their own rows when they
-- have one of those access states. Keep "unpaid" blocked.

drop policy if exists daily_logs_write_only_paid_or_free on public.daily_logs;

create policy daily_logs_write_only_paid_or_free
on public.daily_logs
for all
to authenticated
using (
  user_id = auth.uid()
  and (
    exists (
      select 1
      from public.leagues l
      where l.id = daily_logs.league_id
        and l.is_free = true
    )
    or exists (
      select 1
      from public.league_members lm
      where lm.league_id = daily_logs.league_id
        and lm.user_id = auth.uid()
        and (
          lm.role = 'owner'
          or lm.payment_status in ('free', 'trial', 'agreed', 'paid')
        )
    )
  )
)
with check (
  user_id = auth.uid()
  and (
    exists (
      select 1
      from public.leagues l
      where l.id = daily_logs.league_id
        and l.is_free = true
    )
    or exists (
      select 1
      from public.league_members lm
      where lm.league_id = daily_logs.league_id
        and lm.user_id = auth.uid()
        and (
          lm.role = 'owner'
          or lm.payment_status in ('free', 'trial', 'agreed', 'paid')
        )
    )
  )
);
