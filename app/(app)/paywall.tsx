import { getPaywallEnabled } from "@/features/payments";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

export default function PaywallScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [paywallEnabled, setPaywallEnabled] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setPaywallEnabled(await getPaywallEnabled());
    } finally {
      setLoading(false);
    }
  }, []);

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

  return (
    <View style={{ flex: 1, padding: 20, paddingTop: 70, backgroundColor: "#0B0F14" }}>
      <Text style={{ fontSize: 34, fontWeight: "900", color: "white" }}>Store-billed entry</Text>

      <Text style={{ marginTop: 10, fontSize: 16, color: "#A7B0BC", lineHeight: 24 }}>
        Commito uses per-league purchases on iOS and Android. There is no wallet and no user-to-user transfer.
      </Text>

      <View
        style={{
          marginTop: 18,
          padding: 16,
          borderRadius: 16,
          backgroundColor: "#101826",
          borderWidth: 1,
          borderColor: "#0F172A",
          gap: 8,
        }}
      >
        <Text style={{ color: "white", fontSize: 17, fontWeight: "800" }}>
          Friendly $5 - Competitive $10 - Elite $20
        </Text>
        <Text style={{ color: "#A7B0BC", lineHeight: 20 }}>
          Pick a commitment level first. Payment is attached to each league entry, not your whole account.
        </Text>
        <Text style={{ color: "#94A3B8", lineHeight: 20 }}>
          Bigger leagues unlock bigger rewards.
        </Text>
        <Text style={{ color: "#64748B", lineHeight: 20 }}>
          {paywallEnabled
            ? "Production mode expects real App Store and Play Billing products."
            : "Testing mode simulates purchases after you create or join a paid league."}
        </Text>
      </View>

      <Pressable
        onPress={() => router.replace("/(app)/league/choose-plan")}
        style={{
          marginTop: 24,
          backgroundColor: "rgba(162,89,255,0.18)",
          padding: 16,
          borderRadius: 16,
          alignItems: "center",
          borderWidth: 1,
          borderColor: "rgba(162,89,255,0.4)",
        }}
      >
        <Text style={{ color: "white", fontSize: 18, fontWeight: "800" }}>Choose a commitment plan</Text>
      </Pressable>

      <Pressable onPress={() => router.back()} style={{ marginTop: 20, padding: 10 }}>
        <Text style={{ textAlign: "center", color: "#A7B0BC" }}>Back</Text>
      </Pressable>
    </View>
  );
}
