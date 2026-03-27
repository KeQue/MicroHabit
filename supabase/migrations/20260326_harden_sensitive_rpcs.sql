create or replace function public.set_paywall_enabled(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_authorized';
  end if;

  insert into public.app_config(key, value, updated_at)
  values ('paywall_enabled', to_jsonb(p_enabled), now())
  on conflict (key) do update
    set value = excluded.value,
        updated_at = now();
end;
$$;

revoke all on function public.set_paywall_enabled(boolean) from public;
revoke all on function public.set_paywall_enabled(boolean) from anon;
revoke all on function public.set_paywall_enabled(boolean) from authenticated;
grant execute on function public.set_paywall_enabled(boolean) to authenticated;

revoke all on function public.recompute_league_financials(uuid) from public;
revoke all on function public.recompute_league_financials(uuid) from anon;
revoke all on function public.recompute_league_financials(uuid) from authenticated;
grant execute on function public.recompute_league_financials(uuid) to service_role;

revoke all on function public.settle_league_results(uuid) from public;
revoke all on function public.settle_league_results(uuid) from anon;
revoke all on function public.settle_league_results(uuid) from authenticated;
grant execute on function public.settle_league_results(uuid) to service_role;
