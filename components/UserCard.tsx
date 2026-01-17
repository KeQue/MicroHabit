import { ThemedText } from "@/components/themed-text";
import { UserDayGrid } from "@/components/UserDayGrid";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View } from "react-native";

type Props = {
  name: string;
  subtitle?: string; // use for league activity (optional)
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

  // Gradient like the mock. Uses per-user accent as the start.
  const gradStart = accentActive;
  const gradEnd = "#A259FF";

  return (
    <View style={[styles.section, disabled && styles.sectionDisabled]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <ThemedText style={[styles.name, disabled && styles.nameDisabled]} numberOfLines={1}>
          {name}
        </ThemedText>

        <ThemedText style={styles.count}>
          {activeDays}/{totalDays}
        </ThemedText>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFillWrap, { flex: fillFlex }]}>
          <LinearGradient
            colors={[gradStart, gradEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.progressFill}
          />
        </View>
        <View style={{ flex: 1 - fillFlex }} />
      </View>

      {/* Subtitle (activity) */}
      {subtitle ? (
        <ThemedText style={styles.sub} numberOfLines={1}>
          {subtitle}
        </ThemedText>
      ) : null}

      {/* Grid */}
      <View style={disabled && styles.gridDisabled}>
        <UserDayGrid
          days={days}
          accentActive={accentActive}
          onToggle={(dayIndex) => {
            if (disabled) return;
            onToggle(dayIndex);
          }}
          todayIndex={todayIndex}
        />
      </View>

      {/* Subtle divider like the mock */}
      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  // This is the "user block" spacing. Your mock has generous separation.
  section: {
    paddingTop: 18,
    paddingBottom: 18,
    gap: 10,
  },
  sectionDisabled: {
    opacity: 0.78,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
  },

  // stronger hierarchy like screenshot
  name: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  nameDisabled: {
    opacity: 0.85,
  },

  count: {
    fontSize: 14,
    fontWeight: "800",
    opacity: 0.75,
  },

  progressTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
    flexDirection: "row",
  },

  // Wrap used so gradient stays clipped properly.
  progressFillWrap: {
    height: "100%",
    overflow: "hidden",
    borderRadius: 999,
  },
  progressFill: {
    height: "100%",
    width: "100%",
    borderRadius: 999,
  },

  sub: {
    opacity: 0.65,
    fontSize: 16,
    fontWeight: "600",
  },

  gridDisabled: {
    opacity: 0.6,
  },

  divider: {
    height: 1,
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
});
