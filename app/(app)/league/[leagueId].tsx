import { ThemedView } from "@/components/themed-view";
import { UserCard } from "@/components/UserCard";
import { getLeagueMembers } from "@/features/leagues/api";
import { supabase } from "@/lib/supabase";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Member = {
  id: string; // user_id
  name: string; // handle
  subtitle: string; // activity
  colorLight: string;
  colorDark: string;
  accentActive: string;
  days: boolean[];
};

// palette (still used per-user)
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

function toHandle(s?: string | null) {
  if (!s) return "user";
  const v = String(s).trim();
  const at = v.indexOf("@");
  if (at > 0) return v.slice(0, at);
  return v;
}

function activeDaysCount(days: boolean[]) {
  return days.reduce((acc, v) => acc + (v ? 1 : 0), 0);
}
function sortMembers(members: Member[], myId: string, rankingOn: boolean) {
  if (!rankingOn) {
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

// Date helpers (LOCAL, no timezone bugs)
function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}
function toDateOnlyLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function daysInMonth(d: Date) {
  return endOfMonth(d).getDate();
}

const theme = {
  bg: "#0B0615",
  text: "#EDE7FF",
  muted: "rgba(237,231,255,0.65)",
};

function PillButton({ label, onPress }: { label: string; onPress: () => void | Promise<void> }) {
  return (
    <Pressable onPress={onPress} style={styles.pillBtn}>
      <Text style={styles.pillBtnText}>{label}</Text>
    </Pressable>
  );
}

function Segmented({
  value,
  onChange,
}: {
  value: "My View" | "Ranking";
  onChange: (v: "My View" | "Ranking") => void;
}) {
  return (
    <View style={styles.segmentWrap}>
      {(["My View", "Ranking"] as const).map((k) => {
        const active = value === k;
        return (
          <Pressable
            key={k}
            onPress={() => onChange(k)}
            style={[styles.segmentBtn, active && styles.segmentBtnActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{k}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function LeagueDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ leagueId: string }>();
  const leagueId = typeof params.leagueId === "string" ? params.leagueId : "";

  // ✅ stable month primitives (avoid realtime re-subscribe loops)
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayIndex = today.getDate() - 1;
  const monthDays = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month]);

  const [viewMode, setViewMode] = useState<"My View" | "Ranking">("My View");

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

  async function fetchMonthLogs(league_id: string, from: string, to: string) {
    const { data, error } = await supabase
      .from("daily_logs")
      .select("league_id,user_id,log_date,completed")
      .eq("league_id", league_id)
      .gte("log_date", from)
      .lte("log_date", to);

    if (error) throw error;
    return data ?? [];
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

      // league meta
      const { data: leagueRow, error: leagueErr } = await supabase
        .from("leagues")
        .select("id,name,activity")
        .eq("id", leagueId)
        .single();
      if (leagueErr) throw leagueErr;

      setLeagueName(leagueRow?.name ?? "League");
      setLeagueActivity(leagueRow?.activity ?? "");

      // members list
      const rows = await getLeagueMembers(leagueId);

      const roleRank = (role?: string) => (role === "owner" ? 0 : role === "admin" ? 1 : 2);

      const normalized = rows
        .map((r: any) => {
          const raw = r.profile?.username || r.profile?.name || r.profile?.email || "user";
          return { user_id: r.user_id, role: r.role, display: toHandle(raw) };
        })
        .sort((a, b) => {
          const rr = roleRank(a.role) - roleRank(b.role);
          if (rr !== 0) return rr;
          return a.display.localeCompare(b.display);
        });

      // logs for this month
      const from = toDateOnlyLocal(startOfMonth(new Date(year, month, 1)));
      const to = toDateOnlyLocal(endOfMonth(new Date(year, month, 1)));
      const logs = await fetchMonthLogs(leagueId, from, to);

      // build map: user_id -> boolean[monthDays]
      const daysByUser = new Map<string, boolean[]>();
      for (const m of normalized) {
        daysByUser.set(m.user_id, Array(monthDays).fill(false));
      }

      for (const row of logs as any[]) {
        const uid = row.user_id as string;
        const arr = daysByUser.get(uid);
        if (!arr) continue;

        const d = new Date(row.log_date + "T00:00:00");
        const idx = d.getDate() - 1;
        if (idx < 0 || idx >= arr.length) continue;

        arr[idx] = !!row.completed;
      }

      const nextMembers: Member[] = normalized.map((r, idx) => {
        const c = colorsForIndex(idx);
        return {
          id: r.user_id,
          name: r.display,
          subtitle: leagueRow?.activity ?? "",
          ...c,
          days: daysByUser.get(r.user_id) ?? Array(monthDays).fill(false),
        };
      });

      setMembers(nextMembers);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load league");
    } finally {
      setLoading(false);
    }
  }

  // initial load
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  // ✅ Realtime: apply updates WITHOUT calling load() (prevents "refresh" on every tap)
  useEffect(() => {
    if (!leagueId) return;

    const channel = supabase
      .channel(`daily_logs_${leagueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_logs", filter: `league_id=eq.${leagueId}` },
        (payload: any) => {
          const row = payload?.new ?? payload?.old;
          if (!row) return;

          // Ignore my own writes (this phone already updates optimistically)
          if (myId && row.user_id === myId) return;

          const d = new Date(row.log_date + "T00:00:00");
          if (d.getFullYear() !== year || d.getMonth() !== month) return;

          const idx = d.getDate() - 1;
          if (idx < 0 || idx >= monthDays) return;

          const value = !!row.completed;

          setMembers((prev) =>
            prev.map((m) => {
              if (m.id !== row.user_id) return m;
              const nextDays = m.days.slice();
              nextDays[idx] = value;
              return { ...m, days: nextDays };
            })
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leagueId, myId, year, month, monthDays]);

  const orderedMembers = useMemo(() => {
    if (!myId) return members;
    const rankingOn = viewMode === "Ranking";
    return sortMembers(members, myId, rankingOn);
  }, [members, myId, viewMode]);

  const toggleDayForMember = useCallback(
    async (memberId: string, dayIndex: number) => {
      if (!myId || memberId !== myId) return;
      if (dayIndex < 0 || dayIndex >= monthDays) return;

      // Build the date for this dayIndex in current month (stable year/month)
      const d = new Date(year, month, dayIndex + 1);
      const log_date = toDateOnlyLocal(d);

      // Next value based on current state
      const current = members.find((m) => m.id === myId)?.days?.[dayIndex] ?? false;
      const next = !current;

      // Optimistic UI
      setMembers((prev) =>
        prev.map((x) =>
          x.id !== memberId
            ? x
            : {
                ...x,
                days: x.days.map((v, i) => (i === dayIndex ? next : v)),
              }
        )
      );

      const { error } = await supabase.from("daily_logs").upsert(
        {
          league_id: leagueId,
          user_id: myId,
          log_date,
          completed: next,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "league_id,user_id,log_date" }
      );

      if (error) {
        // rollback
        setMembers((prev) =>
          prev.map((x) =>
            x.id !== memberId
              ? x
              : {
                  ...x,
                  days: x.days.map((v, i) => (i === dayIndex ? current : v)),
                }
          )
        );
      }
    },
    [leagueId, members, monthDays, myId, year, month]
  );

  return (
    <ThemedView style={styles.container}>
      <LinearGradient
        colors={["#07030F", "#160A2D"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 18 }]}
      >
        <View style={styles.headerRow}>
          <PillButton label="Back" onPress={() => router.back()} />

          <Text style={styles.headerTitle} numberOfLines={1}>
            {leagueName ? `League: ${leagueName}` : "League"}
          </Text>

          <PillButton label="Sign out" onPress={onSignOut} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.activityText} numberOfLines={1}>
              {leagueActivity || " "}
            </Text>
          </View>

          <Segmented value={viewMode} onChange={setViewMode} />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {loading ? (
          <View style={{ paddingTop: 18 }}>
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
              disabled={!!myId && m.id !== myId}
              onToggle={(dayIndex) => toggleDayForMember(m.id, dayIndex)}
            />
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: theme.text,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  pillBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(162,89,255,0.65)",
    backgroundColor: "rgba(162,89,255,0.10)",
  },
  pillBtnText: { color: theme.text, fontSize: 16, fontWeight: "700" },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14, paddingBottom: 32 },

  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 2 },
  activityText: { color: theme.muted, fontSize: 16, fontWeight: "600" },

  segmentWrap: {
    flexDirection: "row",
    borderRadius: 999,
    padding: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  segmentBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 },
  segmentBtnActive: { backgroundColor: "rgba(162,89,255,0.35)" },
  segmentText: { color: "rgba(237,231,255,0.65)", fontWeight: "700", fontSize: 14 },
  segmentTextActive: { color: theme.text },

  errorText: { color: "rgba(255,120,120,0.9)", fontSize: 14, fontWeight: "600" },
});
