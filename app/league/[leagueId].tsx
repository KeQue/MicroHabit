import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { UserCard } from "@/components/UserCard";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";

const DAYS_IN_MONTH = 31;

type Member = {
  id: string;
  name: string;
  subtitle: string;
  colorLight: string;
  colorDark: string;
  days: boolean[];
};

const makeDays = () => Array(DAYS_IN_MONTH).fill(false) as boolean[];

export default function LeagueDetailScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();

  // Auto highlight today's day (0-based). For day 14 -> 13.
  const todayIndex = new Date().getDate() - 1;

  const [members, setMembers] = useState<Member[]>([
    {
      id: "a",
      name: "User A",
      subtitle: "Sport",
      colorLight: "#9AE6B4",
      colorDark: "#2F855A",
      days: makeDays(),
    },
    {
      id: "b",
      name: "User B",
      subtitle: "Sport",
      colorLight: "#B794F4",
      colorDark: "#6B46C1",
      days: makeDays(),
    },
    {
      id: "c",
      name: "User C",
      subtitle: "Sport",
      colorLight: "#FEB2B2",
      colorDark: "#C53030",
      days: makeDays(),
    },
    {
      id: "d",
      name: "User D",
      subtitle: "Sport",
      colorLight: "#FBD38D",
      colorDark: "#C05621",
      days: makeDays(),
    },
    {
      id: "e",
      name: "User E",
      subtitle: "Sport",
      colorLight: "#90CDF4",
      colorDark: "#2B6CB0",
      days: makeDays(),
    },
  ]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText type="title">League: {leagueId}</ThemedText>

        {members.map((m) => (
          <UserCard
            key={m.id}
            name={m.name}
            subtitle={m.subtitle}
            days={m.days}
            colorLight={m.colorLight}
            colorDark={m.colorDark}
            todayIndex={todayIndex}
            onToggle={(dayIndex) => {
              setMembers((prev) =>
                prev.map((x) =>
                  x.id !== m.id
                    ? x
                    : {
                        ...x,
                        days: x.days.map((v, i) => (i === dayIndex ? !v : v)),
                      }
                )
              );
            }}
          />
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },              // IMPORTANT: flex here
  scroll: { flex: 1 },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,                 // so last card isn't cut off
  },
});
