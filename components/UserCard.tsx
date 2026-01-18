import { ThemedText } from "@/components/themed-text";
import { UserDayGrid } from "@/components/UserDayGrid";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";

type Props = {
  name: string;
  subtitle?: string;
  days: boolean[];

  colorDark: string;
  accentActive: string;

  onToggle: (dayIndex: number) => void;
  todayIndex?: number;

  disabled?: boolean;

  showRank?: boolean;
  rank?: number;
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function computeStreak(days: boolean[], todayIndex?: number) {
  if (!days?.length) return 0;

  // Default: end at last day in array
  let end = days.length - 1;

  // If we know "today", end at today if done, otherwise end at yesterday
  if (typeof todayIndex === "number") {
    if (days[todayIndex]) {
      end = Math.min(todayIndex, days.length - 1);
    } else {
      end = Math.min(todayIndex - 1, days.length - 1);
    }
  }

  if (end < 0) return 0;

  let s = 0;
  for (let i = end; i >= 0; i--) {
    if (!days[i]) break;
    s++;
  }
  return s;
}

/* ---------- COLOR HELPERS (for strong purple gradient) ---------- */

function safeHexToRgb01(hex?: string) {
  if (!hex) return null;
  const h = hex.replace("#", "");
  if (h.length !== 6) return null;

  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;

  return { r, g, b };
}

function rgb01ToHex(r: number, g: number, b: number) {
  const rr = Math.round(clamp01(r) * 255)
    .toString(16)
    .padStart(2, "0");
  const gg = Math.round(clamp01(g) * 255)
    .toString(16)
    .padStart(2, "0");
  const bb = Math.round(clamp01(b) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${rr}${gg}${bb}`;
}

function rgbToHsl(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r1 = 0,
    g1 = 0,
    b1 = 0;

  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  return { r: r1 + m, g: g1 + m, b: b1 + m };
}

/* 🔥 STRONGER ACCENT */
function strongerAccent(hex: string) {
  const rgb = safeHexToRgb01(hex);
  if (!rgb) return hex;

  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // More punch than before, without blowing out to neon white
  const s2 = clamp01(s * 2.4);
  const l2 = clamp01(l + 0.12);

  const out = hslToRgb(h, s2, l2);
  return rgb01ToHex(out.r, out.g, out.b);
}

export function UserCard({
  name,
  subtitle,
  days,
  colorDark,
  accentActive,
  onToggle,
  todayIndex,
  disabled = false,
  showRank = false,
  rank,
}: Props) {
  const totalDays = days.length;

  // ✅ IMPORTANT: must match Ranking logic exactly (count ALL true values)
  const activeDays = useMemo(() => (days ?? []).filter(Boolean).length, [days]);

  const pct = totalDays === 0 ? 0 : activeDays / totalDays;
  const fillPct = clamp01(pct);

  const streak = useMemo(() => computeStreak(days, todayIndex), [days, todayIndex]);

  const nameStyle = disabled ? styles.nameMuted : styles.name;
  const countStyle = disabled ? styles.countMuted : styles.count;

  const isLeader = showRank && rank === 1;

  const gradientEnd = strongerAccent(accentActive);
  const glowColor = gradientEnd;

  return (
    <View style={[styles.card, isLeader && styles.leaderCard]}>
      <View style={styles.headerRow}>
        <View style={styles.nameWrap}>
          {isLeader && <ThemedText style={styles.crown}>👑</ThemedText>}
          <ThemedText style={nameStyle} numberOfLines={1} ellipsizeMode="tail">
            {name}
          </ThemedText>
        </View>

        <ThemedText style={countStyle}>
          {activeDays}/{totalDays}
        </ThemedText>
      </View>

      <View style={styles.progressTrack}>
        <LinearGradient
          colors={[accentActive, gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.progressFill,
            styles.progressGlow,
            { shadowColor: glowColor },
            { width: activeDays === 0 ? 0 : `${Math.max(2, fillPct * 100)}%` },
          ]}
        />
      </View>

      {subtitle && (
        <ThemedText style={styles.sub} numberOfLines={1} ellipsizeMode="tail">
          {subtitle}
        </ThemedText>
      )}

      <View pointerEvents={disabled ? "none" : "auto"}>
        <UserDayGrid days={days} accentActive={accentActive} onToggle={onToggle} todayIndex={todayIndex} />
      </View>

      <View style={styles.streakRow}>
        <ThemedText style={styles.streakText}>
          🔥 Streak: {streak} {streak === 1 ? "day" : "days"}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 14,
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  leaderCard: {
    borderColor: "rgba(162,89,255,0.30)",
    backgroundColor: "rgba(162,89,255,0.08)",
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },

  nameWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },

  crown: {
    fontSize: 18,
    marginTop: 2,
  },

  // ✅ Fix username top clipping (give it real vertical breathing room)
  name: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 0.2,
    lineHeight: 40,
    paddingTop: 6,
    paddingBottom: 2,
    flexShrink: 1,
  },
  nameMuted: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 0.2,
    lineHeight: 40,
    paddingTop: 6,
    paddingBottom: 2,
    opacity: 0.92,
    flexShrink: 1,
  },

  count: {
    fontSize: 16,
    fontWeight: "800",
    opacity: 0.75,
  },
  countMuted: {
    fontSize: 16,
    fontWeight: "800",
    opacity: 0.65,
  },

  progressTrack: {
    height: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },

  // ✅ More “impressive” bar without changing layout:
  // subtle glow + slight elevation (Android)
  progressGlow: {
    shadowOpacity: 0.38,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },

  sub: {
    opacity: 0.65,
    fontSize: 16,
    fontWeight: "600",
  },

  streakRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
  },
  streakText: {
    opacity: 0.65,
    fontSize: 16,
    fontWeight: "700",
  },
});
