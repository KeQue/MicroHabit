import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";

export default function Paywall() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const reason = typeof params.reason === "string" ? params.reason : "";
  const monthKey = typeof params.monthKey === "string" ? params.monthKey : "";

  const title = reason === "free_used" ? "Payment required" : "Upgrade required";

  const subtitle =
    reason === "free_used"
      ? `You already used your free league for ${monthKey || "this month"}.`
      : "This action requires a paid plan.";

  return (
    <View style={{ flex: 1, padding: 20, paddingTop: 70, backgroundColor: "#0B0F14" }}>
      <Text style={{ color: "white", fontSize: 28, fontWeight: "900" }}>{title}</Text>
      <Text style={{ marginTop: 10, color: "#A7B0BC", fontSize: 16 }}>{subtitle}</Text>

      <View style={{ marginTop: 18, gap: 12 }}>
        <Pressable
          onPress={() => router.push("/league/choose-plan")}
          style={{
            padding: 16,
            borderRadius: 14,
            backgroundColor: "#1A2430",
            borderWidth: 1,
            borderColor: "#1F2937",
          }}
        >
          <Text style={{ color: "white", fontSize: 16, fontWeight: "800", textAlign: "center" }}>
            Choose a paid plan
          </Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={{ padding: 12 }}>
          <Text style={{ color: "#A7B0BC", textAlign: "center" }}>Back</Text>
        </Pressable>
      </View>
    </View>
  );
}
