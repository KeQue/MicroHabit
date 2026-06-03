import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { PAID_LEAGUES_AVAILABLE } from "../../../constants/launch";
import { PLAN_COPY, type PlanTier } from "../../../constants/plans";
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

  async function setPlan(tier: Tier) {
    try {
      setError(null);
      setSaving(true);

      if (tier !== "free" && !PAID_LEAGUES_AVAILABLE) {
        throw new Error("Paid leagues are coming soon in the next version.");
      }

      if (source === "create") {
        if (tier === "free") {
          router.replace({ pathname: "/(app)", params: { isFree: "1" } });
        } else {
          router.replace({ pathname: "/(app)", params: { planTier: tier } });
        }
        return;
      }

      if (!uid) throw new Error("Not authenticated");

      const { error: e } = await supabase
        .from("profiles")
        .update({ plan_tier: tier })
        .eq("id", uid);

      if (e) throw e;

      router.back();
    } catch (err: any) {
      setError(err?.message ?? "Failed to update plan");
    } finally {
      setSaving(false);
    }
  }

  const subtitle = useMemo(() => {
    if (!PAID_LEAGUES_AVAILABLE) {
      return "Start with a free league and build consistency with friends.";
    }

    if (source === "create") {
      return "Pick the kind of league you want to start.";
    }
    return "Choose the plan that unlocks your next league tier.";
  }, [source]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Choose a plan</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {saving ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Saving...</Text>
        </View>
      ) : (
        <View style={styles.list}>
          <PlanCard
            title="Free"
            subtitle="Start with one league and keep the habit simple."
            badge="FREE"
            accent="free"
            onPress={() => setPlan("free")}
          />

          {PAID_LEAGUES_AVAILABLE ? (
            <>
              <PlanCard
                title={PLAN_COPY.A.name}
                price={PLAN_COPY.A.price}
                subtitle={PLAN_COPY.A.subtitle}
                example={PLAN_COPY.A.example}
                accent="plus"
                onPress={() => setPlan("A")}
              />
              <PlanCard
                title={PLAN_COPY.B.name}
                price={PLAN_COPY.B.price}
                subtitle={PLAN_COPY.B.subtitle}
                example={PLAN_COPY.B.example}
                accent="circle"
                onPress={() => setPlan("B")}
              />
              <PlanCard
                title={PLAN_COPY.C.name}
                price={PLAN_COPY.C.price}
                subtitle={PLAN_COPY.C.subtitle}
                example={PLAN_COPY.C.example}
                accent="team"
                onPress={() => setPlan("C")}
              />
            </>
          ) : null}
        </View>
      )}

      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Cancel plan selection"
        style={styles.cancelBtn}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

function PlanCard({
  title,
  price,
  subtitle,
  example,
  badge,
  accent,
  disabled = false,
  onPress,
}: {
  title: string;
  price?: string;
  subtitle: string;
  example?: string;
  badge?: string;
  accent: "free" | "plus" | "circle" | "team";
  disabled?: boolean;
  onPress: () => void;
}) {
  const accentMap = {
    free: {
      border: "rgba(41,208,171,0.34)",
      bg: "rgba(14,48,42,0.45)",
      badgeBg: "rgba(10,55,48,0.9)",
      badgeBorder: "rgba(41,208,171,0.72)",
      badgeText: "#8FF9E7",
    },
    plus: {
      border: "rgba(162,89,255,0.26)",
      bg: "rgba(25,17,44,0.82)",
      badgeBg: "rgba(162,89,255,0.12)",
      badgeBorder: "rgba(162,89,255,0.34)",
      badgeText: "#D8C0FF",
    },
    circle: {
      border: "rgba(96,165,250,0.24)",
      bg: "rgba(17,24,39,0.82)",
      badgeBg: "rgba(96,165,250,0.12)",
      badgeBorder: "rgba(96,165,250,0.3)",
      badgeText: "#BFDBFE",
    },
    team: {
      border: "rgba(245,158,11,0.24)",
      bg: "rgba(28,21,12,0.72)",
      badgeBg: "rgba(245,158,11,0.12)",
      badgeBorder: "rgba(245,158,11,0.28)",
      badgeText: "#FCD38D",
    },
  } as const;

  const colors = accentMap[accent];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${title}${price ? `, ${price}` : ""}. ${subtitle}${example ? `. ${example}` : ""}`}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
        },
        disabled && styles.cardDisabled,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle}>{title}</Text>
        {badge ? (
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
        ) : null}
      </View>
      {price ? <Text style={styles.cardPrice}>{price}</Text> : null}
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
      {example ? <Text style={styles.cardExample}>{example}</Text> : null}
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
  cardDisabled: {
    opacity: 0.58,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  cardSubtitle: {
    marginTop: 9,
    color: "#C0C8D6",
    fontSize: 15,
    lineHeight: 22,
  },
  cardPrice: {
    marginTop: 8,
    color: "white",
    fontSize: 16,
    fontWeight: "800",
  },
  cardExample: {
    marginTop: 8,
    color: "rgba(237,231,255,0.7)",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  cardHint: {
    marginTop: 12,
    color: "rgba(237,231,255,0.5)",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
