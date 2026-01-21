import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { supabase } from "../../../lib/supabase";

type PaidPlanTier = "A" | "B" | "C";
type PlanChoice =
  | { key: "FREE"; label: "Free"; isFree: true; planTier: null }
  | { key: PaidPlanTier; label: `Plan ${PaidPlanTier}`; isFree: false; planTier: PaidPlanTier };

const PLAN_CHOICES: PlanChoice[] = [
  { key: "FREE", label: "Free", isFree: true, planTier: null },
  { key: "A", label: "Plan A", isFree: false, planTier: "A" },
  { key: "B", label: "Plan B", isFree: false, planTier: "B" },
  { key: "C", label: "Plan C", isFree: false, planTier: "C" },
];

const getMonthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export default function ChoosePlan() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [freeUsedAt, setFreeUsedAt] = useState<string | null>(null);

  // DB rule: one free ever (free_used_at not null => used)
  const freeAvailable = useMemo(() => freeUsedAt == null, [freeUsedAt]);

  // After free is used, DO NOT show the Free option at all
  const visibleChoices = useMemo(() => {
    return freeAvailable ? PLAN_CHOICES : PLAN_CHOICES.filter((c) => c.key !== "FREE");
  }, [freeAvailable]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;
        const uid = authData.user?.id;
        if (!uid) throw new Error("Not authenticated");

        const { data, error } = await supabase
          .from("profiles")
          .select("free_used_at")
          .eq("id", uid)
          .single();

        if (error) throw error;
        if (!alive) return;

        setFreeUsedAt(data?.free_used_at ?? null);
      } catch {
        // If profile fetch fails, be conservative: treat free as unavailable
        if (!alive) return;
        setFreeUsedAt("unknown");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const pick = (choice: PlanChoice) => {
    // Free selected (this should only be possible when freeAvailable is true)
    if (choice.isFree) {
      if (!freeAvailable) {
        router.replace({
          pathname: "/(app)/paywall",
          params: { reason: "free_used", monthKey: getMonthKey() },
        });
        return;
      }

      router.replace({
        pathname: "/",
        params: { isFree: "1", planTier: "" },
      });
      return;
    }

    // Paid selected (locked until Stripe)
    router.replace({
      pathname: "/(app)/paywall",
      params: { reason: "paid_not_available", planTier: choice.planTier },
    });
  };

  return (
    <View style={{ flex: 1, padding: 20, paddingTop: 70, backgroundColor: "#0B0F14" }}>
      <Text style={{ color: "white", fontSize: 28, fontWeight: "800" }}>Choose a plan</Text>

      <Text style={{ marginTop: 8, color: "#A7B0BC", fontSize: 16 }}>
        {freeAvailable
          ? "Select your Free plan (one-time) or a paid plan (locked until payment is enabled)."
          : "Free already used. Paid plans are available (payment not enabled yet)."}
      </Text>

      {loading ? (
        <View style={{ marginTop: 18 }}>
          <ActivityIndicator />
        </View>
      ) : null}

      <View style={{ marginTop: 18, gap: 12 }}>
        {visibleChoices.map((choice) => (
          <Pressable
            key={choice.key}
            onPress={() => pick(choice)}
            style={{
              padding: 16,
              borderRadius: 16,
              backgroundColor: "#111827",
              borderWidth: 1,
              borderColor: choice.key === "FREE" ? "#2DD4BF" : "#1F2937",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ color: "white", fontSize: 18, fontWeight: "800" }}>
                {choice.label}
              </Text>

              {choice.key === "FREE" ? (
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: "rgba(45, 212, 191, 0.18)",
                    borderWidth: 1,
                    borderColor: "rgba(45, 212, 191, 0.45)",
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "800", fontSize: 12 }}>FREE</Text>
                </View>
              ) : null}
            </View>

            <Text style={{ marginTop: 6, color: "#A7B0BC" }}>
              {choice.key === "FREE"
                ? "One free league total."
                : "Payment required (not enabled yet)."}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={() => router.back()} style={{ marginTop: 16, padding: 12 }}>
        <Text style={{ color: "#A7B0BC", textAlign: "center" }}>Cancel</Text>
      </Pressable>
    </View>
  );
}
