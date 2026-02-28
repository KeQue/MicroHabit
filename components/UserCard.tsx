import { ThemedText } from "@/components/themed-text";
import { UserDayGrid } from "@/components/UserDayGrid";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

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
  rivalLabel?: string;
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function computeStreak(days: boolean[], todayIndex?: number) {
  if (!days?.length) return 0;

  let end = days.length - 1;

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

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  return { r: r1 + m, g: g1 + m, b: b1 + m };
}

function strongerAccent(hex: string) {
  const rgb = safeHexToRgb01(hex);
  if (!rgb) return hex;

  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const s2 = clamp01(s * 2.2);
  const l2 = clamp01(l + 0.1);

  const out = hslToRgb(h, s2, l2);
  return rgb01ToHex(out.r, out.g, out.b);
}

function withAlpha(hex: string, alpha: number) {
  const rgb = safeHexToRgb01(hex);
  if (!rgb) return `rgba(255,255,255,${alpha})`;
  return `rgba(${Math.round(rgb.r * 255)},${Math.round(rgb.g * 255)},${Math.round(rgb.b * 255)},${alpha})`;
}

function rankTheme(rank?: number) {
  if (rank === 1) {
    return {
      border: "rgba(255,214,102,0.26)",
    };
  }
  if (rank === 2) {
    return {
      border: "rgba(214,220,232,0.18)",
    };
  }
  if (rank === 3) {
    return {
      border: "rgba(211,145,102,0.14)",
    };
  }
  if (typeof rank === "number") {
    return {
      border: "rgba(255,255,255,0.08)",
    };
  }
  return null;
}

function rankIcon(rank?: number) {
  if (rank === 1) return "👑";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

function streakMood(streak: number) {
  if (streak >= 7) return "Unstoppable";
  if (streak >= 3) return "On fire";
  return "Warming up";
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
  rivalLabel,
}: Props) {
  const totalDays = days.length;
  const activeDays = useMemo(() => (days ?? []).filter(Boolean).length, [days]);
  const fillPct = totalDays === 0 ? 0 : clamp01(activeDays / totalDays);
  const streak = useMemo(() => computeStreak(days, todayIndex), [days, todayIndex]);

  const nameStyle = disabled ? styles.nameMuted : styles.name;
  const countStyle = disabled ? styles.countMuted : styles.count;
  const isLeader = showRank && rank === 1;
  const isPrimaryCard = !disabled && !showRank;
  const isEmpty = activeDays === 0;
  const rankAccent = showRank ? rankTheme(rank) : null;
  const medal = showRank ? rankIcon(rank) : null;

  const gradientEnd = strongerAccent(accentActive);
  const primaryBorder = withAlpha(gradientEnd, 0.22);

  const progressAnim = useRef(new Animated.Value(fillPct)).current;
  const barGlowAnim = useRef(new Animated.Value(0.12)).current;
  const leaderGlowAnim = useRef(new Animated.Value(isLeader ? 1 : 0)).current;
  const prevActiveDays = useRef(activeDays);

  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: fillPct,
      damping: 18,
      stiffness: 220,
      mass: 0.72,
      useNativeDriver: false,
    }).start();
  }, [fillPct, progressAnim]);

  useEffect(() => {
    if (activeDays > prevActiveDays.current) {
      Animated.sequence([
        Animated.timing(barGlowAnim, {
          toValue: 0.42,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(barGlowAnim, {
          toValue: 0.12,
          duration: 280,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
      ]).start();
    }
    prevActiveDays.current = activeDays;
  }, [activeDays, barGlowAnim]);

  useEffect(() => {
    if (isLeader) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(leaderGlowAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: false,
          }),
          Animated.timing(leaderGlowAnim, {
            toValue: 0.45,
            duration: 1200,
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      leaderGlowAnim.stopAnimation();
      leaderGlowAnim.setValue(0);
    }
  }, [isLeader, leaderGlowAnim]);

  const animatedWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const leaderShadowOpacity = leaderGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.14],
  });

  return (
    <Animated.View
      style={[
        styles.card,
        showRank && styles.cardRanked,
        isPrimaryCard && styles.cardPrimary,
        isPrimaryCard && {
          borderColor: primaryBorder,
          shadowColor: withAlpha(accentActive, 0.28),
        },
        rankAccent && { borderColor: rankAccent.border },
        isLeader && {
          shadowColor: "#FFD666",
          shadowOpacity: leaderShadowOpacity,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.nameWrap}>
          {medal ? <ThemedText style={styles.rankMedal}>{medal}</ThemedText> : null}
          <ThemedText
            style={[nameStyle, isPrimaryCard && styles.namePrimary]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {name}
          </ThemedText>
        </View>

        <ThemedText style={countStyle}>
          {activeDays}/{totalDays}
        </ThemedText>
      </View>

      {showRank && rivalLabel ? (
        <View style={styles.rivalRow}>
          <View style={[styles.rivalDot, { backgroundColor: accentActive }]} />
          <ThemedText style={styles.rivalText}>{rivalLabel}</ThemedText>
        </View>
      ) : null}

      <View style={styles.progressBlock}>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFillWrap,
              {
                width: animatedWidth,
                shadowColor: gradientEnd,
                shadowOpacity: barGlowAnim,
              },
            ]}
          >
            <LinearGradient
              colors={[accentActive, gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.progressFill}
            />
          </Animated.View>
        </View>
      </View>

      {subtitle ? (
        <ThemedText style={styles.sub} numberOfLines={1} ellipsizeMode="tail">
          {subtitle}
        </ThemedText>
      ) : null}

      {isEmpty ? (
        <View style={styles.emptyRow}>
          <View style={[styles.emptyDot, { backgroundColor: accentActive }]} />
          <ThemedText style={styles.emptyText}>
            {isPrimaryCard ? "Tap today to kick off your streak." : "No check-ins yet this month."}
          </ThemedText>
        </View>
      ) : null}

      <View pointerEvents={disabled ? "none" : "auto"} style={styles.gridWrap}>
        <UserDayGrid
          days={days}
          accentActive={accentActive}
          onToggle={onToggle}
          todayIndex={todayIndex}
        />
      </View>

      <View
        style={[
          styles.streakCard,
          {
            borderColor: withAlpha(accentActive, streak > 3 ? 0.22 : 0.1),
            backgroundColor: withAlpha(accentActive, 0.04),
          },
        ]}
      >
        <ThemedText style={[styles.streakEmoji, { color: accentActive }]}>🔥</ThemedText>
        <View style={styles.streakTextRow}>
          <ThemedText style={styles.streakLabel}>Streak</ThemedText>
          <ThemedText style={styles.streakValue}>
            {streak} {streak === 1 ? "Day" : "Days"}
          </ThemedText>
          <ThemedText style={styles.streakDivider}>-</ThemedText>
          <ThemedText style={styles.streakMood}>{streakMood(streak)}</ThemedText>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 14,
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowOpacity: 0,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  cardPrimary: {
    padding: 16,
    shadowOpacity: 0.1,
  },
  cardRanked: {
    paddingVertical: 11,
    gap: 10,
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
  rankMedal: {
    fontSize: 21,
    lineHeight: 24,
  },
  name: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 0.2,
    lineHeight: 40,
    paddingTop: 4,
    paddingBottom: 2,
    flexShrink: 1,
  },
  namePrimary: {
    fontSize: 32,
  },
  nameMuted: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 0.2,
    lineHeight: 40,
    paddingTop: 4,
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

  rivalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: -2,
  },
  rivalDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  rivalText: {
    color: "rgba(244,238,255,0.68)",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },

  progressBlock: {
    marginTop: 2,
    marginBottom: 2,
  },
  progressTrack: {
    height: 16,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  progressFillWrap: {
    height: "100%",
    borderRadius: 999,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },

  sub: {
    opacity: 0.56,
    fontSize: 15,
    fontWeight: "600",
  },
  emptyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  emptyDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  emptyText: {
    flex: 1,
    color: "rgba(244,238,255,0.68)",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },

  gridWrap: {
    marginTop: 1,
    marginBottom: 3,
  },

  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 2,
  },
  streakTextRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    flexShrink: 1,
  },
  streakEmoji: {
    fontSize: 15,
    lineHeight: 18,
  },
  streakLabel: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
    marginTop: 1,
  },
  streakValue: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 22,
  },
  streakDivider: {
    color: "rgba(255,255,255,0.38)",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 16,
  },
  streakMood: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 1,
  },
});
