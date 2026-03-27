import { isCurrentUserAdmin } from "@/features/auth/admin";
import {
  getLeaguesAwaitingCompletion,
  getMonthlyCharityTotals,
  getPendingRewardIssuances,
  type LeagueAwaitingCompletion,
  type MonthlyCharityTotal,
  type PendingRewardIssuance,
} from "@/features/reports";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

function formatMoney(cents: number | null | undefined) {
  const value = Math.max(cents ?? 0, 0) / 100;
  return `$${value.toFixed(0)}`;
}

function normalizeErr(e: unknown) {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  const value = e as { message?: string; hint?: string };
  return value.message || value.hint || "Unknown error";
}

export default function ReportsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingRewards, setPendingRewards] = useState<PendingRewardIssuance[]>([]);
  const [charityTotals, setCharityTotals] = useState<MonthlyCharityTotal[]>([]);
  const [awaitingCompletion, setAwaitingCompletion] = useState<LeagueAwaitingCompletion[]>([]);

  const load = useCallback(async () => {
    try {
      setError(null);

      const admin = await isCurrentUserAdmin();
      setIsAdmin(admin);

      if (!admin) {
        setPendingRewards([]);
        setCharityTotals([]);
        setAwaitingCompletion([]);
        return;
      }

      const [rewards, charity, completion] = await Promise.all([
        getPendingRewardIssuances(),
        getMonthlyCharityTotals(),
        getLeaguesAwaitingCompletion(),
      ]);
      setPendingRewards(rewards);
      setCharityTotals(charity);
      setAwaitingCompletion(completion);
    } catch (e) {
      setError(normalizeErr(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
    >
      <Text style={styles.title}>League reports</Text>
      <Text style={styles.subtitle}>Manual ops for rewards, charity totals, and leagues nearing settlement.</Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!loading && !isAdmin ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            This screen is only available to platform admins.
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
        </View>
      ) : isAdmin ? (
        <>
          <Section title="Pending rewards">
            {pendingRewards.length === 0 ? (
              <MutedText>No reward issuances are pending.</MutedText>
            ) : (
              pendingRewards.map((item) => (
                <View key={item.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{item.league_name ?? "League"}</Text>
                  <Text style={styles.cardMeta}>{item.month_key ?? "No month"} - {formatMoney(item.reward_value_cents)}</Text>
                  <Text style={styles.cardSub}>Reward type: {item.reward_type}</Text>
                </View>
              ))
            )}
          </Section>

          <Section title="Monthly charity totals">
            {charityTotals.length === 0 ? (
              <MutedText>No completed leagues yet.</MutedText>
            ) : (
              charityTotals.map((item) => (
                <View key={item.month_key} style={styles.card}>
                  <Text style={styles.cardTitle}>{item.month_key}</Text>
                  <Text style={styles.cardMeta}>{formatMoney(item.charity_amount_cents)}</Text>
                  <Text style={styles.cardSub}>{item.leagues_count} completed leagues</Text>
                </View>
              ))
            )}
          </Section>

          <Section title="Awaiting completion">
            {awaitingCompletion.length === 0 ? (
              <MutedText>No active leagues are awaiting completion.</MutedText>
            ) : (
              awaitingCompletion.map((item) => (
                <View key={item.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{item.name ?? "League"}</Text>
                  <Text style={styles.cardMeta}>
                    {item.month_key ?? "No month"} - {item.plan_tier ?? "Free"} - {item.players_count} players
                  </Text>
                  <Text style={styles.cardSub}>
                    Reward {formatMoney(item.prize_amount_cents)} - Charity {formatMoney(item.charity_amount_cents)}
                  </Text>
                </View>
              ))
            )}
          </Section>
        </>
      ) : null}

      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function MutedText({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0B0F14",
  },
  content: {
    padding: 20,
    paddingTop: 70,
    paddingBottom: 32,
    gap: 20,
  },
  title: {
    color: "white",
    fontSize: 34,
    fontWeight: "900",
  },
  subtitle: {
    color: "#A7B0BC",
    fontSize: 16,
    lineHeight: 23,
  },
  loadingWrap: {
    marginTop: 24,
    alignItems: "center",
  },
  errorBox: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#2A0E0E",
    borderWidth: 1,
    borderColor: "#7F1D1D",
  },
  errorText: {
    color: "#FCA5A5",
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
  },
  card: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "#101826",
    gap: 4,
  },
  cardTitle: {
    color: "white",
    fontSize: 15,
    fontWeight: "800",
  },
  cardMeta: {
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: "700",
  },
  cardSub: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 19,
  },
  muted: {
    color: "#94A3B8",
    lineHeight: 20,
  },
  backBtn: {
    paddingVertical: 8,
  },
  backText: {
    color: "#A7B0BC",
    textAlign: "center",
    fontSize: 16,
  },
});
