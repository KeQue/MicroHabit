import { ThemedView } from "@/components/themed-view";
import { UserCard } from "@/components/UserCard";
import { getLeagueMembers } from "@/features/leagues/api";
import { supabase } from "@/lib/supabase";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type PlanTier = "A" | "B" | "C";

type Member = {
  id: string; // user_id
  name: string; // handle
  subtitle: string; // activity
  colorLight: string;
  colorDark: string;
  accentActive: string;
  days: boolean[];
  joinedAt?: string;
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

  // modal
  modalOverlay: "rgba(0,0,0,0.55)",
  cardBg: "rgba(18,10,34,0.96)",
  cardBorder: "rgba(255,255,255,0.10)",
  codeBg: "rgba(255,255,255,0.06)",
  success: "rgba(140,255,190,0.92)",
};

// palette (still used per-user)
const PALETTE = [
  { colorLight: "#9AE6B4", colorDark: "#2F855A", accentActive: "#00C853" }, // green
  { colorLight: "#B794F4", colorDark: "#6B46C1", accentActive: "#7C3AED" }, // purple
  { colorLight: "#FEB2B2", colorDark: "#C53030", accentActive: "#EF4444" }, // red
  { colorLight: "#90CDF4", colorDark: "#2B6CB0", accentActive: "#3B82F6" }, // blue
  { colorLight: "#FBD38D", colorDark: "#B7791F", accentActive: "#F59E0B" }, // amber
];
function colorIndexFromUserId(userId: string, paletteSize: number) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return h % paletteSize;
}
function colorsForUserId(userId: string) {
  return PALETTE[colorIndexFromUserId(userId, PALETTE.length)];
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

// count ONLY boolean true
function scoreDays(days: boolean[]) {
  return (days ?? []).reduce((acc, v) => acc + (v === true ? 1 : 0), 0);
}

/**
 * ✅ Edit window rule (MVP):
 * - Allow toggling: today and yesterday only
 * - Block: earlier days, future days
 */
function isEditableDay(dayIndex: number, todayIndex?: number) {
  if (typeof todayIndex !== "number") return false;
  return dayIndex === todayIndex || dayIndex === todayIndex - 1;
}

function PillButton({
  label,
  onPress,
  size = "md",
}: {
  label: string;
  onPress: () => void | Promise<void>;
  size?: "md" | "sm" | "xs";
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pillBtn,
        size === "sm" && styles.pillBtnSm,
        size === "xs" && styles.pillBtnXs,
        pressed && { backgroundColor: UI.pillBgActive },
      ]}
      hitSlop={8}
    >
      <Text
        style={[
          styles.pillBtnText,
          size === "sm" && styles.pillBtnTextSm,
          size === "xs" && styles.pillBtnTextXs,
        ]}
      >
        {label}
      </Text>
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

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayIndex = today.getDate() - 1;
  const monthDays = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month]);

  const [viewMode, setViewMode] = useState<"My View" | "Ranking">("My View");

  const [myId, setMyId] = useState<string>("");
  const [myRole, setMyRole] = useState<string>("member");

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [leagueName, setLeagueName] = useState<string>("League");
  const [leagueActivity, setLeagueActivity] = useState<string>("");
  const [leaguePlanTier, setLeaguePlanTier] = useState<PlanTier | null>(null);

  const [leagueIsFree, setLeagueIsFree] = useState<boolean>(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function onSignOut() {
    await supabase.auth.signOut();
    router.replace("/(auth)/sign-in");
  }

  function buildInviteMessage(code: string) {
    // Canonical template (no links)
    return `Join my MicroHabit league 💪
Invite code: ${code}
Open MicroHabit → Join → Paste the code`;
  }

  function onInvite() {
    setCopied(false);
    setInviteOpen(true);
  }

  function onMenu() {
    setMenuOpen(true);
  }

  async function onCopyCode() {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    setCopied(true);
    // auto-hide the "Copied" hint after a moment
    setTimeout(() => setCopied(false), 1200);
  }

  async function onShareInvite() {
    if (!inviteCode) return;
    const message = buildInviteMessage(inviteCode);
    await Share.share({ message });
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

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userRes.user;
      if (!user) {
        router.replace("/(auth)/sign-in");
        return;
      }
      setMyId(user.id);

      const { data: leagueRow, error: leagueErr } = await supabase
        .from("leagues")
        .select("id,name,activity,plan_tier,is_free,invite_code")
        .eq("id", leagueId)
        .single();
      if (leagueErr) throw leagueErr;

      setLeagueName(leagueRow?.name ?? "League");
      setLeagueActivity(leagueRow?.activity ?? "");
      setLeaguePlanTier((leagueRow?.plan_tier as PlanTier) ?? null);

      setLeagueIsFree(!!leagueRow?.is_free);
      setInviteCode((leagueRow?.invite_code as string) ?? null);

      const rows = await getLeagueMembers(leagueId);

      const me = rows.find((r: any) => r.user_id === user.id);
      setMyRole((me?.role as string) ?? "member");

      const roleRank = (role?: string) => (role === "owner" ? 0 : role === "admin" ? 1 : 2);

      const normalized = rows
        .map((r: any) => {
          return {
            user_id: r.user_id,
            role: r.role,
            display: toHandle(r.display_name),
          };
        })
        .sort((a, b) => {
          const rr = roleRank(a.role) - roleRank(b.role);
          if (rr !== 0) return rr;
          const byDisplay = a.display.localeCompare(b.display);
          if (byDisplay !== 0) return byDisplay;
          return a.user_id.localeCompare(b.user_id);
        });

      const from = toDateOnlyLocal(startOfMonth(new Date(year, month, 1)));
      const to = toDateOnlyLocal(endOfMonth(new Date(year, month, 1)));
      const logs = await fetchMonthLogs(leagueId, from, to);

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

      const nextMembers: Member[] = normalized.map((r) => {
        const c = colorsForUserId(r.user_id);
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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

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
              if (m.days[idx] === value) return m;
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

  useEffect(() => {
    if (!leagueId) return;

    const channel = supabase
      .channel(`league_members_${leagueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "league_members", filter: `league_id=eq.${leagueId}` },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  const membersToRender = useMemo((): Member[] => {
    if (viewMode === "Ranking") {
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

    if (!myId) return members;
    const i = members.findIndex((m) => m.id === myId);
    if (i <= 0) return members;
    const me = members[i];
    return [me, ...members.slice(0, i), ...members.slice(i + 1)];
  }, [members, myId, viewMode]);

  const toggleDayForMember = useCallback(
    async (memberId: string, dayIndex: string | number) => {
      const day = typeof dayIndex === "number" ? dayIndex : Number(dayIndex);

      // only allow self
      if (!myId || memberId !== myId) return;

      // bounds
      if (day < 0 || day >= monthDays) return;

      // no future
      if (day > todayIndex) return;

      // ✅ NEW: only today + yesterday
      if (!isEditableDay(day, todayIndex)) return;

      const d = new Date(year, month, day + 1);
      const log_date = toDateOnlyLocal(d);

      const current = members.find((m) => m.id === myId)?.days?.[day] ?? false;
      const next = !current;

      // optimistic UI
      setMembers((prev) =>
        prev.map((x) =>
          x.id !== memberId ? x : { ...x, days: x.days.map((v, i) => (i === day ? next : v)) }
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

      // revert if failed
      if (error) {
        setMembers((prev) =>
          prev.map((x) =>
            x.id !== memberId
              ? x
              : { ...x, days: x.days.map((v, i) => (i === day ? current : v)) }
          )
        );
      }
    },
    [leagueId, members, monthDays, myId, year, month, todayIndex]
  );

  const showInvite = myRole === "owner" || myRole === "admin" || myRole === "member";

  const inviteMessage = inviteCode ? buildInviteMessage(inviteCode) : "";

  return (
    <ThemedView style={styles.container}>
      <LinearGradient
        colors={[UI.bgTop, UI.bgBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bg}
      >
        {/* INVITE MODAL */}
        <Modal
          visible={inviteOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setInviteOpen(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setInviteOpen(false)}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>Invite code</Text>

              <View style={styles.codeBox}>
                <Text style={styles.codeText}>{inviteCode ?? "—"}</Text>
              </View>

              <Text style={styles.modalMessageLabel}>Message</Text>
              <View style={styles.messageBox}>
                <Text style={styles.messageText}>{inviteMessage}</Text>
              </View>

              {copied ? <Text style={styles.copiedText}>Copied</Text> : <View style={{ height: 18 }} />}

              <View style={styles.modalActions}>
                <PillButton label="Copy code" size="sm" onPress={onCopyCode} />
                <PillButton label="Share" size="sm" onPress={onShareInvite} />
                <PillButton label="Close" size="sm" onPress={() => setInviteOpen(false)} />
              </View>

              {!inviteCode ? (
                <Text style={styles.modalHint}>No invite code found for this league.</Text>
              ) : null}
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={menuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuOpen(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setMenuOpen(false)}>
            <Pressable style={styles.menuCard} onPress={() => {}}>
              <Text style={styles.menuTitle}>Menu</Text>
              <PillButton
                label="Back"
                size="sm"
                onPress={() => {
                  setMenuOpen(false);
                  router.back();
                }}
              />
              <PillButton
                label="Sign out"
                size="sm"
                onPress={async () => {
                  setMenuOpen(false);
                  await onSignOut();
                }}
              />
              <PillButton label="Close" size="sm" onPress={() => setMenuOpen(false)} />
            </Pressable>
          </Pressable>
        </Modal>

        {/* HEADER */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerBar}>
            <View style={styles.headerSide}>
              <PillButton label="☰" onPress={onMenu} />
            </View>

            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {leagueName ? `League: ${leagueName}` : "League"}
              </Text>
            </View>

            <View style={[styles.headerSide, { alignItems: "flex-end" }]}>
              {showInvite ? <PillButton label="Invite" size="sm" onPress={onInvite} /> : null}
            </View>
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
                onToggle={(i) => toggleDayForMember(m.id, i)}
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

  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  headerSide: {
    width: 88,
    alignItems: "flex-start",
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },

  headerTitle: {
    textAlign: "center",
    color: UI.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.2,
    maxWidth: "100%",
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
  pillBtnXs: {
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pillBtnText: { color: UI.text, fontSize: 16, fontWeight: "700" },
  pillBtnTextSm: { fontSize: 14 },
  pillBtnTextXs: { fontSize: 14, fontWeight: "800" },

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

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: UI.modalOverlay,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: UI.cardBorder,
    backgroundColor: UI.cardBg,
    padding: 16,
  },
  modalTitle: {
    color: UI.text,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 12,
  },
  codeBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.codeBg,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  codeText: {
    color: UI.text,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 3,
  },
  modalMessageLabel: {
    marginTop: 14,
    marginBottom: 8,
    color: UI.muted,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  messageBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 12,
  },
  messageText: {
    color: UI.text,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  copiedText: {
    marginTop: 10,
    color: UI.success,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  modalActions: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  modalHint: {
    marginTop: 10,
    color: UI.muted,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  menuCard: {
    width: "100%",
    maxWidth: 280,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: UI.cardBorder,
    backgroundColor: UI.cardBg,
    padding: 16,
    gap: 10,
  },
  menuTitle: {
    color: UI.text,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 4,
  },
});
