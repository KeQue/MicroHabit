import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

export default function JoinLeagueScreen() {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onJoin() {
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Invite code is required");
      return;
    }

    try {
      setError(null);
      setJoining(true);

      const { data: leagueId, error: rpcErr } = await supabase.rpc(
        "join_league_by_code",
        { p_code: trimmed }
      );

      if (rpcErr) {
        // normalize common error
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

  return (
    <View style={{ flex: 1, padding: 20, paddingTop: 70, backgroundColor: "#0B0F14" }}>
      <Text style={{ fontSize: 28, fontWeight: "700", color: "white" }}>
        Join league
      </Text>

      <Text style={{ marginTop: 8, fontSize: 16, color: "#A7B0BC" }}>
        Paste an invite code to join a league.
      </Text>

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
          onPress={onJoin}
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
    </View>
  );
}
