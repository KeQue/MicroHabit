import { supabase } from "@/lib/supabase";
import { useAuth } from "@/features/auth/useAuth";
import { normalizeInviteCode } from "@/features/invitations/invite";
import { runFreeJoin, StaleJoinAttempt } from "@/features/invitations/join-attempt";
import { usePendingInvite } from "@/features/invitations/pending-invite";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

type LeagueInfo = { id: string; name: string | null; activity: string | null; is_free: boolean | null };

export default function JoinLeagueScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { pending, clear } = usePendingInvite();
  const params = useLocalSearchParams<{ code?: string | string[]; inviteNonce?: string }>();
  const rawCode = params.code;
  const routeKey = JSON.stringify([rawCode ?? null, params.inviteNonce ?? null, user?.id ?? null]);
  const identity = useRef({ routeKey, userId: user?.id, pendingNonce: pending?.nonce });
  identity.current = { routeKey, userId: user?.id, pendingNonce: pending?.nonce };
  const generation = useRef(0);
  const busy = useRef(false);
  const mounted = useRef(true);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leagueInfo, setLeagueInfo] = useState<LeagueInfo | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current += 1; };
  }, []);
  useEffect(() => {
    generation.current += 1;
    busy.current = false;
    setLoading(false);
    setLeagueInfo(null);
    setPreviewKey(null);
    try {
      setCode(rawCode === undefined ? "" : normalizeInviteCode(rawCode));
      setError(null);
    } catch {
      setCode("");
      setError("This invitation is invalid. Ask your friend for the invite code.");
    }
    // routeKey includes every value that should invalidate a previous attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  async function joinByCode() {
    if (busy.current) return;
    let normalized: string;
    try { normalized = normalizeInviteCode(code); }
    catch { setError("Enter a valid invite code."); return; }
    const uid = user?.id;
    if (!uid) { setError("Sign in before joining this league."); return; }
    const attempt = ++generation.current;
    const capturedRoute = routeKey;
    const capturedPending = pending?.code === normalized && pending.userId === uid ? pending.nonce : undefined;
    const current = () => mounted.current && attempt === generation.current &&
      identity.current.routeKey === capturedRoute && identity.current.userId === uid &&
      (!capturedPending || identity.current.pendingNonce === capturedPending);
    busy.current = true;
    setLoading(true);
    setError(null);
    setLeagueInfo(null);
    try {
      const info = await runFreeJoin<LeagueInfo>({
        userId: uid, code: normalized, isCurrent: current,
        session: async () => {
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          if (!data.session) throw new Error("Sign in again before joining this league.");
          return { userId: data.session.user.id, accessToken: data.session.access_token, email: data.session.user.email ?? null };
        },
        ensureProfile: async (session) => {
          const { error: profileError } = await supabase.from("profiles")
            .upsert({ id: session.userId, email: session.email }, { onConflict: "id" })
            .setHeader("Authorization", `Bearer ${session.accessToken}`);
          if (profileError) throw profileError;
        },
        join: async (inviteCode, session) => {
          const { data, error: joinError } = await supabase.rpc("join_league_by_code", { p_code: inviteCode })
            .setHeader("Authorization", `Bearer ${session.accessToken}`);
          if (joinError) throw joinError;
          return data;
        },
        readLeague: async (id, session) => {
          const { data, error: readError } = await supabase.from("leagues")
            .select("id,name,activity,is_free").eq("id", id).single()
            .setHeader("Authorization", `Bearer ${session.accessToken}`);
          if (readError) throw readError;
          return data as LeagueInfo;
        },
      });
      if (!current()) return;
      setLeagueInfo(info);
      setPreviewKey(capturedRoute);
      // A late completion must never remove a newer invitation.
      if (capturedPending) await clear(capturedPending);
    } catch (e: unknown) {
      if (!current() || e instanceof StaleJoinAttempt) return;
      const message = e && typeof e === "object" && "message" in e ? String(e.message) : "Could not join this league. Try again.";
      setError(message.includes("invalid_invite_code") ? "Invalid invite code. Check it and try again." :
        /payment_required|paid/i.test(message) ? "This version supports free leagues only." : message);
    } finally {
      if (mounted.current && attempt === generation.current && identity.current.routeKey === capturedRoute) {
        busy.current = false;
        setLoading(false);
      }
    }
  }

  async function goBack() {
    const leavingRoute = routeKey;
    const nonce = pending?.code === code && pending.userId === user?.id ? pending.nonce : undefined;
    generation.current += 1;
    if (nonce) await clear(nonce);
    if (!mounted.current || identity.current.routeKey !== leavingRoute) return;
    if (router.canGoBack()) router.back();
    else router.replace("/(app)");
  }

  const preview = previewKey === routeKey ? leagueInfo : null;
  return (
    <View style={{ flex: 1, padding: 20, paddingTop: 70, backgroundColor: "#0B0F14" }}>
      <Text style={{ fontSize: 28, fontWeight: "700", color: "white" }}>Join league</Text>
      <Text style={{ marginTop: 8, fontSize: 16, color: "#A7B0BC" }}>Paste an invite code to join a free league.</Text>
      {loading && <View style={{ marginTop: 14 }}><ActivityIndicator /></View>}
      {preview ? (
        <View style={{ marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: "#111827", borderWidth: 1, borderColor: "#1F2937", gap: 8 }}>
          <Text style={{ color: "white", fontSize: 16, fontWeight: "800" }}>{preview.name ?? "League"}</Text>
          {preview.activity ? <Text style={{ color: "#A7B0BC" }}>{preview.activity}</Text> : null}
          <Text style={{ color: "#A7B0BC" }}>Free league</Text>
          <Text style={{ color: "#A7B0BC" }}>You can continue.</Text>
          <Pressable disabled={loading} accessibilityRole="button" accessibilityLabel="Continue to league"
            onPress={() => { if (identity.current.routeKey === previewKey && !busy.current) router.replace(`/league/${preview.id}`); }}
            style={{ marginTop: 8, padding: 14, borderRadius: 12, backgroundColor: "#1A2430", borderWidth: 1, borderColor: "#1F2937" }}>
            <Text style={{ color: "white", fontSize: 16, fontWeight: "700", textAlign: "center" }}>Continue to league</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ marginTop: 18, gap: 12 }}>
          <TextInput value={code} onChangeText={(text) => { generation.current += 1; setCode(text.toUpperCase()); setError(null); }}
            placeholder="Invite code" placeholderTextColor="#6B7280" autoCapitalize="characters" autoCorrect={false}
            maxLength={64} editable={!loading} accessibilityLabel="Invite code"
            style={{ borderWidth: 1, borderColor: "#1F2937", padding: 14, borderRadius: 14, color: "white", backgroundColor: "#111827", letterSpacing: 2, fontWeight: "700" }} />
          {error ? <Text style={{ color: "tomato" }} accessibilityRole="alert">{error}</Text> : null}
          <Pressable onPress={joinByCode} disabled={loading || !user} accessibilityRole="button" accessibilityLabel="Join league"
            accessibilityState={{ disabled: loading || !user }}
            style={{ padding: 16, borderRadius: 14, backgroundColor: loading ? "#0F172A" : "#1A2430", borderWidth: 1, borderColor: "#1F2937" }}>
            <Text style={{ color: "white", fontSize: 16, fontWeight: "700", textAlign: "center" }}>{loading ? "Joining..." : "Join league"}</Text>
          </Pressable>
        </View>
      )}
      <Pressable onPress={goBack} disabled={loading} accessibilityRole="button" accessibilityLabel="Go back" style={{ marginTop: 18 }}>
        <Text style={{ color: "#A7B0BC" }}>Back</Text>
      </Pressable>
    </View>
  );
}
