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

// ---------- UI THEME (local to this screen) ----------
const UI = {
  bgTop: "#07030F",
  bgBottom: "#160A2D",

  text: "#EDE7FF",
  muted: "rgba(237,231,255,0.65)",
  border: "rgba(255,255,255,0.08)",

  pillBorder: "rgba(162,89,255,0.55)",
  pillBg: "rgba(162,89,255,0.10)",
  pillBgActive: "rgba(162,89,255,0.18)",

  segmentBg: "rgba(255,255,255,0.06)",
  segmentBorder: "rgba(255,255,255,0.10)",
  segmentActiveBg: "rgba(162,89,255,0.22)",
  segmentActiveBorder: "rgba(162,89,255,0.55)",

  error: "rgba(255,120,120,0.9)",
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

// ✅ EXACT same scoring logic as UserCard UI count
// IMPORTANT: count ONLY boolean true (avoids weird truthy values breaking ranking)
function scoreDays(days: boolean[]) {
  return (days ?? []).reduce((acc, v) => acc + (v === true ? 1 : 0), 0);
}

function PillButton({
  label,
  onPress,
  size = "md",
}: {
  label: string;
  onPress: () => void | Promise<void>;
  size?: "md" | "sm";
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pillBtn,
        size === "sm" && styles.pillBtnSm,
        pressed && { backgroundColor: UI.pillBgActive },
      ]}
      hitSlop={8}
    >
      <Text style={[styles.pillBtnText, size === "sm" && styles.pillBtnTextSm]}>{label}</Text>
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
            style={({ pressed }) => [
              styles.segmentBtn,
              active && styles.segmentBtnActive,
              pressed && !active && { opacity: 0.9 },
            ]}
            hitSlop={6}
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

  // ✅ stable month primitives
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

  // ✅ Realtime: apply updates (including mine), but skip exact no-ops
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

          const d = new Date(row.log_date + "T00:00:00");
          if (d.getFullYear() !== year || d.getMonth() !== month) return;

          const idx = d.getDate() - 1;
          if (idx < 0 || idx >= monthDays) return;

          const value = !!row.completed;

          setMembers((prev) =>
            prev.map((m) => {
              if (m.id !== row.user_id) return m;
              if (m.days[idx] === value) return m; // ✅ no-op guard
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
  }, [leagueId, year, month, monthDays]);

  // ✅ SINGLE source of truth for render order
  const membersToRender = useMemo((): Member[] => {
    if (viewMode === "Ranking") {
      // sort using same count logic as the UI
      return [...members]
        .map((m) => ({ m, s: scoreDays(m.days) }))
        .sort((a, b) => {
          if (b.s !== a.s) return b.s - a.s;
          const n = a.m.name.localeCompare(b.m.name);
          if (n !== 0) return n;
          return a.m.id.localeCompare(b.m.id);
        })
        .map((x) => x.m);
    }

    // My View: pin me on top (only if myId exists)
    if (!myId) return members;
    const i = members.findIndex((m) => m.id === myId);
    if (i <= 0) return members;
    const me = members[i];
    return [me, ...members.slice(0, i), ...members.slice(i + 1)];
  }, [members, myId, viewMode]);

  const toggleDayForMember = useCallback(
    async (memberId: string, dayIndex: number) => {
      if (!myId || memberId !== myId) return;
      if (dayIndex < 0 || dayIndex >= monthDays) return;

      // ✅ block future days
      if (todayIndex !== undefined && dayIndex > todayIndex) return;

      const d = new Date(year, month, dayIndex + 1);
      const log_date = toDateOnlyLocal(d);

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
    [leagueId, members, monthDays, myId, year, month, todayIndex]
  );

  return (
    <ThemedView style={styles.container}>
      <LinearGradient
        colors={[UI.bgTop, UI.bgBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bg}
      >
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <View style={styles.headerRow}>
            <PillButton label="Back" onPress={() => router.back()} />

            <Text style={styles.headerTitle} numberOfLines={1}>
              {leagueName ? `League: ${leagueName}` : "League"}
            </Text>

            <PillButton label="Sign out" size="sm" onPress={onSignOut} />
          </View>
        </View>

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
            membersToRender.map((m, idx) => (
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
                showRank={viewMode === "Ranking"}
                rank={idx + 1}
              />
            ))
          )}
        </ScrollView>
      </LinearGradient>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  bg: { flex: 1 },

  header: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: UI.border,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: UI.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  pillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: UI.pillBorder,
    backgroundColor: UI.pillBg,
  },
  pillBtnSm: {
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pillBtnText: { color: UI.text, fontSize: 16, fontWeight: "700" },
  pillBtnTextSm: { fontSize: 14 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14, paddingBottom: 32 },

  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 2 },
  activityText: { color: UI.muted, fontSize: 16, fontWeight: "600" },

  segmentWrap: {
    flexDirection: "row",
    borderRadius: 999,
    padding: 3,
    backgroundColor: UI.segmentBg,
    borderWidth: 1,
    borderColor: UI.segmentBorder,
  },
  segmentBtn: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999 },
  segmentBtnActive: {
    backgroundColor: UI.segmentActiveBg,
    borderWidth: 1,
    borderColor: UI.segmentActiveBorder,
  },
  segmentText: { color: UI.muted, fontWeight: "700", fontSize: 14 },
  segmentTextActive: { color: UI.text },

  errorText: { color: UI.error, fontSize: 14, fontWeight: "600" },
});
