import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { PLAN_ORDER, getCommitmentPlan, type PlanTier } from "../../../features/leagues/plans";
import { useAuth } from "../../../features/auth/useAuth";
import { supabase } from "../../../lib/supabase";

type Tier = "free" | PlanTier;
type Source = "create" | "paywall";

export default function ChoosePlanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ source?: string }>();
  const source: Source = params.source === "paywall" ? "paywall" : "create";

  const { user } = useAuth();
  const uid = user?.id;

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabledLoading, setEnabledLoading] = useState(true);
  const [paywallEnabled, setPaywallEnabled] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setEnabledLoading(true);
        const { data, error: e } = await supabase.rpc("get_paywall_enabled");
        if (e) throw e;
        if (!mounted) return;
        setPaywallEnabled(Boolean(data));
      } catch {
        if (mounted) setPaywallEnabled(true);
      } finally {
        if (mounted) setEnabledLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const showPaidForTesting = !paywallEnabled;

  async function setPlan(tier: Tier) {
    try {
      setError(null);
      setSaving(true);

      if (source === "create") {
        if (tier === "free") {
          router.replace({ pathname: "/(app)", params: { isFree: "1" } });
        } else {
          router.replace({ pathname: "/(app)", params: { planTier: tier } });
        }
        return;
      }

      if (!uid) throw new Error("Not authenticated");

      const { error: e } = await supabase.from("profiles").update({ plan_tier: tier }).eq("id", uid);
      if (e) throw e;

      router.back();
    } catch (err: any) {
      setError(err?.message ?? "Failed to update plan");
    } finally {
      setSaving(false);
    }
  }

  const subtitle = useMemo(() => {
    if (source === "create") return "Choose your commitment level.";
    return "Pick the level you want to continue with after your trial month.";
  }, [source]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      bounces
    >
      <Text style={styles.title}>Choose your commitment level</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <Text style={styles.helper}>Leagues run for 30 days</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {enabledLoading || saving ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>{saving ? "Saving..." : "Loading..."}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {showPaidForTesting ? (
            PLAN_ORDER.map((tier) => {
              const plan = getCommitmentPlan(tier);
              return (
                <PlanCard
                  key={tier}
                  title={plan.fullName}
                  price={`\u20AC${plan.priceEuros} per person`}
                  message={plan.message}
                  quickDifference={plan.quickDifference}
                  summary={plan.summary}
                  secondarySummary={plan.secondarySummary}
                  previewTitle={plan.previewTitle}
                  preview={plan.preview}
                  badge={plan.cta}
                  accent={tier}
                  featured={plan.featured}
                  onPress={() => setPlan(tier)}
                />
              );
            })
          ) : (
            <Text style={styles.lockedText}>
              Payments are not wired yet. Disable the paywall toggle to test Friendly, Competitive, and Elite.
            </Text>
          )}
        </View>
      )}

      <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

function PlanCard({
  title,
  price,
  message,
  quickDifference,
  summary,
  secondarySummary,
  previewTitle,
  preview,
  badge,
  accent,
  featured,
  onPress,
}: {
  title: string;
  price: string;
  message: string;
  quickDifference: string;
  summary: string;
  secondarySummary?: string;
  previewTitle?: string;
  preview?: string;
  badge: string;
  accent: PlanTier;
  featured?: boolean;
  onPress: () => void;
}) {
  const accentMap = {
    A: {
      border: "rgba(83,211,169,0.34)",
      bg: "rgba(8,45,39,0.72)",
      badgeBg: "rgba(83,211,169,0.12)",
      badgeBorder: "rgba(83,211,169,0.34)",
      badgeText: "#9AF4D7",
      glow: "rgba(83,211,169,0.12)",
    },
    B: {
      border: "rgba(96,165,250,0.28)",
      bg: "rgba(17,24,39,0.9)",
      badgeBg: "rgba(96,165,250,0.14)",
      badgeBorder: "rgba(96,165,250,0.38)",
      badgeText: "#BFDBFE",
      glow: "rgba(96,165,250,0.2)",
    },
    C: {
      border: "rgba(248,113,113,0.26)",
      bg: "rgba(43,17,17,0.82)",
      badgeBg: "rgba(248,113,113,0.12)",
      badgeBorder: "rgba(248,113,113,0.3)",
      badgeText: "#FECACA",
      glow: "rgba(248,113,113,0.12)",
    },
  } as const;

  const colors = accentMap[accent];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
        },
        featured && {
          borderWidth: 1.5,
          shadowColor: colors.glow,
          shadowOpacity: 0.35,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        },
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardPrice}>{price}</Text>
        </View>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: colors.badgeBg,
              borderColor: colors.badgeBorder,
            },
          ]}
        >
          <Text style={[styles.badgeText, { color: colors.badgeText }]}>{badge}</Text>
        </View>
      </View>

      <Text style={styles.cardMessage}>{message}</Text>
      <Text style={styles.quickDifference}>{quickDifference}</Text>

      <View style={styles.summaryBlock}>
        <Text style={styles.cardSummary}>{summary}</Text>
        {secondarySummary ? <Text style={styles.cardSummary}>{secondarySummary}</Text> : null}
      </View>

      {preview ? (
        <View style={styles.previewBlock}>
          {previewTitle ? <Text style={styles.previewTitle}>{previewTitle}</Text> : null}
          <Text style={styles.cardPreview}>{preview}</Text>
        </View>
      ) : null}

      <Text style={styles.cardHint}>Tap to continue</Text>
    </Pressable>
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
    paddingBottom: 36,
  },
  title: {
    fontSize: 36,
    fontWeight: "900",
    color: "white",
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 17,
    lineHeight: 23,
    color: "#A7B0BC",
  },
  helper: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 19,
    color: "#718096",
    fontWeight: "600",
  },
  error: {
    marginTop: 12,
    color: "#FCA5A5",
    fontWeight: "600",
  },
  loadingWrap: {
    marginTop: 28,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#A7B0BC",
  },
  list: {
    marginTop: 28,
    gap: 14,
  },
  lockedText: {
    color: "#A7B0BC",
    marginTop: 6,
    lineHeight: 20,
  },
  cancelBtn: {
    marginTop: 22,
    padding: 10,
  },
  cancelText: {
    textAlign: "center",
    color: "#A7B0BC",
    fontSize: 17,
    fontWeight: "500",
  },
  card: {
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
  },
  cardPressed: {
    opacity: 0.92,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitleWrap: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  cardTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  cardPrice: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "700",
  },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
  },
  badgeText: {
    fontWeight: "900",
    letterSpacing: 0.3,
    fontSize: 12,
  },
  cardMessage: {
    marginTop: 14,
    color: "#F8FAFC",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
  },
  quickDifference: {
    marginTop: 8,
    color: "#CBD5E1",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  summaryBlock: {
    marginTop: 10,
    gap: 4,
  },
  cardSummary: {
    color: "#C0C8D6",
    fontSize: 14,
    lineHeight: 20,
  },
  previewBlock: {
    marginTop: 12,
    gap: 2,
  },
  previewTitle: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  cardPreview: {
    color: "#E2E8F0",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  cardHint: {
    marginTop: 14,
    color: "rgba(237,231,255,0.5)",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
