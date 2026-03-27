import { Ionicons } from "@expo/vector-icons";
import { ThemedView } from "@/components/themed-view";
import { UserCard } from "@/components/UserCard";
import { trackEvent } from "@/features/analytics";
import { getMyProfile, updateMyProfile } from "@/features/auth/profile";
import { useAuth } from "@/features/auth/useAuth";
import { getLeagueMembers } from "@/features/leagues/api";
import { scheduleGentleTestNotification } from "@/features/notifications/local";
import { supabase } from "@/lib/supabase";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type PlanTier = "A" | "B" | "C";

type Member = {
  id: string; // user_id
  name: string; // handle
  subtitle?: string; // optional per-card meta
  colorLight: string;
  colorDark: string;
  accentActive: string;
  days: boolean[];
  joinedAt?: string;
};

type RenderedMember = {
  member: Member;
  rank?: number;
  rivalLabel?: string;
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

function buildLeagueColorMap(userIds: string[]) {
  const available = PALETTE.map((_, idx) => idx);
  const assigned = new Map<string, number>();

  const sortedIds = [...userIds].sort((a, b) => a.localeCompare(b));

  for (const userId of sortedIds) {
    const preferred = colorIndexFromUserId(userId, PALETTE.length);
    const preferredIdx = available.indexOf(preferred);

    if (preferredIdx >= 0) {
      assigned.set(userId, preferred);
      available.splice(preferredIdx, 1);
      continue;
    }

    if (available.length > 0) {
      const fallback = available.shift()!;
      assigned.set(userId, fallback);
      continue;
    }

    assigned.set(userId, preferred);
  }

  return assigned;
}

function toHandle(s?: string | null) {
  if (!s) return "user";
  const v = String(s).trim();
  const at = v.indexOf("@");
  if (at > 0) return v.slice(0, at);
  return v;
}

function emojiForActivity(activity?: string | null) {
  const value = String(activity ?? "").toLowerCase();
  if (value.includes("gym") || value.includes("lift") || value.includes("workout")) return "\u{1F4AA}";
  if (value.includes("run") || value.includes("cardio")) return "\u{1F3C3}";
  if (value.includes("bike") || value.includes("cycle")) return "\u{1F6B4}";
  if (value.includes("walk") || value.includes("steps")) return "\u{1F6B6}";
  if (value.includes("read") || value.includes("book")) return "\u{1F4DA}";
  if (value.includes("yoga") || value.includes("mobility") || value.includes("stretch")) return "\u{1F9D8}";
  if (value.includes("swim")) return "\u{1F3CA}";
  return "\u2728";
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

function buildProjectionMessage(
  activeDays: number,
  elapsedDays: number,
  monthDays: number,
  options?: { isFreeLeague?: boolean }
) {
  if (activeDays <= 0) {
    return `A first check-in today gets your month moving`;
  }

  const projectedTotal = Math.min(
    monthDays,
    Math.max(activeDays, Math.round((activeDays / elapsedDays) * monthDays))
  );

  if (elapsedDays >= 25) {
    if (options?.isFreeLeague) {
      return `You're finishing strong. Keep this momentum going into next month`;
    }

    return `You're finishing strong. You're on pace for ${projectedTotal} check-ins this month`;
  }

  if (elapsedDays >= 21) {
    return `3 weeks in: keep this up and you could finish with ${projectedTotal} check-ins`;
  }

  if (elapsedDays >= 14) {
    return `2 weeks in: you're on pace for ${projectedTotal} check-ins this month`;
  }

  return `1 week in: you're on pace for ${projectedTotal} check-ins this month`;
}

function shouldShowProjectionMessage(elapsedDays: number) {
  return elapsedDays === 7 || elapsedDays === 14 || elapsedDays === 21 || elapsedDays >= 25;
}

/**
 * âœ… Edit window rule (MVP):
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
  tone = "default",
}: {
  label: string;
  onPress: () => void | Promise<void>;
  size?: "md" | "sm" | "xs";
  tone?: "default" | "destructive" | "ghost";
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pillBtn,
        tone === "destructive" && styles.pillBtnDestructive,
        tone === "ghost" && styles.pillBtnGhost,
        size === "sm" && styles.pillBtnSm,
        size === "xs" && styles.pillBtnXs,
        pressed &&
          (tone === "destructive"
            ? { backgroundColor: "rgba(255,120,120,0.18)" }
            : tone === "ghost"
              ? { backgroundColor: "rgba(255,255,255,0.07)" }
              : { backgroundColor: UI.pillBgActive }),
      ]}
      hitSlop={8}
    >
      <Text
        style={[
          styles.pillBtnText,
          tone === "destructive" && styles.pillBtnTextDestructive,
          tone === "ghost" && styles.pillBtnTextGhost,
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
  compact = false,
}: {
  value: "My View" | "Ranking";
  onChange: (v: "My View" | "Ranking") => void;
  compact?: boolean;
}) {
  const thumbAnim = useRef(new Animated.Value(value === "Ranking" ? 1 : 0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    Animated.spring(thumbAnim, {
      toValue: value === "Ranking" ? 1 : 0,
      damping: 18,
      stiffness: 220,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [thumbAnim, value]);

  const thumbWidth = trackWidth > 6 ? (trackWidth - 6) / 2 : 0;
  const thumbTranslateX = thumbAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, thumbWidth],
  });

  return (
    <View
      style={[styles.segmentWrap, compact && styles.segmentWrapCompact]}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      {thumbWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.segmentThumb,
            {
              width: thumbWidth,
              transform: [{ translateX: thumbTranslateX }],
            },
          ]}
        />
      ) : null}
      {(["My View", "Ranking"] as const).map((k) => {
        const active = value === k;
        return (
          <Pressable
            key={k}
            onPress={() => onChange(k)}
            style={({ pressed }) => [
              styles.segmentBtn,
              compact && styles.segmentBtnCompact,
              pressed && !active && { opacity: 0.9 },
            ]}
            hitSlop={6}
          >
            <Text
              style={[
                styles.segmentText,
                compact && styles.segmentTextCompact,
                active && styles.segmentTextActive,
              ]}
            >
              {k}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ModalActionButton({
  label,
  onPress,
  tone = "secondary",
}: {
  label: string;
  onPress: () => void | Promise<void>;
  tone?: "primary" | "secondary";
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.modalActionBtn,
        tone === "primary" ? styles.modalActionBtnPrimary : styles.modalActionBtnSecondary,
        pressed && (tone === "primary" ? styles.modalActionBtnPrimaryPressed : styles.modalActionBtnPressed),
      ]}
    >
      <Text
        style={[
          styles.modalActionBtnText,
          tone === "primary"
            ? styles.modalActionBtnTextPrimary
            : styles.modalActionBtnTextSecondary,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MemberCardSkeleton() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonHeader}>
        <View style={styles.skeletonName} />
        <View style={styles.skeletonCount} />
      </View>
      <View style={styles.skeletonBarTrack}>
        <View style={styles.skeletonBarFill} />
      </View>
      <View style={styles.skeletonSub} />
      <View style={styles.skeletonGrid}>
        {Array.from({ length: 16 }).map((_, idx) => (
          <View key={idx} style={styles.skeletonTile} />
        ))}
      </View>
      <View style={styles.skeletonStreak} />
    </View>
  );
}

export default function LeagueDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { deleteAccount } = useAuth();
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [leagueName, setLeagueName] = useState<string>("League");
  const [leagueActivity, setLeagueActivity] = useState<string>("");
  const [leaguePlanTier, setLeaguePlanTier] = useState<PlanTier | null>(null);
  const [leagueIsFree, setLeagueIsFree] = useState<boolean>(false);
  const [leagueStatus, setLeagueStatus] = useState<string>("active");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [myPaymentStatus, setMyPaymentStatus] = useState<string>("free");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const listAnim = useRef(new Animated.Value(1)).current;

  async function onSignOut() {
    await supabase.auth.signOut();
    router.replace("/(auth)/sign-in");
  }

  function buildInviteMessage(code: string) {
    return `Join my Commito league
Invite code: ${code}
Install Commito, tap Join, and enter the code.`;
  }

  function onInvite() {
    setCopied(false);
    setInviteOpen(true);
  }

  function onMenu() {
    setMenuOpen(true);
  }

  async function openEditName() {
    try {
      setNameError(null);
      const profile = await getMyProfile();
      setDisplayNameInput(profile?.name?.trim() || profile?.username?.trim() || "");
      setEditNameOpen(true);
    } catch (e: any) {
      setNameError(e?.message ?? "Could not load your profile");
      setEditNameOpen(true);
    }
  }

  async function onSaveDisplayName() {
    const trimmedName = displayNameInput.trim();
    if (!trimmedName) {
      setNameError("Please enter a display name");
      return;
    }

    try {
      setSavingName(true);
      setNameError(null);
      await updateMyProfile({ name: trimmedName });
      await load();
      setEditNameOpen(false);
    } catch (e: any) {
      setNameError(e?.message ?? "Could not update your name");
    } finally {
      setSavingName(false);
    }
  }

  async function onDeleteAccount() {
    try {
      setDeletingAccount(true);
      setDeleteAccountError(null);
      await deleteAccount();
      setDeleteAccountOpen(false);
      router.replace("/(auth)/sign-in");
    } catch (e: any) {
      setDeleteAccountError(e?.message ?? "Could not delete account");
    } finally {
      setDeletingAccount(false);
    }
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

  const load = useCallback(async () => {
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
        .select("id,name,activity,plan_tier,is_free,status,invite_code")
        .eq("id", leagueId)
        .single();
      if (leagueErr) throw leagueErr;

      setLeagueName(leagueRow?.name ?? "League");
      setLeagueActivity(leagueRow?.activity ?? "");
      setLeaguePlanTier((leagueRow?.plan_tier as PlanTier) ?? null);
      setLeagueIsFree(!!leagueRow?.is_free);
      setLeagueStatus((leagueRow?.status as string) ?? "active");
      setInviteCode((leagueRow?.invite_code as string) ?? null);

      const rows = await getLeagueMembers(leagueId);

      const me = rows.find((r: any) => r.user_id === user.id);
      setMyRole((me?.role as string) ?? "member");

      const { data: membershipRow, error: membershipErr, status: membershipStatus } = await supabase
        .from("league_members")
        .select("payment_status")
        .eq("league_id", leagueId)
        .eq("user_id", user.id)
        .single();

      if (membershipErr && membershipStatus !== 406) throw membershipErr;
      setMyPaymentStatus((membershipRow?.payment_status as string) ?? "free");

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

      const colorIndexByUserId = buildLeagueColorMap(normalized.map((r) => r.user_id));

      const nextMembers: Member[] = normalized.map((r) => {
        const colorIndex = colorIndexByUserId.get(r.user_id);
        const c = colorIndex == null ? colorsForUserId(r.user_id) : PALETTE[colorIndex];
        return {
          id: r.user_id,
          name: r.display,
          subtitle: undefined,
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
  }, [leagueId, month, monthDays, router, year]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    listAnim.setValue(0);
    Animated.timing(listAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [listAnim, viewMode]);

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
      .subscribe((status) => {
        if (__DEV__) {
          console.log("[league daily_logs realtime]", leagueId, status);
        }
      });

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
          void load();
        }
      )
      .subscribe((status) => {
        if (__DEV__) {
          console.log("[league league_members realtime]", leagueId, status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leagueId, load]);

  const membersToRender = useMemo((): RenderedMember[] => {
    if (viewMode === "Ranking") {
      const ranked = [...members]
        .map((m) => ({ m, s: scoreDays(m.days) }))
        .sort((a, b) => {
          if (b.s !== a.s) return b.s - a.s;
          const n = a.m.name.localeCompare(b.m.name);
          if (n !== 0) return n;
          return a.m.id.localeCompare(b.m.id);
        });

      return ranked.map((entry, idx) => {
        const above = ranked[idx - 1];
        const below = ranked[idx + 1];
        const daysLeft = Math.max(monthDays - (todayIndex + 1), 0);
        const daysLeftLabel = `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;

        let rivalLabel: string | undefined;
        if (idx === 0 && below) {
          const delta = entry.s - below.s;
          rivalLabel =
            delta <= 0
              ? `Tied · ${daysLeftLabel}`
              : `${delta} day${delta === 1 ? "" : "s"} ahead · ${daysLeftLabel}`;
        } else if (above) {
          const delta = above.s - entry.s;
          rivalLabel =
            delta <= 0
              ? `Tied · ${daysLeftLabel}`
              : `${delta} day${delta === 1 ? "" : "s"} behind · ${daysLeftLabel}`;
        }

        return {
          member: entry.m,
          rank: idx + 1,
          rivalLabel,
        };
      });
    }

    if (!myId) return members.map((member) => ({ member }));
    const i = members.findIndex((m) => m.id === myId);
    if (i <= 0) return members.map((member) => ({ member }));
    const me = members[i];
    return [me, ...members.slice(0, i), ...members.slice(i + 1)].map((member) => ({ member }));
  }, [members, myId, viewMode]);

  const toggleDayForMember = useCallback(
    async (memberId: string, dayIndex: string | number) => {
      const day = typeof dayIndex === "number" ? dayIndex : Number(dayIndex);

      const canParticipate =
        leagueIsFree || !leaguePlanTier || myPaymentStatus === "paid" || myPaymentStatus === "free";

      if (!canParticipate) return;

      // only allow self
      if (!myId || memberId !== myId) return;

      // bounds
      if (day < 0 || day >= monthDays) return;

      // no future
      if (day > todayIndex) return;

      // âœ… NEW: only today + yesterday
      if (!isEditableDay(day, todayIndex)) return;

      const d = new Date(year, month, day + 1);
      const log_date = toDateOnlyLocal(d);

      const myDays = members.find((m) => m.id === myId)?.days ?? [];
      const current = myDays[day] ?? false;
      const hadAnyCheckIn = myDays.some(Boolean);
      const next = !current;

      // optimistic UI
      setMembers((prev) =>
        prev.map((x) =>
          x.id !== memberId ? x : { ...x, days: x.days.map((v, i) => (i === day ? next : v)) }
        )
      );

        const { error } = await supabase.rpc("toggle_daily_log", {
          p_league_id: leagueId,
          p_log_date: log_date,
          p_completed: next,
        });

        // revert if failed
        if (error) {
          setMembers((prev) =>
            prev.map((x) =>
              x.id !== memberId
                ? x
                : { ...x, days: x.days.map((v, i) => (i === day ? current : v)) }
            )
          );
          setError(error.message ?? "Could not update your check-in");
        } else if (!current && !hadAnyCheckIn) {
          void trackEvent("first_check_in", { league_id: leagueId });
        }
      },
      [leagueId, leagueIsFree, leaguePlanTier, members, monthDays, myId, myPaymentStatus, year, month, todayIndex]
    );

  const canParticipate =
    leagueIsFree || !leaguePlanTier || myPaymentStatus === "paid" || myPaymentStatus === "free";
  const showInvite =
    canParticipate && (myRole === "owner" || myRole === "admin" || myRole === "member");
  const elapsedDays = Math.max(Math.min(todayIndex + 1, monthDays), 1);
  const bgColors =
    viewMode === "Ranking"
      ? (["#11041F", "#1D0D38", "#160A2D"] as const)
      : ([UI.bgTop, UI.bgBottom] as const);

  return (
    <ThemedView style={styles.container}>
      <LinearGradient
        colors={bgColors}
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
                  <Text style={styles.modalEyebrow}>COMMITO LINK</Text>
                  <Text style={styles.modalTitle}>Invite a friend</Text>
                  <Text style={styles.inviteSubtitle}>Share this code so someone can join your league in Commito.</Text>

                  <View style={styles.inviteCodeRow}>
                    <View style={[styles.codeBox, styles.codeBoxInline]}>
                    <Text style={styles.codeText}>{inviteCode ?? "-"}</Text>
                  </View>
                  <PillButton label={copied ? "Copied" : "Copy"} size="sm" onPress={onCopyCode} />
                </View>

                <Text style={styles.inviteInstruction}>
                  Install Commito, tap Join, and enter this code.
                </Text>

                <View style={styles.inviteActions}>
                  <ModalActionButton label="Share invite" tone="primary" onPress={onShareInvite} />
                  <ModalActionButton
                    label="Close"
                    tone="secondary"
                    onPress={() => setInviteOpen(false)}
                  />
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
                  <Text style={styles.modalEyebrow}>CONTROL PANEL</Text>
                  <Text style={styles.menuTitle}>Menu</Text>
                  <View style={styles.menuActions}>
                  <PillButton
                    label="Edit name"
                    size="sm"
                    onPress={async () => {
                      setMenuOpen(false);
                      await openEditName();
                    }}
                  />
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
                </View>
                {__DEV__ ? (
                  <View style={styles.menuDevSection}>
                    <Text style={styles.menuSectionLabel}>Dev</Text>
                    <PillButton
                      label="Test notification"
                      size="sm"
                      onPress={async () => {
                        setMenuOpen(false);
                        await scheduleGentleTestNotification();
                      }}
                    />
                  </View>
                ) : null}
                <View style={styles.menuFooter}>
                  <PillButton
                    label="Delete account"
                    size="sm"
                    tone="destructive"
                    onPress={() => {
                      setMenuOpen(false);
                      setDeleteAccountError(null);
                      setDeleteAccountOpen(true);
                    }}
                  />
                  <ModalActionButton
                    label="Close"
                    tone="secondary"
                    onPress={() => setMenuOpen(false)}
                  />
                </View>
              </Pressable>
            </Pressable>
          </Modal>

        <Modal
          visible={deleteAccountOpen}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (deletingAccount) return;
            setDeleteAccountOpen(false);
          }}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => {
              if (deletingAccount) return;
              setDeleteAccountOpen(false);
            }}
          >
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>Delete account</Text>
              <Text style={styles.messageText}>
                This permanently removes your account and any leagues you created. This cannot be undone.
              </Text>
              {deleteAccountError ? <Text style={styles.modalError}>{deleteAccountError}</Text> : null}
              <View style={styles.modalActions}>
                <PillButton
                  label={deletingAccount ? "Deleting..." : "Delete account"}
                  size="sm"
                  onPress={onDeleteAccount}
                />
                <PillButton
                  label="Cancel"
                  size="sm"
                  onPress={() => {
                    if (deletingAccount) return;
                    setDeleteAccountOpen(false);
                  }}
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={editNameOpen}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (savingName) return;
            setEditNameOpen(false);
          }}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => {
              if (savingName) return;
              setEditNameOpen(false);
            }}
          >
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>Edit display name</Text>
              <Text style={styles.modalMessageLabel}>What should people in the league see?</Text>
              <TextInput
                value={displayNameInput}
                onChangeText={(value) => {
                  setDisplayNameInput(value);
                  if (nameError) setNameError(null);
                }}
                placeholder="Your name"
                placeholderTextColor="rgba(237,231,255,0.38)"
                autoCapitalize="words"
                autoCorrect={false}
                editable={!savingName}
                maxLength={24}
                style={styles.nameInput}
              />
              {nameError ? <Text style={styles.modalError}>{nameError}</Text> : null}
              <Text style={styles.modalHint}>This updates the name shown in league cards.</Text>
              <View style={styles.modalActions}>
                <PillButton
                  label={savingName ? "Saving..." : "Save"}
                  size="sm"
                  onPress={onSaveDisplayName}
                />
                <PillButton
                  label="Cancel"
                  size="sm"
                  onPress={() => {
                    if (savingName) return;
                    setEditNameOpen(false);
                  }}
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* HEADER */}
        {false ? (
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerBar}>
            <View style={styles.headerSide}>
              <Pressable
                onPress={onMenu}
                style={({ pressed }) => [
                  styles.headerIconBtn,
                  pressed && { backgroundColor: UI.pillBgActive },
                ]}
                hitSlop={8}
              >
                <Ionicons name="menu" size={22} color={UI.text} />
              </Pressable>
            </View>

            <View style={styles.headerTitleWrap}>
              <Segmented value={viewMode} onChange={setViewMode} compact />
            </View>

            <View style={[styles.headerSide, { alignItems: "flex-end" }]}>
              {showInvite ? <PillButton label="Invite" size="sm" onPress={onInvite} /> : null}
            </View>
          </View>

          {leagueName ? (
            <Text
              style={[
                styles.headerName,
                leagueName.length > 40
                  ? styles.headerNameLong
                  : leagueName.length > 24
                    ? styles.headerNameMedium
                    : null,
              ]}
              numberOfLines={2}
            >
              {leagueName}
            </Text>
          ) : null}
          {leagueActivity ? (
            <View style={styles.activityChip}>
              <Text style={styles.activityChipText}>
                {`${emojiForActivity(leagueActivity)} ${leagueActivity}`}
              </Text>
            </View>
          ) : null}
        </View>
        ) : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <View style={styles.headerBar}>
              <View style={styles.headerSide}>
                <Pressable
                  onPress={onMenu}
                  style={({ pressed }) => [
                    styles.headerIconBtn,
                    pressed && { backgroundColor: UI.pillBgActive },
                  ]}
                  hitSlop={8}
                >
                  <Ionicons name="menu" size={22} color={UI.text} />
                </Pressable>
              </View>

              <View style={styles.headerTitleWrap}>
                <Segmented value={viewMode} onChange={setViewMode} compact />
              </View>

              <View style={[styles.headerSide, { alignItems: "flex-end" }]}>
                {showInvite ? <PillButton label="Invite" size="sm" onPress={onInvite} /> : null}
              </View>
            </View>

            {leagueName ? (
              <Text
                style={[
                  styles.headerName,
                  leagueName.length > 40
                    ? styles.headerNameLong
                    : leagueName.length > 24
                      ? styles.headerNameMedium
                      : null,
                ]}
                numberOfLines={2}
              >
                {leagueName}
              </Text>
            ) : null}
            {leagueActivity ? (
              <View style={styles.activityChip}>
                <Text style={styles.activityChipText}>
                  {`${emojiForActivity(leagueActivity)} ${leagueActivity}`}
                </Text>
              </View>
            ) : null}
          </View>

          {!canParticipate && leaguePlanTier ? (
            <View style={styles.paymentNotice}>
              <Text style={styles.paymentNoticeTitle}>Payment required</Text>
              <Text style={styles.paymentNoticeText}>
                Complete league entry purchase before logging activity or inviting others.
              </Text>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/(app)/league/purchase",
                    params: {
                      leagueId,
                      next: `/(app)/league/${leagueId}`,
                    },
                  })
                }
                style={styles.paymentNoticeBtn}
              >
                <Text style={styles.paymentNoticeBtnText}>
                  {leagueStatus === "payment_required" ? "Continue to payment" : "Open payment"}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {false ? (
            <View style={styles.activityChip}>
              <Text style={styles.activityChipEmoji}>{emojiForActivity(leagueActivity)}</Text>
              <Text style={styles.metaDivider}>-</Text>
              <Text style={styles.activityChipText}>{leagueActivity}</Text>
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {viewMode === "Ranking" ? (
            <Text style={styles.leaderboardLabel}>Leaderboard</Text>
          ) : null}

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator />
              <MemberCardSkeleton />
              <MemberCardSkeleton />
            </View>
          ) : (
            <Animated.View
              style={{
                opacity: listAnim,
                transform: [
                  {
                    translateY: listAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [8, 0],
                    }),
                  },
                ],
              }}
              >
                {membersToRender.map(({ member, rank, rivalLabel }, index) => (
                  <React.Fragment key={member.id}>
                    {viewMode !== "Ranking" && index === 1 ? (
                      <View style={styles.othersDividerWrap}>
                        <View style={styles.othersDividerLine} />
                        <Text style={styles.othersDividerText}>Others in the league</Text>
                        <View style={styles.othersDividerLine} />
                      </View>
                    ) : null}
                    <View style={styles.memberCardWrap}>
                      <UserCard
                        name={viewMode !== "Ranking" && index === 0 ? "You" : member.name}
                        subtitle={member.subtitle}
                        paceMessage={
                          viewMode !== "Ranking" &&
                          member.id === myId &&
                          shouldShowProjectionMessage(elapsedDays)
                            ? buildProjectionMessage(scoreDays(member.days), elapsedDays, monthDays, {
                                isFreeLeague: leagueIsFree,
                              })
                            : undefined
                        }
                        days={member.days}
                        colorDark={member.colorDark}
                        accentActive={member.accentActive}
                        todayIndex={todayIndex}
                      disabled={!canParticipate || (!!myId && member.id !== myId)}
                      onToggle={(i) => toggleDayForMember(member.id, i)}
                      showRank={viewMode === "Ranking"}
                      rank={rank}
                      rivalLabel={rivalLabel}
                    />
                  </View>
                  </React.Fragment>
                ))}
              </Animated.View>
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
    width: 84,
    alignItems: "flex-start",
  },
  headerIconBtn: {
    minWidth: 46,
    minHeight: 46,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: UI.pillBorder,
    backgroundColor: UI.pillBg,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },

  headerName: {
    marginTop: 10,
    textAlign: "center",
    color: "rgba(237,231,255,0.9)",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
    letterSpacing: -0.2,
    paddingHorizontal: 14,
  },
  headerNameMedium: {
    fontSize: 20,
    lineHeight: 26,
  },
  headerNameLong: {
    fontSize: 18,
    lineHeight: 24,
  },

  pillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: UI.pillBorder,
    backgroundColor: UI.pillBg,
  },
  pillBtnDestructive: {
    borderColor: "rgba(255,120,120,0.34)",
    backgroundColor: "rgba(255,120,120,0.1)",
  },
  pillBtnGhost: {
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "transparent",
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
  pillBtnTextDestructive: { color: "#FFB4B4" },
  pillBtnTextGhost: { color: "rgba(237,231,255,0.72)" },
  pillBtnTextSm: { fontSize: 14 },
  pillBtnTextXs: { fontSize: 14, fontWeight: "800" },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 8, paddingBottom: 28 },

  activityChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 4,
    marginTop: 4,
    marginBottom: 2,
    alignSelf: "center",
  },
  activityChipEmoji: {
    fontSize: 14,
    lineHeight: 18,
  },
  activityChipText: {
    color: "rgba(237,231,255,0.68)",
    fontSize: 12.5,
    fontWeight: "600",
    lineHeight: 17,
    textAlign: "center",
  },
  paymentNotice: {
    marginTop: 12,
    marginBottom: 6,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.28)",
    backgroundColor: "rgba(120,53,15,0.22)",
    gap: 8,
  },
  paymentNoticeTitle: {
    color: "#FDE68A",
    fontSize: 15,
    fontWeight: "800",
  },
  paymentNoticeText: {
    color: "rgba(254,243,199,0.88)",
    lineHeight: 20,
    fontSize: 13,
  },
  paymentNoticeBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.35)",
    backgroundColor: "rgba(245,158,11,0.14)",
  },
  paymentNoticeBtnText: {
    color: "#FEF3C7",
    fontSize: 13,
    fontWeight: "800",
  },
  activitySpacer: {
    width: 0,
    opacity: 0,
    fontSize: 0,
    lineHeight: 0,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 4,
    marginTop: 0,
    flexWrap: "wrap",
  },
  metaLabel: {
    color: "rgba(237,231,255,0.42)",
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  metaDivider: {
    width: 0,
    opacity: 0,
    fontSize: 0,
    lineHeight: 0,
  },
  metaValue: {
    color: "rgba(237,231,255,0.74)",
    fontSize: 13.5,
    fontWeight: "600",
    lineHeight: 19,
    flexShrink: 1,
  },
  weekCapsule: {
    alignSelf: "flex-start",
    marginTop: 0,
    marginBottom: 0,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(162,89,255,0.18)",
    backgroundColor: "rgba(162,89,255,0.08)",
  },
  statusStrip: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.045)",
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 1,
    marginBottom: 0,
  },
  statusLine: {
    color: UI.text,
    fontSize: 13.5,
    fontWeight: "600",
    lineHeight: 18,
  },
  statusLabel: {
    color: "rgba(237,231,255,0.46)",
    fontWeight: "700",
    textTransform: "capitalize",
  },
  statusDivider: {
    color: "rgba(237,231,255,0.26)",
    fontWeight: "700",
  },
  statusValue: {
    color: "rgba(237,231,255,0.82)",
    fontWeight: "700",
  },
  statusSubline: {
    display: "none",
    color: "rgba(237,231,255,0.58)",
    fontSize: 12.5,
    fontWeight: "500",
    lineHeight: 17,
  },
  statusSubvalue: {
    color: "rgba(237,231,255,0.82)",
    fontWeight: "700",
  },
  statusHint: {
    display: "none",
    marginTop: 2,
    color: "rgba(237,231,255,0.38)",
    fontSize: 11.5,
    fontWeight: "600",
    lineHeight: 16,
  },
  segmentWrap: {
    position: "relative",
    flexDirection: "row",
    width: 210,
    borderRadius: 999,
    padding: 3,
    overflow: "hidden",
    backgroundColor: UI.segmentBg,
    borderWidth: 1,
    borderColor: UI.segmentBorder,
  },
  segmentWrapCompact: {
    width: 176,
  },
  segmentThumb: {
    position: "absolute",
    top: 3,
    left: 3,
    bottom: 3,
    backgroundColor: UI.segmentActiveBg,
    borderWidth: 1,
    borderColor: UI.segmentActiveBorder,
    borderRadius: 999,
    shadowColor: "rgba(162,89,255,0.45)",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentBtnCompact: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  segmentText: { color: UI.muted, fontWeight: "700", fontSize: 14 },
  segmentTextCompact: { fontSize: 12.5 },
  segmentTextActive: { color: UI.text },

  errorText: { color: UI.error, fontSize: 14, fontWeight: "600" },
  leaderboardLabel: {
    color: "rgba(237,231,255,0.46)",
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginTop: 2,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  loadingWrap: {
    paddingTop: 8,
    gap: 14,
  },
  skeletonCard: {
    borderRadius: 20,
    padding: 14,
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  skeletonHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  skeletonName: {
    width: 140,
    height: 26,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  skeletonCount: {
    width: 52,
    height: 18,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  skeletonBarTrack: {
    height: 16,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
  },
  skeletonBarFill: {
    width: "28%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  skeletonSub: {
    width: 120,
    height: 18,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    maxWidth: 13 * (28 + 8),
  },
  skeletonTile: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  skeletonStreak: {
    width: "42%",
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  memberCardWrap: {
    marginBottom: 10,
  },
  othersDividerWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: -2,
    marginBottom: 6,
  },
  othersDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  othersDividerText: {
    color: "rgba(237,231,255,0.38)",
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

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
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(144,108,255,0.42)",
    backgroundColor: "rgba(16,7,34,0.985)",
    padding: 20,
    shadowColor: "#7C3AED",
    shadowOpacity: 0.34,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
  },
  modalEyebrow: {
    color: "rgba(176,150,255,0.82)",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 2.2,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: 10,
  },
  modalTitle: {
    color: UI.text,
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.4,
    textAlign: "center",
    marginBottom: 10,
  },
  inviteSubtitle: {
    marginTop: -1,
    marginBottom: 16,
    color: "rgba(237,231,255,0.72)",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 20,
    textAlign: "center",
  },
  inviteCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  codeBox: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(164,132,255,0.26)",
    backgroundColor: "rgba(255,255,255,0.045)",
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C3AED",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  codeBoxInline: {
    flex: 1,
  },
  codeText: {
    color: UI.text,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 3.4,
  },
  inviteInstruction: {
    marginTop: 13,
    color: "rgba(237,231,255,0.6)",
    fontSize: 12.5,
    fontWeight: "600",
    lineHeight: 18,
    textAlign: "center",
  },
  inviteActions: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  modalActionBtn: {
    minWidth: 112,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  modalActionBtnPrimary: {
    borderColor: "rgba(158,124,255,0.72)",
    backgroundColor: "rgba(114,73,255,0.24)",
    shadowColor: "#8B5CF6",
    shadowOpacity: 0.32,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  modalActionBtnSecondary: {
    borderColor: "rgba(164,132,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  modalActionBtnPressed: {
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  modalActionBtnPrimaryPressed: {
    backgroundColor: "rgba(114,73,255,0.34)",
  },
  modalActionBtnText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  modalActionBtnTextPrimary: {
    color: "#F5F0FF",
  },
  modalActionBtnTextSecondary: {
    color: "rgba(237,231,255,0.82)",
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
  modalError: {
    marginTop: 10,
    color: UI.error,
    fontSize: 12.5,
    fontWeight: "700",
    textAlign: "center",
  },
  nameInput: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    color: UI.text,
    fontSize: 16,
    fontWeight: "600",
  },
  menuCard: {
    width: "100%",
    maxWidth: 300,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(144,108,255,0.42)",
    backgroundColor: "rgba(16,7,34,0.985)",
    padding: 18,
    gap: 12,
    shadowColor: "#7C3AED",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  menuTitle: {
    color: UI.text,
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.4,
    textAlign: "center",
    marginBottom: 2,
  },
  menuActions: {
    gap: 12,
  },
  menuDevSection: {
    marginTop: 2,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(164,132,255,0.18)",
    gap: 10,
  },
  menuSectionLabel: {
    color: "rgba(176,150,255,0.66)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    textAlign: "center",
  },
  menuFooter: {
    marginTop: 4,
    paddingTop: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(164,132,255,0.18)",
    gap: 10,
  },
});



