import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { UserCard } from "@/components/UserCard";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Switch, View } from "react-native";

const DAYS_IN_MONTH = 31;

type Member = {
  id: string;
  name: string;
  subtitle: string;
  colorLight: string;
  colorDark: string;      // progress bar / theme
  accentActive: string;   // ✅ grid active squares
  days: boolean[];
};


const makeDays = () => Array(DAYS_IN_MONTH).fill(false) as boolean[];

// --- helpers (sorting) ---
function activeDaysCount(days: boolean[]) {
  return days.reduce((acc, v) => acc + (v ? 1 : 0), 0);
}

function sortMembers(members: Member[], myId: string, leagueViewOn: boolean) {
  // OFF = My view: keep original order, only move me to top
  if (!leagueViewOn) {
    const idx = members.findIndex((m) => m.id === myId);
    if (idx <= 0) return members;

    const me = members[idx];
    return [me, ...members.slice(0, idx), ...members.slice(idx + 1)];
  }

  // ON = League view: rank by active days
  return [...members].sort((a, b) => {
    const ad = activeDaysCount(a.days);
    const bd = activeDaysCount(b.days);
    if (bd !== ad) return bd - ad;
    return a.name.localeCompare(b.name);
  });
}


export default function LeagueDetailScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();

  // Auto highlight today's day (0-based). For day 14 -> 13.
  const todayIndex = new Date().getDate() - 1;

  // Toggle: OFF = My view, ON = League view (ranking)
  const [leagueViewOn, setLeagueViewOn] = useState(false);

 const [members, setMembers] = useState<Member[]>([
  {
    id: "a",
    name: "User A",
    subtitle: "Sport",
    colorLight: "#9AE6B4",
    colorDark: "#2F855A",
    accentActive: "#00C853", // punchy green
    days: makeDays(),
  },
  {
    id: "b",
    name: "User B",
    subtitle: "Sport",
    colorLight: "#B794F4",
    colorDark: "#6B46C1",
    accentActive: "#7C3AED", // punchy purple
    days: makeDays(),
  },
  {
    id: "c",
    name: "User C",
    subtitle: "Sport",
    colorLight: "#FEB2B2",
    colorDark: "#C53030",
    accentActive: "#EF4444", // punchy red
    days: makeDays(),
  },
]);

  // TEMP: first member is "me"
  const myId = members[0]?.id ?? "";

  const orderedMembers = useMemo(() => {
    if (!myId) return members;
    return sortMembers(members, myId, leagueViewOn);
  }, [members, myId, leagueViewOn]);

  // ✅ Critical fix: update by memberId + dayIndex (no closure over m in setMembers)
  const toggleDayForMember = useCallback((memberId: string, dayIndex: number) => {
    setMembers((prev) =>
      prev.map((x) =>
        x.id !== memberId
          ? x
          : {
              ...x,
              days: x.days.map((v, i) => (i === dayIndex ? !v : v)),
            }
      )
    );
  }, []);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <ThemedText type="title">League: {leagueId}</ThemedText>

          <View style={styles.toggleWrap}>
            <ThemedText style={styles.toggleLabel}>
              {leagueViewOn ? "League view" : "My view"}
            </ThemedText>
            <Switch value={leagueViewOn} onValueChange={setLeagueViewOn} />
          </View>
        </View>

        {orderedMembers.map((m) => (
  <UserCard
    key={m.id}
    name={m.name}
    subtitle={m.subtitle}
    days={m.days}
    colorDark={m.colorDark}
    accentActive={m.accentActive}
    todayIndex={todayIndex}
    onToggle={(dayIndex) => toggleDayForMember(m.id, dayIndex)}
  />
))}


      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  toggleLabel: {
    fontSize: 12,
    opacity: 0.8,
  },
});
