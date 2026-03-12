import { supabase } from "../lib/supabase";

export type PendingRewardIssuance = {
  id: string;
  league_id: string;
  league_name: string | null;
  month_key: string | null;
  user_id: string;
  reward_type: string;
  reward_value_cents: number;
  reward_status: string;
  created_at: string;
  issued_at: string | null;
};

export type MonthlyCharityTotal = {
  month_key: string;
  leagues_count: number;
  charity_amount_cents: number;
};

export type LeagueAwaitingCompletion = {
  id: string;
  name: string | null;
  month_key: string | null;
  plan_tier: string | null;
  players_count: number;
  prize_amount_cents: number;
  charity_amount_cents: number;
};

export async function getPendingRewardIssuances() {
  const { data, error } = await supabase
    .from("v_pending_reward_issuances")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data ?? []) as PendingRewardIssuance[];
}

export async function getMonthlyCharityTotals() {
  const { data, error } = await supabase
    .from("v_monthly_charity_totals")
    .select("*")
    .order("month_key", { ascending: false })
    .limit(12);

  if (error) throw error;
  return (data ?? []) as MonthlyCharityTotal[];
}

export async function getLeaguesAwaitingCompletion() {
  const { data, error } = await supabase
    .from("v_leagues_awaiting_completion")
    .select("*")
    .order("month_key", { ascending: true })
    .limit(20);

  if (error) throw error;
  return (data ?? []) as LeagueAwaitingCompletion[];
}
