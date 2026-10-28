-- Operator-reviewed rollback only; do not run without deployment approval.
-- Disable the new RPC/triggers while preserving all logs and snapshots.
-- Also keep MONTHLY_RESULTS_AVAILABLE=false and stop the new app rollout.
begin;
revoke all on function public.get_free_league_history(uuid,date,integer)
  from public, anon, authenticated, service_role;
drop trigger if exists guard_free_cycle_log on public.daily_logs;
drop trigger if exists freeze_cycles_before_name_change on public.profiles;
commit;
-- Do not replay the CREATE TABLE migration to re-enable. Review a targeted
-- repair/re-enable script against the retained schema and data instead.
