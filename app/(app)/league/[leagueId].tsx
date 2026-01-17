import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { UserCard } from "@/components/UserCard";
import { getLeagueMembers } from "@/features/leagues/api";
import { supabase } from "@/lib/supabase";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, View } from "react-native";

const DAYS_IN_MONTH = 31;

type Member = {
  id: string;            // user_id
  name: string;          // profile name/email
  subtitle: string;      // role
  colorLight: string;
  colorDark: string;     // progress bar / theme
  accentActive: string;  // active squares
  days: boolean[];
};

const makeDays = () => Array(DAYS_IN_MONTH).fill(false) as boolean[];

// --- helpers (sorting) ---
function activeDaysCount(days: boolean[]) {
  return days.reduce((acc, v) => acc + (v ? 1 : 0), 0);
}

function sortMembers(members: Member[], myId: string, leagueViewOn: boolean) {
  // OFF = My view: keep original order, only move me to top
  if (!leagueViewOn) {
    const idx = members.findIndex((m) => m.id === myId);
    if (idx <= 0) return members;

    const me = members[idx];
    return [me, ...members.slice(0, idx), ...members.slice(idx + 1)];
  }

  // ON = League view: rank by active days
  return [...members].sort((a, b) => {
    const ad = activeDaysCount(a.days);
    const bd = activeDaysCount(b.days);
    if (bd !== ad) return bd - ad;
    return a.name.localeCompare(b.name);
  });
}

// Simple palette (deterministic by index)
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

function roleRank(role?: string) {
  return role === "owner" ? 0 : role === "admin" ? 1 : 2;
}

export default function LeagueDetailScreen() {
  const params = useLocalSearchParams<{ leagueId: string }>();
  const leagueId = typeof params.leagueId === "string" ? params.leagueId : "";

  const todayIndex = new Date().getDate() - 1;

  const [leagueViewOn, setLeagueViewOn] = useState(false);

  const [myId, setMyId] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!leagueId) return;

    try {
      setError(null);
      setLoading(true);

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userRes.user;
      if (!user) throw new Error("Not authenticated");
      setMyId(user.id);

      const rows = await getLeagueMembers(leagueId);

      // Stable ordering: owner/admin first, then name/email
      const normalized = rows
        .map((r) => {
          const display =
            r.profile?.name ||
            r.profile?.email ||
            "member";

          return {
            user_id: r.user_id,
            role: r.role,
            display: String(display),
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
          subtitle: r.role ? r.role : "member",
          ...c,
          days: makeDays(), // Step 4 will load real days from daily_logs
        };
      });

      setMembers(nextMembers);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load league members");
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

  // Only allow toggling MY squares
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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <ThemedText type="title" style={{ flex: 1 }}>
            League: {leagueId}
          </ThemedText>

          <View style={styles.toggleWrap}>
            <ThemedText style={styles.toggleLabel}>
              {leagueViewOn ? "League view" : "My view"}
            </ThemedText>
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
