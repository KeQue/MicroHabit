import { supabase } from "../../lib/supabase";

/**
 * Data types
 */
export type PlanTier = "A" | "B" | "C";

export type LeagueStatus = "active" | "payment_required" | "completed" | string;

export type League = {
  id: string;
  name: string | null;
  activity: string | null;

  plan_tier?: PlanTier | null;
  month_key?: string | null;

  // NEW
  is_free?: boolean | null;
  status?: LeagueStatus | null;

  // Invite code (NEW)
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
};

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
    p.username?.trim() ||
    p.name?.trim() ||
    emailPrefix(p.email)?.trim() ||
    "User"
  );
}

/**
 * My leagues (for current logged-in user)
 */
export async function getMyLeagues(userId: string): Promise<League[]> {
  const { data, error } = await supabase
    .from("league_members")
    .select(
      "league:leagues(id,name,activity,plan_tier,month_key,is_free,status,invite_code,created_at)"
    )
    .eq("user_id", userId);

  if (error) throw error;

  const leagues = (data ?? []).map((row: any) => row.league).filter(Boolean);
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
    .select("id,name,activity,plan_tier,month_key,is_free,status,invite_code,created_at")
    .eq("id", leagueId)
    .single();

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
  return (members ?? []).map((m: any) => {
    const profile = byId.get(m.user_id) ?? null;
    return {
      user_id: m.user_id as string,
      role: m.role as string,
      joined_at: (m.joined_at as string) ?? null,
      profile,
      display_name: displayNameFromProfile(profile),
    };
  });
}

/**
 * League info (for header title + activity subtitle)
 */
export async function getLeague(leagueId: string): Promise<League> {
  const { data, error } = await supabase
    .from("leagues")
    .select("id,name,activity,plan_tier,month_key,is_free,status,invite_code,created_at")
    .eq("id", leagueId)
    .single();

  if (error) throw error;
  return data as League;
}
