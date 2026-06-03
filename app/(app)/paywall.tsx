import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { PAID_LEAGUES_AVAILABLE } from "../../constants/launch";
import { useAuth } from "../../features/auth/useAuth";
import { supabase } from "../../lib/supabase";

type Tier = "free" | "A" | "B" | "C";

export default function PaywallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const code = typeof params.code === "string" ? params.code : "";

  const { user } = useAuth();
  const uid = user?.id;

  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<Tier>("free");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);

      const { data, error: e, status } = await supabase
        .from("profiles")
        .select("plan_tier")
        .eq("id", uid)
        .single();

      if (e && status !== 406) throw e;

      const t = ((data?.plan_tier ?? "free") as Tier) || "free";
      setTier(t);

      if (t !== "free") {
        if (code) {
          router.replace({
            pathname: "/(app)/league/join",
            params: { code },
          });
        } else {
          router.back();
        }
        return;
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to load plan");
    } finally {
      setLoading(false);
    }
  }, [uid, router, code]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0B0F14",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  const onPrimaryPress = () => {
    if (PAID_LEAGUES_AVAILABLE) {
      router.push({
        pathname: "/(app)/league/choose-plan",
        params: code ? { source: "paywall", code } : { source: "paywall" },
      });
      return;
    }

    router.replace("/(app)");
  };

  return (
    <View style={{ flex: 1, padding: 20, paddingTop: 70, backgroundColor: "#0B0F14" }}>
      <Text style={{ fontSize: 34, fontWeight: "900", color: "white" }}>Upgrade required</Text>

      <Text style={{ marginTop: 10, fontSize: 16, color: "#A7B0BC" }}>
        Paid commitment leagues are coming soon. This App Store version supports free leagues.
      </Text>

      {error ? <Text style={{ marginTop: 12, color: "#FCA5A5" }}>{error}</Text> : null}

      <Pressable
        onPress={onPrimaryPress}
        accessibilityRole="button"
        accessibilityLabel={PAID_LEAGUES_AVAILABLE ? "Choose a paid plan" : "Create a free league"}
        style={{
          marginTop: 24,
          backgroundColor: "#101826",
          padding: 16,
          borderRadius: 16,
          alignItems: "center",
          borderWidth: 1,
          borderColor: "#0F172A",
        }}
      >
        <Text style={{ color: "white", fontSize: 18, fontWeight: "800" }}>
          {PAID_LEAGUES_AVAILABLE ? "Choose a paid plan" : "Create a free league"}
        </Text>
      </Pressable>

      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={{ marginTop: 20, padding: 10 }}>
        <Text style={{ textAlign: "center", color: "#A7B0BC" }}>Back</Text>
      </Pressable>

      <Text style={{ marginTop: 16, color: "#334155" }}>Current tier: {tier}</Text>
    </View>
  );
}
