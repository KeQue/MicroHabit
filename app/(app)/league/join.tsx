import { supabase } from "@/lib/supabase";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";


type PlanTier = "A" | "B" | "C";

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

  // Optional: /join?code=XXXX (not required, but safe to keep)
  const codeFromLink = useMemo(() => {
    const v = params?.code;
    return typeof v === "string" ? v.trim() : "";
  }, [params]);

  const [code, setCode] = useState(codeFromLink || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [leagueInfo, setLeagueInfo] = useState<LeagueInfo | null>(null);
  const [joinedLeagueId, setJoinedLeagueId] = useState<string | null>(null);

  // Acceptance handshake state
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  async function fetchLeagueInfo(leagueId: string) {
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
    } as LeagueInfo;
  }

  async function acceptPlanAndAgreeToPay(leagueId: string) {
    try {
      setError(null);
      setAccepting(true);

      const { error: rpcErr } = await supabase.rpc("accept_invite_and_agree", {
        p_league_id: leagueId,
      });

      if (rpcErr) throw rpcErr;

      setAccepted(true);
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
      setAccepted(false);

      const { data: leagueId, error: rpcErr } = await supabase.rpc("join_league_by_code", {
        p_code: trimmed,
      });

      if (rpcErr) {
        if (rpcErr.message?.includes("invalid_invite_code")) {
          throw new Error("Invalid invite code");
        }
        throw rpcErr;
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
    if (leagueInfo.is_free) return "Free league";
    if (leagueInfo.plan_tier) return `Plan chosen by owner: ${leagueInfo.plan_tier}`;
    return "Plan: —";
  }, [leagueInfo]);

  const requiresAcceptance = useMemo(() => {
    if (!leagueInfo) return false;
    if (leagueInfo.is_free) return false;
    return true;
  }, [leagueInfo]);

  const continueDisabled =
    loading || accepting || !joinedLeagueId || (requiresAcceptance && !accepted);

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

      {/* League summary + acceptance gate */}
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

          {leagueInfo.activity ? (
            <Text style={{ color: "#A7B0BC" }}>{leagueInfo.activity}</Text>
          ) : null}

          {planLabel ? (
            <Text style={{ color: "#A7B0BC" }}>
              {planLabel}
              {leagueInfo.month_key ? ` • ${leagueInfo.month_key}` : ""}
            </Text>
          ) : null}

          {/* Option A: explicit acceptance required for paid leagues */}
          {requiresAcceptance ? (
            <>
              <Text style={{ color: "#A7B0BC" }}>
                To join this league you must accept the plan chosen by the owner and agree to pay your share.
                Payment will be enabled later.
              </Text>

            import { Link } from "expo-router"; // ← must exist at top

<Link href="/(app)/league/join" asChild>
  <Pressable
    style={{ padding: 16, borderRadius: 14, backgroundColor: "#1A2430" }}
  >
    <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
      🔑 Join with code
    </Text>
  </Pressable>
</Link>

            </>
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

          {requiresAcceptance && !accepted ? (
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
