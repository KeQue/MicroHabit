import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { UserCard } from "@/components/UserCard";
import { getLeagueMembers } from "@/features/leagues/api";
import { supabase } from "@/lib/supabase";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

const DAYS_IN_MONTH = 31;

type Member = {
  id: string; // user_id
  name: string; // username (short)
  subtitle: string; // activity (same for all)
  colorLight: string;
  colorDark: string;
  accentActive: string;
  days: boolean[];
};

const makeDays = () => Array(DAYS_IN_MONTH).fill(false) as boolean[];

// --- helpers (sorting) ---
function activeDaysCount(days: boolean[]) {
  return days.reduce((acc, v) => acc + (v ? 1 : 0), 0);
}

function sortMembers(members: Member[], myId: string, leagueViewOn: boolean) {
  if (!leagueViewOn) {
    const idx = members.findIndex((m) => m.id === myId);
    if (idx <= 0) return members;
    const me = members[idx];
    return [me, ...members.slice(0, idx), ...members.slice(idx + 1)];
  }

  return [...members].sort((a, b) => {
    const ad = activeDaysCount(a.days);
    const bd = activeDaysCount(b.days);
    if (bd !== ad) return bd - ad;
    return a.name.localeCompare(b.name);
  });
}

// palette
const PALETTE = [
  { colorLight: "#9AE6B4", colorDark: "#2F855A", accentActive: "#00C853" }, // green
  { colorLight: "#B794F4", colorDark: "#6B46C1", accentActive: "#7C3AED" }, // purple
  { colorLight: "#FEB2B2", colorDark: "#C53030", accentActive: "#EF4444" }, // red
  { colorLight: "#90CDF4", colorDark: "#2B6CB0", accentActive: "#3B82F6" }, // blue
  { colorLight: "#FBD38D", colorDark: "#B7791F", accentActive: "#F59E0B" }, // amber
];

function colorsForIndex(i: number) {
  return PALETTE[i % PALETTE.length];
}

// email -> short handle
function toHandle(s?: string | null) {
  if (!s) return "user";
  const v = String(s).trim();
  const at = v.indexOf("@");
  if (at > 0) return v.slice(0, at);
  return v;
}

export default function LeagueDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ leagueId: string }>();
  const leagueId = typeof params.leagueId === "string" ? params.leagueId : "";

  const todayIndex = new Date().getDate() - 1;

  const [leagueViewOn, setLeagueViewOn] = useState(false);

  const [myId, setMyId] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [leagueName, setLeagueName] = useState<string>("League");
  const [leagueActivity, setLeagueActivity] = useState<string>("");

  async function onSignOut() {
    await supabase.auth.signOut();
    router.replace("/(auth)/sign-in");
  }

  async function load() {
    if (!leagueId) return;

    try {
      setError(null);
      setLoading(true);

      // auth
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userRes.user;
      if (!user) {
        router.replace("/(auth)/sign-in");
        return;
      }
      setMyId(user.id);

      // fetch league meta so header shows name + activity
      const { data: leagueRow, error: leagueErr } = await supabase
        .from("leagues")
        .select("id,name,activity")
        .eq("id", leagueId)
        .single();

      if (leagueErr) throw leagueErr;

      setLeagueName(leagueRow?.name ?? "League");
      setLeagueActivity(leagueRow?.activity ?? "");

      // members
      const rows = await getLeagueMembers(leagueId);

      const roleRank = (role?: string) => (role === "owner" ? 0 : role === "admin" ? 1 : 2);

      const normalized = rows
        .map((r: any) => {
          const raw = r.profile?.username || r.profile?.name || r.profile?.email || "user";
          return {
            user_id: r.user_id,
            role: r.role,
            display: toHandle(raw),
          };
        })
        .sort((a, b) => {
          const rr = roleRank(a.role) - roleRank(b.role);
          if (rr !== 0) return rr;
          return a.display.localeCompare(b.display);
        });

      const nextMembers: Member[] = normalized.map((r, idx) => {
        const c = colorsForIndex(idx);
        return {
          id: r.user_id,
          name: r.display,
          subtitle: leagueRow?.activity ?? "",
          ...c,
          days: makeDays(), // later: replace with real daily_logs
        };
      });

      setMembers(nextMembers);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load league");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  const orderedMembers = useMemo(() => {
    if (!myId) return members;
    return sortMembers(members, myId, leagueViewOn);
  }, [members, myId, leagueViewOn]);

  // only allow toggling MY squares
  const toggleDayForMember = useCallback(
    (memberId: string, dayIndex: number) => {
      if (!myId || memberId !== myId) return;

      setMembers((prev) =>
        prev.map((x) =>
          x.id !== memberId
            ? x
            : {
                ...x,
                days: x.days.map((v, i) => (i === dayIndex ? !v : v)),
              }
        )
      );
    },
    [myId]
  );

  return (
    <ThemedView style={styles.container}>
      {/* B) Native header: add Sign out to headerRight */}
      <Stack.Screen
        options={{
          headerShown: true,
          title: leagueName ? `League: ${leagueName}` : "League",
          headerTitleStyle: { fontSize: 18 },
          headerTitleAlign: "left",
          headerBackTitle: "Back",
          headerRight: () => (
            <Pressable onPress={onSignOut} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ fontSize: 16 }}>Sign out</Text>
            </Pressable>
          ),
        }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* C) Removed in-page Sign out; keep only activity + toggle */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            {leagueActivity ? (
              <ThemedText style={{ opacity: 0.7 }} numberOfLines={1}>
                {leagueActivity}
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.toggleWrap}>
            <ThemedText style={styles.toggleLabel}>{leagueViewOn ? "League" : "My"}</ThemedText>
            <Switch value={leagueViewOn} onValueChange={setLeagueViewOn} />
          </View>
        </View>

        {error ? <ThemedText style={{ opacity: 0.8 }}>{error}</ThemedText> : null}

        {loading ? (
          <View style={{ paddingTop: 16 }}>
            <ActivityIndicator />
          </View>
        ) : (
          orderedMembers.map((m) => (
            <UserCard
              key={m.id}
              name={m.name}
              subtitle={m.subtitle}
              days={m.days}
              colorDark={m.colorDark}
              accentActive={m.accentActive}
              todayIndex={todayIndex}
              disabled={m.id !== myId}
              onToggle={(dayIndex) => toggleDayForMember(m.id, dayIndex)}
            />
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 4,
  },
  toggleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  toggleLabel: {
    fontSize: 12,
    opacity: 0.8,
  },
});
