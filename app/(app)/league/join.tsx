import { supabase } from "@/lib/supabase";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

export default function JoinLeagueScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ leagueId?: string; code?: string }>();

  // If opened from invite link: /league/join?leagueId=...
  const leagueIdFromLink = useMemo(() => {
    const v = params?.leagueId;
    return typeof v === "string" ? v.trim() : "";
  }, [params]);

  // Optional: if you ever use /league/join?code=XXXX
  const codeFromLink = useMemo(() => {
    const v = params?.code;
    return typeof v === "string" ? v.trim() : "";
  }, [params]);

  const [code, setCode] = useState(codeFromLink || "");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prevent double-run on iOS/Expo dev
  const autoJoinRanRef = useRef(false);

  async function joinByCode(inviteCode: string) {
    const trimmed = inviteCode.trim();
    if (!trimmed) {
      setError("Invite code is required");
      return;
    }

    try {
      setError(null);
      setJoining(true);

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

      router.replace(`/league/${leagueId}`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to join league");
    } finally {
      setJoining(false);
    }
  }

  // IMPORTANT:
  // Do NOT insert into league_members from the client (RLS blocks it).
  // Use a SECURITY DEFINER RPC: join_league_by_id(p_league_id uuid)
  async function joinByLeagueId(leagueId: string) {
    const trimmedId = leagueId.trim();
    if (!trimmedId) return;

    try {
      setError(null);
      setJoining(true);

      // Must be signed in
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!userRes.user) {
        router.replace("/sign-in");
        return;
      }

      const { data, error: rpcErr } = await supabase.rpc("join_league_by_id", {
        p_league_id: trimmedId,
      });

      if (rpcErr) throw rpcErr;
      if (!data) throw new Error("Join failed");

      router.replace(`/league/${data}`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to join league");
    } finally {
      setJoining(false);
    }
  }

  // Auto-join when opened from an invite link containing leagueId
  useEffect(() => {
    if (!leagueIdFromLink) return;
    if (autoJoinRanRef.current) return;
    autoJoinRanRef.current = true;

    joinByLeagueId(leagueIdFromLink);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueIdFromLink]);

  return (
    <View style={{ flex: 1, padding: 20, paddingTop: 70, backgroundColor: "#0B0F14" }}>
      <Text style={{ fontSize: 28, fontWeight: "700", color: "white" }}>Join league</Text>

      <Text style={{ marginTop: 8, fontSize: 16, color: "#A7B0BC" }}>
        {leagueIdFromLink ? "Opening invite… joining you automatically." : "Paste an invite code to join a league."}
      </Text>

      {/* If invite link is used, we hide the input to avoid confusion */}
      {!leagueIdFromLink ? (
        <View style={{ marginTop: 18, gap: 12 }}>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="Invite code"
            placeholderTextColor="#6B7280"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!joining}
            style={{
              borderWidth: 1,
              borderColor: "#1F2937",
              padding: 14,
              borderRadius: 14,
              color: "white",
              backgroundColor: "#111827",
            }}
          />

          {error ? <Text style={{ color: "tomato" }}>{error}</Text> : null}

          <Pressable
            onPress={() => joinByCode(code)}
            disabled={joining}
            style={{
              padding: 16,
              borderRadius: 14,
              backgroundColor: joining ? "#0F172A" : "#1A2430",
              borderWidth: 1,
              borderColor: "#1F2937",
            }}
          >
            <Text style={{ color: "white", fontSize: 16, fontWeight: "700", textAlign: "center" }}>
              {joining ? "Joining..." : "Join league"}
            </Text>
          </Pressable>

          <Pressable onPress={() => router.back()} disabled={joining}>
            <Text style={{ color: "#A7B0BC" }}>Back</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ marginTop: 18, gap: 12 }}>
          {error ? <Text style={{ color: "tomato" }}>{error}</Text> : null}

          <Pressable onPress={() => router.replace("/league")} disabled={joining}>
            <Text style={{ color: "#A7B0BC" }}>Go to leagues</Text>
          </Pressable>

          <Pressable onPress={() => router.back()} disabled={joining}>
            <Text style={{ color: "#A7B0BC" }}>Back</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
