import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useAuth } from "../../../features/auth/useAuth";
import { supabase } from "../../../lib/supabase";

type Tier = "free" | "A" | "B" | "C";
type Source = "create" | "paywall";

export default function ChoosePlanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ source?: string }>();
  const source: Source = params.source === "paywall" ? "paywall" : "create";

  const { user } = useAuth();
  const uid = user?.id;

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // paywall toggle
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
        // safer default if RPC missing
        if (mounted) setPaywallEnabled(true);
      } finally {
        if (mounted) setEnabledLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const showPaidForTesting = !paywallEnabled; // toggle OFF => show A/B/C (testing)

  async function setPlan(tier: Tier) {
    try {
      setError(null);
      setSaving(true);

      // MODE 1: create flow => return selection to Leagues screen via params
      if (source === "create") {
        if (tier === "free") {
          router.replace({ pathname: "/(app)", params: { isFree: "1" } });
        } else {
          router.replace({ pathname: "/(app)", params: { planTier: tier } });
        }
        return;
      }

      // MODE 2: paywall flow => update profile plan tier
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
    if (source === "create") return "Pick a plan for the league you’re creating.";
    return "Select a plan (no payment yet; used to unlock).";
  }, [source]);

  return (
    <View style={{ flex: 1, padding: 20, paddingTop: 70, backgroundColor: "#0B0F14" }}>
      <Text style={{ fontSize: 34, fontWeight: "900", color: "white" }}>Choose a plan</Text>
      <Text style={{ marginTop: 10, fontSize: 16, color: "#A7B0BC" }}>{subtitle}</Text>

      {error ? <Text style={{ marginTop: 12, color: "#FCA5A5" }}>{error}</Text> : null}

      {(enabledLoading || saving) ? (
        <View style={{ marginTop: 24, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10, color: "#A7B0BC" }}>
            {saving ? "Saving..." : "Loading..."}
          </Text>
        </View>
      ) : (
        <View style={{ marginTop: 24, gap: 14 }}>
          <PlanCard
            title="Free"
            subtitle="One free league total."
            badge="FREE"
            onPress={() => setPlan("free")}
          />

          {showPaidForTesting ? (
            <>
              <PlanCard title="Plan A" subtitle="Unlocked while paywall is OFF." onPress={() => setPlan("A")} />
              <PlanCard title="Plan B" subtitle="Unlocked while paywall is OFF." onPress={() => setPlan("B")} />
              <PlanCard title="Plan C" subtitle="Unlocked while paywall is OFF." onPress={() => setPlan("C")} />
            </>
          ) : (
            <Text style={{ color: "#A7B0BC", marginTop: 6 }}>
              Paid plans are locked until purchase.
            </Text>
          )}
        </View>
      )}

      <Pressable onPress={() => router.back()} style={{ marginTop: 22, padding: 10 }}>
        <Text style={{ textAlign: "center", color: "#A7B0BC" }}>Cancel</Text>
      </Pressable>
    </View>
  );
}

function PlanCard({
  title,
  subtitle,
  badge,
  onPress,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: "#101826",
        borderRadius: 18,
        padding: 18,
        borderWidth: 1,
        borderColor: "#0F172A",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: "white", fontSize: 22, fontWeight: "900" }}>{title}</Text>
        {badge ? (
          <View
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: "#0B2B2B",
              borderWidth: 1,
              borderColor: "#1AAE9A",
            }}
          >
            <Text style={{ color: "#7FF3E1", fontWeight: "900" }}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={{ marginTop: 8, color: "#A7B0BC", fontSize: 14 }}>{subtitle}</Text>
    </Pressable>
  );
}
