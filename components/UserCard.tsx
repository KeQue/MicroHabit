import { ThemedText } from "@/components/themed-text";
import { UserDayGrid } from "@/components/UserDayGrid";
import { StyleSheet, View } from "react-native";

type Props = {
  name: string;
  subtitle?: string; // you can pass "Sport"
  days: boolean[];
  colorLight: string;
  colorDark: string;
  onToggle: (dayIndex: number) => void;

  // NEW
  todayIndex?: number; // 0-based
};

export function UserCard({
  name,
  subtitle,
  days,
  colorLight,
  colorDark,
  onToggle,
  todayIndex,
}: Props) {
  const activeDays = days.filter(Boolean).length;
  const totalDays = days.length;
  const pct = totalDays === 0 ? 0 : activeDays / totalDays;

  return (
    <View style={styles.card}>
      {/* Header row: name + progress */}
      <View style={styles.headerRow}>
        <ThemedText type="subtitle">{name}</ThemedText>

        <View style={styles.activeDaysInline}>
          <ThemedText style={styles.activeLabel}>Active Days</ThemedText>
          <ThemedText style={styles.activeValue}>
            {activeDays}/{totalDays}
          </ThemedText>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${pct * 100}%`, backgroundColor: colorDark },
          ]}
        />
      </View>

      {/* Subtitle */}
      {subtitle ? <ThemedText style={styles.sub}>{subtitle}</ThemedText> : null}

      {/* Grid */}
      <UserDayGrid
  days={days}
  colorLight={colorLight}
  colorDark={colorDark}
  onToggle={onToggle}
  todayIndex={todayIndex}
/>

    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    borderRadius: 16,
    gap: 10,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },

  activeDaysInline: {
    flexDirection: "row",
    gap: 6,
    alignItems: "baseline",
  },

  activeLabel: {
    opacity: 0.75,
    fontSize: 12,
  },

  activeValue: {
    fontSize: 12,
    fontWeight: "800",
  },

  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
  },

  sub: { opacity: 0.7, fontSize: 12 },
});
