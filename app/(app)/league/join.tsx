import { getPlanFullName, type PlanTier } from "@/features/leagues/plans";
import { supabase } from "@/lib/supabase";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

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

      const { data: leagueId, error: rpcError } = await supabase.rpc("join_league_by_code", {
        p_code: trimmed,
      });

      if (rpcError) {
        if (rpcError.message?.includes("invalid_invite_code")) throw new Error("Invalid invite code");
        if (rpcError.message?.includes("league_closed")) throw new Error("This league is already completed.");
        if (rpcError.message?.includes("league_full")) throw new Error("This league is full.");
        throw rpcError;
      }

      if (!leagueId) throw new Error("Join failed");

      const info = await fetchLeagueInfo(leagueId);
      setLeagueInfo(info);
      setJoinedLeagueId(leagueId);
    } catch (e: any) {
      setError(e?.message ?? "Failed to open invite");
    } finally {
      setLoading(false);
    }
  }

  const planLabel = useMemo(() => {
    if (!leagueInfo) return null;
    if (leagueInfo.is_free) return "Free trial league";
    if (leagueInfo.plan_tier) return `Commitment level: ${getPlanFullName(leagueInfo.plan_tier)}`;
    return "Commitment level: -";
  }, [leagueInfo]);

  const needsPurchase = !!leagueInfo?.plan_tier && !leagueInfo?.is_free;

  return (
    <View style={{ flex: 1, padding: 20, paddingTop: 70, backgroundColor: "#0B0F14" }}>
      <Text style={{ fontSize: 28, fontWeight: "700", color: "white" }}>Join league</Text>

      <Text style={{ marginTop: 8, fontSize: 16, color: "#A7B0BC" }}>
        Paste an invite code to open a league invite.
      </Text>

      {loading && (
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
              {leagueInfo.month_key ? ` - ${leagueInfo.month_key}` : ""}
            </Text>
          ) : null}

          <Text style={{ color: "#A7B0BC" }}>
            {needsPurchase
              ? "Invite accepted. Complete league entry purchase before participating."
              : "Invite accepted. You can continue."}
          </Text>

          <Pressable
            onPress={() => {
              if (!joinedLeagueId) return;
              if (needsPurchase) {
                router.replace({
                  pathname: "/(app)/league/purchase",
                  params: {
                    leagueId: joinedLeagueId,
                    next: `/(app)/league/${joinedLeagueId}`,
                  },
                });
                return;
              }

              router.replace(`/(app)/league/${joinedLeagueId}`);
            }}
            disabled={loading || !joinedLeagueId}
            style={{
              marginTop: 8,
              padding: 14,
              borderRadius: 12,
              backgroundColor: loading || !joinedLeagueId ? "#0F172A" : "#1A2430",
              borderWidth: 1,
              borderColor: "#1F2937",
              opacity: loading || !joinedLeagueId ? 0.65 : 1,
            }}
          >
            <Text style={{ color: "white", fontSize: 16, fontWeight: "700", textAlign: "center" }}>
              {needsPurchase ? "Continue to payment" : "Continue to league"}
            </Text>
          </Pressable>
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
          editable={!loading}
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
          disabled={loading}
          style={{
            padding: 16,
            borderRadius: 14,
            backgroundColor: loading ? "#0F172A" : "#1A2430",
            borderWidth: 1,
            borderColor: "#1F2937",
          }}
        >
          <Text style={{ color: "white", fontSize: 16, fontWeight: "700", textAlign: "center" }}>
            {loading ? "Opening..." : "Open invite"}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.back()} disabled={loading}>
          <Text style={{ color: "#A7B0BC" }}>Back</Text>
        </Pressable>
      </View>
    </View>
  );
}
