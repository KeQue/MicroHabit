import { ThemedText } from "@/components/themed-text";
import { UserDayGrid } from "@/components/UserDayGrid";
import React from "react";
import { StyleSheet, View } from "react-native";

type Props = {
  name: string;
  subtitle?: string; // league activity
  days: boolean[];

  colorDark: string; // kept for compatibility (not used)
  accentActive: string;

  onToggle: (dayIndex: number) => void;
  todayIndex?: number;

  disabled?: boolean;
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export function UserCard({
  name,
  subtitle,
  days,
  colorDark, // not used, keep for compatibility
  accentActive,
  onToggle,
  todayIndex,
  disabled = false,
}: Props) {
  const activeDays = days.filter(Boolean).length;
  const totalDays = days.length;

  const pct = totalDays === 0 ? 0 : activeDays / totalDays;
  const fillFlex = clamp01(pct);

  // IMPORTANT:
  // We do NOT fade other users. We only block touches.
  // If you want a subtle cue, we only slightly mute the name/count.
  const nameStyle = disabled ? styles.nameMuted : styles.name;
  const countStyle = disabled ? styles.countMuted : styles.count;

  return (
    <View style={styles.section}>
      {/* Header */}
      <View style={styles.headerRow}>
        <ThemedText style={nameStyle} numberOfLines={1}>
          {name}
        </ThemedText>

        <ThemedText style={countStyle}>
          {activeDays}/{totalDays}
        </ThemedText>
      </View>

      {/* Progress bar (flat color, matches squares) */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { flex: fillFlex, backgroundColor: accentActive }]} />
        <View style={{ flex: 1 - fillFlex }} />
      </View>

      {/* Subtitle (activity) */}
      {subtitle ? (
        <ThemedText style={styles.sub} numberOfLines={1}>
          {subtitle}
        </ThemedText>
      ) : null}

      {/* Grid
          Block touches for other users WITHOUT fading.
      */}
      <View pointerEvents={disabled ? "none" : "auto"}>
        <UserDayGrid
          days={days}
          accentActive={accentActive}
          onToggle={(dayIndex) => onToggle(dayIndex)}
          todayIndex={todayIndex}
        />
      </View>

      {/* Divider */}
      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingTop: 18,
    paddingBottom: 18,
    gap: 10,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
  },

  name: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  nameMuted: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 0.2,
    opacity: 0.92, // subtle only (no washed-out)
  },

  count: {
    fontSize: 14,
    fontWeight: "800",
    opacity: 0.75,
  },
  countMuted: {
    fontSize: 14,
    fontWeight: "800",
    opacity: 0.65,
  },

  progressTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
    flexDirection: "row",
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
  },

  sub: {
    opacity: 0.65,
    fontSize: 16,
    fontWeight: "600",
  },

  divider: {
    height: 1,
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
});
