import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useAuth } from "../../../features/auth/useAuth";
import { supabase } from "../../../lib/supabase";

type Tier = "free" | "A" | "B" | "C";

export default function ChoosePlanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const uid = user?.id;

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnTo = (params.returnTo as string | undefined) ?? undefined;

  async function setPlan(tier: Tier) {
    if (!uid) return;

    try {
      setError(null);
      setSaving(true);

      // ✅ Upsert ensures the row exists; select() verifies what was saved
      const { data, error: e } = await supabase
        .from("profiles")
        .upsert({ id: uid, plan_tier: tier }, { onConflict: "id" })
        .select("plan_tier")
        .single();

      if (e) throw e;

      const saved = (data?.plan_tier ?? "free") as Tier;

      // If opened from paywall, go back (paywall should refetch on focus and exit if paid)
      if (returnTo === "paywall") {
        router.back();
        return;
      }

      // ✅ If opened from Create flow, return to leagues WITH params so it opens the form
      if (saved === "free") {
        router.replace({ pathname: "/(app)", params: { isFree: "1" } });
      } else {
        router.replace({ pathname: "/(app)", params: { planTier: saved } });
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to update plan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 20, paddingTop: 70, backgroundColor: "#0B0F14" }}>
      <Text style={{ fontSize: 34, fontWeight: "900", color: "white" }}>Choose a plan</Text>
      <Text style={{ marginTop: 10, fontSize: 16, color: "#A7B0BC" }}>
        Select Free or a paid plan (no payment yet; unlock via stored tier).
      </Text>

      {error ? <Text style={{ marginTop: 12, color: "#FCA5A5" }}>{error}</Text> : null}

      {saving ? (
        <View style={{ marginTop: 24, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10, color: "#A7B0BC" }}>Saving...</Text>
        </View>
      ) : (
        <View style={{ marginTop: 24, gap: 14 }}>
          <PlanCard title="Free" subtitle="One free league total." badge="FREE" onPress={() => setPlan("free")} />
          <PlanCard title="Plan A" subtitle="Unlocked for MVP testing." onPress={() => setPlan("A")} />
          <PlanCard title="Plan B" subtitle="Unlocked for MVP testing." onPress={() => setPlan("B")} />
          <PlanCard title="Plan C" subtitle="Unlocked for MVP testing." onPress={() => setPlan("C")} />
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
