import { Ionicons } from "@expo/vector-icons";
import { formatUtcMonth, type MonthlyCycle } from "@/features/leagues/monthly-results";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type Props = {
  currentMonth: string;
  cycles: MonthlyCycle[];
  currentUserId: string;
  loading: boolean;
  error: string | null;
  onOpen: () => void;
  onRetry: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  moreError?: string | null;
  onLoadMore?: () => void;
};

function closingLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Results are not final yet." : `Results become final on ${date.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  })} at ${date.toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC",
  })} UTC.`;
}

/** Displays server-supplied results only; this panel never calculates or edits rankings. */
export function MonthlyResults({
  currentMonth, cycles, currentUserId, loading, error, onOpen, onRetry,
  hasMore = false, loadingMore = false, moreError = null, onLoadMore,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const ordered = useMemo(() => [...cycles].sort((a, b) => b.month_start.localeCompare(a.month_start)), [cycles]);
  const selectedIndex = Math.max(0, ordered.findIndex((cycle) => cycle.month_start === selectedMonth));
  const cycle = ordered[selectedIndex];
  const currentMonthLabel = formatUtcMonth(currentMonth);

  useEffect(() => {
    setExpanded(false);
    setSelectedMonth(null);
  }, [currentUserId]);

  const toggle = () => {
    if (!expanded) onOpen();
    setExpanded(!expanded);
  };

  return (
    <View style={styles.panel}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Past results. Current month: ${currentMonthLabel}`}
        accessibilityHint={expanded ? "Hide previous monthly results" : "Show previous monthly results"}
        accessibilityState={{ expanded }}
        onPress={toggle}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
      >
        <Ionicons name="calendar-outline" size={18} color="#BCA3E3" accessible={false} />
        <Text style={styles.title} numberOfLines={1}>Past results</Text>
        <Text style={styles.currentMonth} numberOfLines={1}>{currentMonthLabel}</Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color="#BCA3E3" accessible={false} />
      </Pressable>
      {expanded ? (
        <View style={styles.content}>
          {loading ? (
            <View style={styles.message} accessible accessibilityLabel="Loading past results" accessibilityState={{ busy: true }}>
              <ActivityIndicator color="#BCA3E3" />
              <Text style={styles.muted}>Loading past results…</Text>
            </View>
          ) : error ? (
            <View style={styles.message}>
              <Text accessibilityRole="alert" style={styles.muted}>Could not load past results. Please try again.</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Retry loading past results" onPress={onRetry} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : !cycle ? (
            <Text style={styles.empty}>Your league’s results will appear here after its first month ends. You can continue together in the same league.</Text>
          ) : (
            <>
              <View style={styles.monthRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Show older month"
                  accessibilityState={{ disabled: selectedIndex >= ordered.length - 1 }}
                  disabled={selectedIndex >= ordered.length - 1}
                  onPress={() => setSelectedMonth(ordered[selectedIndex + 1].month_start)}
                  style={({ pressed }) => [styles.arrow, selectedIndex >= ordered.length - 1 && styles.disabled, pressed && styles.pressed]}
                >
                  <Ionicons name="chevron-back" size={18} color="#D8C0FF" accessible={false} />
                </Pressable>
                <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.month}>{formatUtcMonth(cycle.month_start)}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Show newer month"
                  accessibilityState={{ disabled: selectedIndex === 0 }}
                  disabled={selectedIndex === 0}
                  onPress={() => setSelectedMonth(ordered[selectedIndex - 1].month_start)}
                  style={({ pressed }) => [styles.arrow, selectedIndex === 0 && styles.disabled, pressed && styles.pressed]}
                >
                  <Ionicons name="chevron-forward" size={18} color="#D8C0FF" accessible={false} />
                </Pressable>
              </View>
              <Text style={styles.status}>{cycle.status === "final" ? "Final results · Read only" : "Provisional results · Read only"}</Text>
              {cycle.status === "provisional" ? <Text style={styles.note}>{closingLabel(cycle.finalizes_at)}</Text> : null}
              {cycle.results.length ? (
                <ScrollView style={styles.results} nestedScrollEnabled showsVerticalScrollIndicator contentContainerStyle={styles.resultsContent}>
                  {cycle.results.map((result) => {
                    const name = result.user_id === currentUserId ? "You" : result.display_name || "Former member";
                    return (
                      <View
                        key={result.user_id}
                        accessible
                        accessibilityLabel={`${name}. Rank ${result.position}. ${result.days_completed} active ${result.days_completed === 1 ? "day" : "days"}. Longest streak: ${result.longest_streak} ${result.longest_streak === 1 ? "day" : "days"}.`}
                        style={styles.result}
                      >
                        <Text style={styles.position}>#{result.position}</Text>
                        <View style={styles.member}>
                          <Text numberOfLines={2} style={styles.name}>{name}</Text>
                          <Text style={styles.note}>Longest streak: {result.longest_streak} {result.longest_streak === 1 ? "day" : "days"}</Text>
                        </View>
                        <Text style={styles.score}>{result.days_completed} {result.days_completed === 1 ? "day" : "days"}</Text>
                      </View>
                    );
                  })}
                </ScrollView>
              ) : <Text style={styles.empty}>No activity was recorded for this month.</Text>}
              {selectedIndex === ordered.length - 1 && onLoadMore && (hasMore || loadingMore || moreError) ? (
                <View style={styles.pagination}>
                  {moreError ? <Text accessibilityRole="alert" style={styles.muted}>Could not load older months. Please try again.</Text> : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={moreError ? "Retry loading older months" : "Load older months"}
                    accessibilityState={{ disabled: loadingMore, busy: loadingMore }}
                    disabled={loadingMore}
                    onPress={onLoadMore}
                    style={({ pressed }) => [styles.retry, pressed && styles.pressed, loadingMore && styles.disabled]}
                  >
                    <Text style={styles.retryText}>{loadingMore ? "Loading older months…" : moreError ? "Try again" : "Load older months"}</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(162,89,255,0.16)", backgroundColor: "rgba(162,89,255,0.08)", overflow: "hidden", marginBottom: 8 },
  toggle: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  title: { flex: 1, minWidth: 0, color: "#EDE7FF", fontSize: 14, fontWeight: "600" },
  currentMonth: { flexShrink: 1, color: "rgba(237,231,255,0.65)", fontSize: 12, textAlign: "right" },
  pressed: { backgroundColor: "rgba(162,89,255,0.18)" },
  content: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(237,231,255,0.10)", paddingHorizontal: 12, paddingBottom: 10 },
  message: { alignItems: "center", gap: 8, paddingVertical: 14 },
  muted: { color: "rgba(237,231,255,0.72)", fontSize: 13, lineHeight: 19, textAlign: "center" },
  empty: { color: "rgba(237,231,255,0.72)", fontSize: 13, lineHeight: 19, paddingVertical: 12 },
  retry: { minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: 12 },
  retryText: { color: "#D8C0FF", fontSize: 14, fontWeight: "600" },
  monthRow: { flexDirection: "row", alignItems: "center" },
  month: { flex: 1, textAlign: "center", color: "#EDE7FF", fontSize: 14, fontWeight: "700" },
  arrow: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  disabled: { opacity: 0.3 },
  status: { color: "#BCA3E3", fontSize: 12, lineHeight: 18, textAlign: "center", marginBottom: 4 },
  note: { color: "rgba(237,231,255,0.65)", fontSize: 12, lineHeight: 17 },
  results: { maxHeight: 280, marginTop: 6 },
  resultsContent: { paddingBottom: 2 },
  pagination: { alignItems: "center", gap: 4, paddingTop: 8 },
  result: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(237,231,255,0.08)" },
  position: { color: "#BCA3E3", fontSize: 12, fontWeight: "700", minWidth: 28 },
  member: { flex: 1, minWidth: 0, gap: 2 },
  name: { color: "#EDE7FF", fontSize: 14, fontWeight: "600" },
  score: { color: "#EDE7FF", fontSize: 13, fontWeight: "700", flexShrink: 1, textAlign: "right", maxWidth: "30%" },
});
