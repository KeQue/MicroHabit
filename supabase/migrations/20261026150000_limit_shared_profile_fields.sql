-- Prepared 26 October 2026. Keep private profile fields visible only to their
-- account holder. League peers receive a deliberately narrow display profile.
-- Existing own-profile SELECT/INSERT/UPDATE policies remain unchanged.
drop policy if exists "league members can read related profiles" on public.profiles;

create or replace function public.get_league_member_profiles(p_league_id uuid)
returns table (id uuid, username text, name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1 from public.league_members lm
    where lm.league_id = p_league_id and lm.user_id = auth.uid()
  ) then
    raise exception 'not_league_member';
  end if;

  return query
    select p.id, p.username, p.name
    from public.league_members lm
    join public.profiles p on p.id = lm.user_id
    where lm.league_id = p_league_id;
end;
$$;

revoke all on function public.get_league_member_profiles(uuid) from public;
revoke all on function public.get_league_member_profiles(uuid) from anon;
grant execute on function public.get_league_member_profiles(uuid) to authenticated;
