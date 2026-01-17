import { ThemedText } from "@/components/themed-text";
import { UserDayGrid } from "@/components/UserDayGrid";
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

export function UserCard({
  name,
  subtitle,
  days,
  colorDark,
  accentActive,
  onToggle,
  todayIndex,
  disabled = false,
}: Props) {
  const activeDays = days.filter(Boolean).length;
  const totalDays = days.length;
  const pct = totalDays === 0 ? 0 : activeDays / totalDays;

  return (
    <View style={[styles.card, disabled && styles.cardDisabled]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <ThemedText type="subtitle">{name}</ThemedText>

        {/* ✅ only numbers, no "Active Days" label */}
        <ThemedText style={styles.count}>
          {activeDays}/{totalDays}
        </ThemedText>
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

      {/* Optional: league activity */}
      {subtitle ? <ThemedText style={styles.sub}>{subtitle}</ThemedText> : null}

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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    borderRadius: 16,
    gap: 10,
  },
  cardDisabled: {
    opacity: 0.78,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },

  // ✅ replaces "Active Days" label + value
  count: { fontSize: 12, fontWeight: "800", opacity: 0.9 },

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

  gridDisabled: {
    opacity: 0.6,
  },
});
