update public.league_members lm
set
  payment_status = 'paid',
  agreed_at = coalesce(lm.agreed_at, lm.joined_at, now()),
  paid_at = coalesce(lm.paid_at, lm.joined_at, now())
from public.leagues l
where l.id = lm.league_id
  and coalesce(l.is_free, false) = false
  and l.plan_tier in ('A', 'B', 'C')
  and lm.payment_status in ('unpaid', 'agreed', 'trial');

drop policy if exists daily_logs_write_only_paid_or_free on public.daily_logs;

create policy daily_logs_write_only_paid_or_free on public.daily_logs
to authenticated
using (
  (user_id = auth.uid()) and (
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
        and lm.payment_status in ('paid', 'agreed')
    )
  )
)
with check (
  (user_id = auth.uid()) and (
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
        and lm.payment_status in ('paid', 'agreed')
    )
  )
);
