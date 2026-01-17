import { supabase } from "../../lib/supabase";

export type League = {
  id: string;
  name: string | null;
  created_at?: string | null;
};

export type Profile = {
  id: string;
  name: string | null;
  email: string | null;
};

// Supabase may return joined rows as object OR array depending on relationship inference
type ProfileJoin = Profile | Profile[] | null;

export type LeagueMember = {
  user_id: string;
  role: string;
  joined_at: string | null;
  profile: ProfileJoin;
};

export async function getMyLeagues(userId: string): Promise<League[]> {
  const { data, error } = await supabase
    .from("league_members")
    .select("league:leagues(id,name,created_at)")
    .eq("user_id", userId);

  if (error) throw error;

  const leagues = (data ?? [])
    .map((row: any) => row.league)
    .filter(Boolean);

  return leagues as League[];
}

/**
 * Creates a league AND adds the current user as owner in one atomic RPC.
 * Returns the created league (id + name + created_at).
 */
export async function createLeague(name: string): Promise<League> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("League name is required");

  const { data: leagueId, error: rpcErr } = await supabase.rpc(
    "create_league_and_join",
    { p_name: trimmed }
  );

  if (rpcErr) throw rpcErr;
  if (!leagueId) throw new Error("Failed to create league");

  const { data: league, error: leagueErr } = await supabase
    .from("leagues")
    .select("id,name,created_at")
    .eq("id", leagueId)
    .single();

  if (leagueErr) throw leagueErr;

  return league as League;
}

/**
 * Returns league members with a normalized `profile` shape.
 * (Always `Profile | null`, even if Supabase returns an array.)
 */
export async function getLeagueMembers(
  leagueId: string
): Promise<Array<{ user_id: string; role: string; joined_at: string | null; profile: Profile | null }>> {
  const { data, error } = await supabase
    .from("league_members")
    .select("user_id, role, joined_at, profile:profiles(id,name,email)")
    .eq("league_id", leagueId);

  if (error) throw error;

  const normalized = (data ?? []).map((row: any) => ({
    user_id: row.user_id as string,
    role: row.role as string,
    joined_at: (row.joined_at as string) ?? null,
    profile: Array.isArray(row.profile) ? (row.profile[0] ?? null) : (row.profile ?? null),
  }));

  return normalized;
}
