-- Align daily log write permissions with the actual membership states produced
-- by league creation/join flows.
--
-- Intended behavior:
-- - free leagues: members can log days
-- - paid leagues: owners can always log days
-- - members can log days when their payment/access state is one of:
--   free, trial, agreed, paid
-- - explicitly blocked state remains: unpaid

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
