create or replace function public.fixed_prize_amount_cents(
  p_plan_tier text,
  p_players_count integer
) returns integer
    language sql
    immutable
    set search_path to 'public'
as $$
  select case p_plan_tier
    when 'A' then 0
    when 'B' then case
      when coalesce(p_players_count, 0) >= 16 then 9500
      when coalesce(p_players_count, 0) >= 11 then 6500
      when coalesce(p_players_count, 0) >= 7 then 4000
      when coalesce(p_players_count, 0) >= 4 then 2200
      when coalesce(p_players_count, 0) >= 2 then 1000
      else 0
    end
    when 'C' then case
      when coalesce(p_players_count, 0) >= 16 then 20000
      when coalesce(p_players_count, 0) >= 11 then 14500
      when coalesce(p_players_count, 0) >= 8 then 9500
      when coalesce(p_players_count, 0) >= 5 then 5500
      when coalesce(p_players_count, 0) >= 3 then 2800
      else 0
    end
    else 0
  end
$$;

create or replace function public.fixed_charity_amount_cents(
  p_plan_tier text,
  p_players_count integer
) returns integer
    language sql
    immutable
    set search_path to 'public'
as $$
  select case p_plan_tier
    when 'A' then 0
    when 'B' then case
      when coalesce(p_players_count, 0) >= 16 then 800
      when coalesce(p_players_count, 0) >= 11 then 600
      when coalesce(p_players_count, 0) >= 7 then 400
      when coalesce(p_players_count, 0) >= 4 then 200
      when coalesce(p_players_count, 0) >= 2 then 100
      else 0
    end
    when 'C' then case
      when coalesce(p_players_count, 0) >= 16 then 1000
      when coalesce(p_players_count, 0) >= 11 then 800
      when coalesce(p_players_count, 0) >= 8 then 600
      when coalesce(p_players_count, 0) >= 5 then 400
      when coalesce(p_players_count, 0) >= 3 then 200
      else 0
    end
    else 0
  end
$$;

do $$
declare
  v_league_id uuid;
begin
  for v_league_id in
    select id from public.leagues
  loop
    perform public.recompute_league_financials(v_league_id);
  end loop;
end
$$;
