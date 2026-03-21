create table if not exists public.app_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamp with time zone not null default now()
);

alter table public.app_admins enable row level security;

revoke all on table public.app_admins from anon;
revoke all on table public.app_admins from authenticated;

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path to 'public'
set row_security to 'off'
as $$
  select exists (
    select 1
    from public.app_admins
    where user_id = auth.uid()
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'leagues'
      and policyname = 'leagues_select_platform_admin'
  ) then
    create policy leagues_select_platform_admin
      on public.leagues
      for select
      to authenticated
      using (public.is_platform_admin());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'league_payments'
      and policyname = 'league_payments_select_self_or_admin'
  ) then
    create policy league_payments_select_self_or_admin
      on public.league_payments
      for select
      to authenticated
      using (
        user_id = auth.uid()
        or public.is_platform_admin()
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'league_results'
      and policyname = 'league_results_select_member_or_admin'
  ) then
    create policy league_results_select_member_or_admin
      on public.league_results
      for select
      to authenticated
      using (
        public.is_league_member(league_id)
        or public.is_platform_admin()
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reward_issuances'
      and policyname = 'reward_issuances_select_self_or_admin'
  ) then
    create policy reward_issuances_select_self_or_admin
      on public.reward_issuances
      for select
      to authenticated
      using (
        user_id = auth.uid()
        or public.is_platform_admin()
      );
  end if;
end
$$;

alter table public.league_payments enable row level security;
alter table public.league_results enable row level security;
alter table public.reward_issuances enable row level security;

alter view public.v_pending_reward_issuances set (security_invoker = true);
alter view public.v_monthly_charity_totals set (security_invoker = true);
alter view public.v_leagues_awaiting_completion set (security_invoker = true);
