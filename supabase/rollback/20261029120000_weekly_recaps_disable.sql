-- Disable the new recap endpoint only. No check-ins, history or names change.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
drop function public.get_free_league_weekly_recap(uuid);
notify pgrst,'reload schema';
commit;
