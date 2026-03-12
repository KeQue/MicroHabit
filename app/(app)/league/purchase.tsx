import { getLeague, type League } from "@/features/leagues/api";
import { getCommitmentPlan, getPlanFullName, type PlanTier } from "@/features/leagues/plans";
import { getMyLeaguePaymentStatus, getPaywallEnabled, verifyLeaguePurchase } from "@/features/payments";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type Params = {
  leagueId?: string;
  next?: string;
};

function normalizeError(error: unknown) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  const value = error as { message?: string; hint?: string };
  return value.message || value.hint || "Unknown error";
}

export default function PurchaseLeagueScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const leagueId = typeof params.leagueId === "string" ? params.leagueId : "";
  const next = typeof params.next === "string" ? params.next : "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywallEnabled, setPaywallEnabled] = useState(true);
  const [league, setLeague] = useState<League | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!leagueId) {
        if (mounted) {
          setError("League is missing");
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const [leagueData, memberPaymentStatus, enabled] = await Promise.all([
          getLeague(leagueId),
          getMyLeaguePaymentStatus(leagueId),
          getPaywallEnabled(),
        ]);

        if (!mounted) return;

        setLeague(leagueData);
        setPaymentStatus(memberPaymentStatus);
        setPaywallEnabled(enabled);
      } catch (err) {
        if (!mounted) return;
        setError(normalizeError(err));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [leagueId]);

  const plan = useMemo(() => {
    const tier = league?.plan_tier;
    if (tier === "A" || tier === "B" || tier === "C") return getCommitmentPlan(tier as PlanTier);
    return null;
  }, [league]);

  const isPaidOrFree = paymentStatus === "paid" || paymentStatus === "free";
  const purchaseBlockedOnWeb = Platform.OS === "web";

  async function onConfirmPurchase() {
    if (!league || !plan || !leagueId || submitting) return;

    try {
      setSubmitting(true);
      setError(null);

      if (purchaseBlockedOnWeb) {
        throw new Error("Paid entry is only available in iOS and Android app builds.");
      }

      if (paywallEnabled) {
        throw new Error("Real store billing still needs App Store and Play Billing product setup. Disable the paywall toggle to simulate purchases in testing.");
      }

      const transactionId = `test-${leagueId}-${Date.now()}`;

      await verifyLeaguePurchase({
        leagueId,
        storePlatform: Platform.OS === "ios" ? "ios" : "android",
        storeProductId: `commito.${plan.tier.toLowerCase()}.entry`,
        transactionId,
        amountCents: plan.priceEuros * 100,
        verificationStatus: "verified",
        rawPayload: {
          mode: "test",
          planTier: plan.tier,
        },
      });

      setPaymentStatus("paid");

      if (next) {
        router.replace(next as never);
        return;
      }

      router.replace(`/(app)/league/${leagueId}`);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  function onContinue() {
    if (!leagueId) return;
    if (next) {
      router.replace(next as never);
      return;
    }
    router.replace(`/(app)/league/${leagueId}`);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Confirm league entry</Text>
      <Text style={styles.subtitle}>
        This is a per-league purchase. Commito records league revenue and funds rewards and charity from that revenue.
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {league ? (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>LEAGUE ENTRY</Text>
          <Text style={styles.cardTitle}>{league.name ?? "League"}</Text>
          {league.activity ? <Text style={styles.cardActivity}>{league.activity}</Text> : null}
          <Text style={styles.cardMeta}>
            {plan ? getPlanFullName(plan.tier) : "Commitment league"}
          </Text>
          {plan ? <Text style={styles.cardPrice}>{plan.currencySymbol}{plan.priceEuros} per person</Text> : null}
          {plan?.minPlayers ? (
            <Text style={styles.cardHighlight}>
              Reward unlocks at {plan.minPlayers} paid players. Cap: {plan.maxPlayers ?? 20} players.
            </Text>
          ) : (
            <Text style={styles.cardHighlight}>Cap: {plan?.maxPlayers ?? 20} players.</Text>
          )}
          {plan ? <Text style={styles.cardNote}>{plan.summary}</Text> : null}
          {plan?.secondarySummary ? <Text style={styles.cardNote}>{plan.secondarySummary}</Text> : null}
          {plan?.purchaseNote ? <Text style={styles.cardNote}>{plan.purchaseNote}</Text> : null}
        </View>
      ) : null}

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>MVP billing setup</Text>
        <Text style={styles.infoText}>United States only at launch.</Text>
        <Text style={styles.infoText}>No wallet. No withdrawals. Rewards are manual first.</Text>
        <Text style={styles.infoText}>Bigger leagues unlock bigger rewards.</Text>
        <Text style={styles.infoText}>
          Web stays view-only. Paid entry is handled in native app builds.
        </Text>
      </View>

      {isPaidOrFree ? (
        <Pressable onPress={onContinue} style={[styles.primaryBtn, styles.primaryBtnReady]}>
          <Text style={styles.primaryText}>Continue to league</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={onConfirmPurchase}
          disabled={submitting}
          style={[
            styles.primaryBtn,
            submitting && styles.primaryBtnDisabled,
            !paywallEnabled && !purchaseBlockedOnWeb && styles.primaryBtnReady,
          ]}
        >
          <Text style={styles.primaryText}>
            {submitting ? "Verifying purchase..." : paywallEnabled ? "Store billing not configured yet" : "Confirm test purchase"}
          </Text>
        </Pressable>
      )}

      <Text style={styles.footnote}>
        {paywallEnabled
          ? "Production mode expects real App Store and Play Billing verification."
          : "Testing mode simulates a verified store purchase and marks your membership as paid."}
      </Text>

      <Pressable onPress={() => router.back()} style={styles.secondaryBtn}>
        <Text style={styles.secondaryText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
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
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B0F14",
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
  errorBox: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#2A0E0E",
    borderWidth: 1,
    borderColor: "#7F1D1D",
  },
  errorText: {
    color: "#FCA5A5",
    lineHeight: 20,
  },
  card: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "#101826",
    gap: 6,
  },
  eyebrow: {
    color: "rgba(237,231,255,0.48)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  cardTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "800",
  },
  cardActivity: {
    color: "#C8D0DB",
    fontSize: 15,
  },
  cardMeta: {
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: "700",
  },
  cardPrice: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
  },
  cardHighlight: {
    color: "#FCD34D",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  cardNote: {
    color: "#A7B0BC",
    lineHeight: 20,
  },
  infoCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    backgroundColor: "rgba(255,255,255,0.03)",
    gap: 6,
  },
  infoTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
  },
  infoText: {
    color: "#A7B0BC",
    lineHeight: 20,
  },
  primaryBtn: {
    marginTop: 4,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(162,89,255,0.4)",
    backgroundColor: "#182131",
    alignItems: "center",
  },
  primaryBtnReady: {
    backgroundColor: "rgba(162,89,255,0.18)",
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryText: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  footnote: {
    color: "#718096",
    lineHeight: 20,
  },
  secondaryBtn: {
    paddingVertical: 8,
  },
  secondaryText: {
    color: "#A7B0BC",
    textAlign: "center",
    fontSize: 16,
  },
});
