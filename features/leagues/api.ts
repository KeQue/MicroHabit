import { supabase } from "../../lib/supabase";
import type { PlanTier } from "./plans";

/**
 * Data types
 */
export type LeagueStatus = "active" | "payment_required" | "completed" | string;
export type LeaguePaymentStatus = "free" | "trial" | "unpaid" | "agreed" | "paid" | string;

export type League = {
  id: string;
  name: string | null;
  activity: string | null;

  plan_tier?: PlanTier | null;
  month_key?: string | null;
  entry_fee_cents?: number | null;
  platform_fee_cents?: number | null;
  winner_share_bps?: number | null;
  charity_share_bps?: number | null;
  qualification_days_min?: number | null;
  players_count?: number | null;
  gross_revenue_cents?: number | null;
  estimated_store_fee_cents?: number | null;
  net_revenue_cents?: number | null;
  prize_amount_cents?: number | null;
  charity_amount_cents?: number | null;
  commito_margin_cents?: number | null;
  max_players?: number | null;

  is_free?: boolean | null;
  status?: LeagueStatus | null;
  my_payment_status?: LeaguePaymentStatus | null;
  invite_code?: string | null;
  created_at?: string | null;
};

export type Profile = {
  id: string;
  username: string | null; // preferred short handle
  name: string | null; // optional full name
  email: string | null; // fallback (not ideal long-term)
};

export type LeagueMember = {
  user_id: string;
  role: string;
  joined_at: string | null;
  profile: Profile | null;
  display_name: string; // what the UI should show
  has_profile: boolean;
};

const LEAGUE_SELECT_BASE = "id,name,activity,plan_tier,month_key,is_free,status,invite_code,created_at";
const LEAGUE_SELECT_WITH_ECONOMICS =
  "id,name,activity,plan_tier,month_key,is_free,entry_fee_cents,platform_fee_cents,winner_share_bps,charity_share_bps,qualification_days_min,players_count,gross_revenue_cents,estimated_store_fee_cents,net_revenue_cents,prize_amount_cents,charity_amount_cents,commito_margin_cents,max_players,status,invite_code,created_at";

function isMissingEconomicsColumnError(error: any) {
  const message = String(error?.message ?? "").toLowerCase();
  return (
    message.includes("entry_fee_cents") ||
    message.includes("platform_fee_cents") ||
    message.includes("winner_share_bps") ||
    message.includes("charity_share_bps") ||
    message.includes("qualification_days_min") ||
    message.includes("players_count") ||
    message.includes("gross_revenue_cents") ||
    message.includes("estimated_store_fee_cents") ||
    message.includes("net_revenue_cents") ||
    message.includes("prize_amount_cents") ||
    message.includes("charity_amount_cents") ||
    message.includes("commito_margin_cents") ||
    message.includes("max_players")
  );
}

async function selectLeaguesWithFallback(
  build: (selectClause: string) => any
) {
  let result = await build(LEAGUE_SELECT_WITH_ECONOMICS);
  if (!result.error || !isMissingEconomicsColumnError(result.error)) return result;
  return build(LEAGUE_SELECT_BASE);
}

/**
 * Helpers
 */
function emailPrefix(email: string | null) {
  if (!email) return null;
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

function displayNameFromProfile(p: Profile | null) {
  if (!p) return "User";
  return (
    p.name?.trim() ||
    p.username?.trim() ||
    emailPrefix(p.email)?.trim() ||
    "User"
  );
}

function currentMonthBoundsISO(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
  return { start, end };
}

/**
 * My leagues (for current logged-in user)
 */
export async function getMyLeagues(userId: string): Promise<League[]> {
  const { data, error } = await selectLeaguesWithFallback((selectClause) =>
    supabase
      .from("league_members")
      .select(`payment_status,league:leagues(${selectClause})`)
      .eq("user_id", userId)
  );

  if (error) throw error;

  const leagues = (data ?? [])
    .map((row: any) => {
      if (!row.league) return null;
      return {
        ...row.league,
        my_payment_status: (row.payment_status as LeaguePaymentStatus) ?? null,
      } as League;
    })
    .filter(Boolean);
  return leagues as League[];
}

/**
 * Creates a league AND adds current user as owner in one atomic RPC.
 * Expects SQL:
 *   create_league_and_join(p_name text, p_activity text, p_plan_tier text, p_month_key text, p_is_free boolean) returns uuid
 */
export async function createLeague({
  name,
  activity,
  planTier,
  monthKey,
  isFree = false,
}: {
  name: string;
  activity: string;
  planTier: PlanTier | null; // null for Free
  monthKey: string;
  isFree?: boolean; // true for Free
}): Promise<League> {
  const trimmedName = name.trim();
  const trimmedActivity = activity.trim().slice(0, 40);

  if (!trimmedName) throw new Error("League name is required");
  if (!trimmedActivity) throw new Error("Activity is required (max 40 chars)");
  if (!monthKey) throw new Error("Month key is required");

  // Contract:
  // - Free => planTier must be null
  // - Paid => planTier must be A/B/C
  if (!isFree) {
    if (planTier !== "A" && planTier !== "B" && planTier !== "C") {
      throw new Error("Plan tier is required");
    }
  }

  // 1) Atomic create + join (server-side)
  const { data: leagueId, error: rpcErr } = await supabase.rpc(
    "create_league_and_join",
    {
      p_name: trimmedName,
      p_activity: trimmedActivity,
      p_month_key: monthKey,
      p_is_free: isFree,
      p_plan_tier: planTier, // pass null for free
    }
  );

  if (rpcErr) throw rpcErr;
  if (!leagueId) throw new Error("Failed to create league");

  // 2) Fetch league row (consistent return shape)
  const { data: league, error: leagueErr } = await supabase
    .from("leagues")
    .select(LEAGUE_SELECT_WITH_ECONOMICS)
    .eq("id", leagueId)
    .single();

  if (leagueErr && isMissingEconomicsColumnError(leagueErr)) {
    const fallback = await supabase.from("leagues").select(LEAGUE_SELECT_BASE).eq("id", leagueId).single();
    if (fallback.error) throw fallback.error;
    return fallback.data as League;
  }

  if (leagueErr) throw leagueErr;
  return league as League;
}

/**
 * Safe members fetch (NO EMBEDS) -> avoids relationship ambiguity.
 * Fetch members first, then profiles, then merge.
 */
export async function getLeagueMembers(
  leagueId: string
): Promise<LeagueMember[]> {
  // 1) members
  const { data: members, error: memErr } = await supabase
    .from("league_members")
    .select("user_id, role, joined_at")
    .eq("league_id", leagueId)
    .order("joined_at", { ascending: true });

  if (memErr) throw memErr;

  const userIds = (members ?? []).map((m: any) => m.user_id);
  if (userIds.length === 0) return [];

  // 2) profiles
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, username, name, email")
    .in("id", userIds);

  if (profErr) throw profErr;

  const byId = new Map<string, Profile>();
  (profiles ?? []).forEach((p: any) => {
    byId.set(p.id, {
      id: p.id,
      username: p.username ?? null,
      name: p.name ?? null,
      email: p.email ?? null,
    });
  });

  // 3) merge
  const merged = (members ?? []).map((m: any) => {
    const profile = byId.get(m.user_id) ?? null;
    return {
      user_id: m.user_id as string,
      role: m.role as string,
      joined_at: (m.joined_at as string) ?? null,
      profile,
      display_name: displayNameFromProfile(profile),
      has_profile: profile !== null,
    };
  });

  if (__DEV__) {
    console.log("[getLeagueMembers] requested user ids", userIds);
    console.log(
      "[getLeagueMembers] returned profile ids",
      (profiles ?? []).map((p: any) => p.id)
    );
    console.log(
      "[getLeagueMembers] merged",
      merged.map((m) => ({
        user_id: m.user_id,
        hasProfile: m.has_profile,
        display_name: m.display_name,
      }))
    );
  }

  return merged;
}

/**
 * League info (for header title + activity subtitle)
 */
export async function getLeague(leagueId: string): Promise<League> {
  const { data, error } = await selectLeaguesWithFallback((selectClause) =>
    supabase.from("leagues").select(selectClause).eq("id", leagueId).single()
  );

  if (error) throw error;
  return data as League;
}

/**
 * Load current-month logs for a league (user_id + log_date rows)
 */
export async function loadMonthLogs(leagueId: string) {
  const { start, end } = currentMonthBoundsISO();
  const { data, error } = await supabase
    .from("daily_logs")
    .select("user_id, log_date")
    .eq("league_id", leagueId)
    .gte("log_date", start)
    .lte("log_date", end);

  if (error) throw error;
  return data ?? [];
}

/**
 * Toggle a specific day for the signed-in user.
 * on = true  -> upsert
 * on = false -> delete
 */
export async function toggleDay(params: {
  leagueId: string;
  userId: string;
  dateISO: string; // 'YYYY-MM-DD'
  on: boolean;
}) {
  const { leagueId, dateISO, on } = params;

  const { error } = await supabase.rpc("toggle_daily_log", {
    p_league_id: leagueId,
    p_log_date: dateISO,
    p_completed: on,
  });
  if (error) throw error;
}

/**
 * Leaderboard for current month: sorted by days desc, then longest_streak desc.
 */
export async function getLeaderboard(leagueId: string) {
  const { data, error } = await supabase
    .from("v_month_results")
    .select("user_id, days_completed, longest_streak, position")
    .eq("league_id", leagueId)
    .order("position", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
