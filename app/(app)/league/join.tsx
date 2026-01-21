import { supabase } from "@/lib/supabase";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

type PlanTier = "A" | "B" | "C";
type UserTier = "free" | PlanTier;

type LeagueInfo = {
  id: string;
  name: string | null;
  activity: string | null;
  plan_tier: PlanTier | null;
  month_key: string | null;
  is_free: boolean | null;
  status: string | null;
};

export default function JoinLeagueScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();

  const codeFromLink = useMemo(() => {
    const v = params?.code;
    return typeof v === "string" ? v.trim() : "";
  }, [params]);

  const [code, setCode] = useState(codeFromLink || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [leagueInfo, setLeagueInfo] = useState<LeagueInfo | null>(null);
  const [joinedLeagueId, setJoinedLeagueId] = useState<string | null>(null);

  // Plan acceptance based on user's tier vs league tier
  const [accepting, setAccepting] = useState(false);
  const [userTier, setUserTier] = useState<UserTier>("free");

  async function getAuthedUserId(): Promise<string> {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error("Not authenticated");
    return data.user.id;
  }

  async function fetchLeagueInfo(leagueId: string): Promise<LeagueInfo> {
    const { data, error } = await supabase
      .from("leagues")
      .select("id,name,activity,plan_tier,month_key,is_free,status")
      .eq("id", leagueId)
      .single();

    if (error) throw error;

    return {
      id: data.id as string,
      name: (data.name as string) ?? null,
      activity: (data.activity as string) ?? null,
      plan_tier: (data.plan_tier as PlanTier) ?? null,
      month_key: (data.month_key as string) ?? null,
      is_free: (data.is_free as boolean) ?? null,
      status: (data.status as string) ?? null,
    };
  }

  async function fetchMyTier(uid: string): Promise<UserTier> {
    const { data, error } = await supabase.from("profiles").select("plan_tier").eq("id", uid).single();
    // If profile row doesn't exist, treat as free (you can auto-create elsewhere if needed)
    if (error) return "free";
    const t = (data?.plan_tier ?? "free") as UserTier;
    return t || "free";
  }

  async function acceptRequiredTier(required: UserTier) {
    try {
      setError(null);
      setAccepting(true);

      const uid = await getAuthedUserId();

      const { error: upErr } = await supabase
        .from("profiles")
        .upsert({ id: uid, plan_tier: required }, { onConflict: "id" });

      if (upErr) throw upErr;

      const refreshed = await fetchMyTier(uid);
      setUserTier(refreshed);
    } catch (e: any) {
      setError(e?.message ?? "Failed to accept plan");
    } finally {
      setAccepting(false);
    }
  }

  async function joinByCode(inviteCode: string) {
    const trimmed = inviteCode.trim();
    if (!trimmed) {
      setError("Invite code is required");
      return;
    }

    try {
      setError(null);
      setLoading(true);
      setLeagueInfo(null);
      setJoinedLeagueId(null);
      setUserTier("free");

      const { data: leagueId, error: rpcErr } = await supabase.rpc("join_league_by_code", {
        p_code: trimmed,
      });

      if (rpcErr) {
        if (rpcErr.message?.includes("invalid_invite_code")) throw new Error("Invalid invite code");
        throw rpcErr;
      }

      if (!leagueId) throw new Error("Join failed");

      const uid = await getAuthedUserId();
      const info = await fetchLeagueInfo(leagueId);
      const myTier = await fetchMyTier(uid);

      setLeagueInfo(info);
      setJoinedLeagueId(leagueId);
      setUserTier(myTier);
    } catch (e: any) {
      setError(e?.message ?? "Failed to open invite");
    } finally {
      setLoading(false);
    }
  }

  const requiredTier: UserTier = useMemo(() => {
    if (!leagueInfo) return "free";
    if (leagueInfo.is_free) return "free";
    return (leagueInfo.plan_tier ?? "free") as UserTier;
  }, [leagueInfo]);

  const needsAcceptance = useMemo(() => {
    if (!leagueInfo) return false;
    if (requiredTier === "free") return false;
    return userTier !== requiredTier;
  }, [leagueInfo, requiredTier, userTier]);

  const planLabel = useMemo(() => {
    if (!leagueInfo) return null;
    if (leagueInfo.is_free) return "Free league";
    if (leagueInfo.plan_tier) return `Plan chosen by owner: ${leagueInfo.plan_tier}`;
    return "Plan: —";
  }, [leagueInfo]);

  const continueDisabled = loading || accepting || !joinedLeagueId || needsAcceptance;

  return (
    <View style={{ flex: 1, padding: 20, paddingTop: 70, backgroundColor: "#0B0F14" }}>
      <Text style={{ fontSize: 28, fontWeight: "700", color: "white" }}>Join league</Text>

      <Text style={{ marginTop: 8, fontSize: 16, color: "#A7B0BC" }}>
        Paste an invite code to open a league invite.
      </Text>

      {(loading || accepting) && (
        <View style={{ marginTop: 14 }}>
          <ActivityIndicator />
        </View>
      )}

      {leagueInfo ? (
        <View
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 14,
            backgroundColor: "#111827",
            borderWidth: 1,
            borderColor: "#1F2937",
            gap: 8,
          }}
        >
          <Text style={{ color: "white", fontSize: 16, fontWeight: "800" }}>
            {leagueInfo.name ?? "League"}
          </Text>

          {leagueInfo.activity ? <Text style={{ color: "#A7B0BC" }}>{leagueInfo.activity}</Text> : null}

          {planLabel ? (
            <Text style={{ color: "#A7B0BC" }}>
              {planLabel}
              {leagueInfo.month_key ? ` • ${leagueInfo.month_key}` : ""}
            </Text>
          ) : null}

          {/* Paid league acceptance gate based on profiles.plan_tier */}
          {requiredTier !== "free" ? (
            <View style={{ gap: 10, marginTop: 6 }}>
              <Text style={{ color: "#A7B0BC" }}>
                To join this league, you must accept the plan chosen by the owner. Payment will be enabled later.
              </Text>

              <Text style={{ color: "#6B7280", fontSize: 12 }}>
                Your tier: {userTier} • Required: {requiredTier}
              </Text>

              {needsAcceptance ? (
                <Pressable
                  onPress={() => acceptRequiredTier(requiredTier)}
                  disabled={accepting || loading}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor: "#1A2430",
                    borderWidth: 1,
                    borderColor: "#1F2937",
                    opacity: accepting || loading ? 0.65 : 1,
                  }}
                >
                  <Text style={{ color: "white", fontSize: 16, fontWeight: "700", textAlign: "center" }}>
                    {accepting ? "Accepting..." : `Accept plan ${requiredTier}`}
                  </Text>
                </Pressable>
              ) : (
                <Text style={{ color: "#A7B0BC" }}>Plan accepted. You can continue.</Text>
              )}
            </View>
          ) : (
            <Text style={{ color: "#A7B0BC" }}>You can continue.</Text>
          )}

          <Pressable
            onPress={() => {
              if (!joinedLeagueId) return;
              router.replace(`/league/${joinedLeagueId}`);
            }}
            disabled={continueDisabled}
            style={{
              marginTop: 8,
              padding: 14,
              borderRadius: 12,
              backgroundColor: continueDisabled ? "#0F172A" : "#1A2430",
              borderWidth: 1,
              borderColor: "#1F2937",
              opacity: continueDisabled ? 0.65 : 1,
            }}
          >
            <Text style={{ color: "white", fontSize: 16, fontWeight: "700", textAlign: "center" }}>
              Continue to league
            </Text>
          </Pressable>

          {needsAcceptance ? (
            <Text style={{ marginTop: 4, color: "#6B7280", fontSize: 12 }}>
              You must accept the plan before entering.
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ marginTop: 18, gap: 12 }}>
        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="Invite code"
          placeholderTextColor="#6B7280"
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!loading && !accepting}
          style={{
            borderWidth: 1,
            borderColor: "#1F2937",
            padding: 14,
            borderRadius: 14,
            color: "white",
            backgroundColor: "#111827",
            letterSpacing: 2,
            fontWeight: "700",
          }}
        />

        {error ? <Text style={{ color: "tomato" }}>{error}</Text> : null}

        <Pressable
          onPress={() => joinByCode(code)}
          disabled={loading || accepting}
          style={{
            padding: 16,
            borderRadius: 14,
            backgroundColor: loading || accepting ? "#0F172A" : "#1A2430",
            borderWidth: 1,
            borderColor: "#1F2937",
          }}
        >
          <Text style={{ color: "white", fontSize: 16, fontWeight: "700", textAlign: "center" }}>
            {loading ? "Opening..." : "Open invite"}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.back()} disabled={loading || accepting}>
          <Text style={{ color: "#A7B0BC" }}>Back</Text>
        </Pressable>
      </View>
    </View>
  );
}
