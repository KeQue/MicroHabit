import { ThemedText } from "@/components/themed-text";
import { UserDayGrid } from "@/components/UserDayGrid";
import { StyleSheet, View } from "react-native";

type Props = {
  name: string;
  subtitle?: string;
  days: boolean[];

  colorDark: string;        // ✅ progress bar color
  accentActive: string;     // ✅ grid active color

  onToggle: (dayIndex: number) => void;
  todayIndex?: number;
};

export function UserCard({
  name,
  subtitle,
  days,
  colorDark,
  accentActive,
  onToggle,
  todayIndex,
}: Props) {
  const activeDays = days.filter(Boolean).length;
  const totalDays = days.length;
  const pct = totalDays === 0 ? 0 : activeDays / totalDays;

  return (
    <View style={styles.card}>
      {/* Header */}
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
            { width: `${pct * 100}%`, backgroundColor: accentActive },
          ]}
        />
      </View>

      {subtitle ? <ThemedText style={styles.sub}>{subtitle}</ThemedText> : null}

      {/* Grid */}
      <UserDayGrid
        days={days}
        accentActive={accentActive}   // ✅ ONLY this controls square color
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
    justifyContent: "space-between",
  },
  activeDaysInline: {
    flexDirection: "row",
    gap: 6,
    alignItems: "baseline",
  },
  activeLabel: { opacity: 0.75, fontSize: 12 },
  activeValue: { fontSize: 12, fontWeight: "800" },

  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  sub: { opacity: 0.7, fontSize: 12 },
});
