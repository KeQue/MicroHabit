import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

export default function JoinLeagueScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <View
      style={{
        flex: 1,
        padding: 20,
        paddingTop: 70,
        backgroundColor: "#0B0F14",
      }}
    >
      <Text
        style={{
          fontSize: 28,
          fontWeight: "700",
          color: "white",
          marginBottom: 8,
        }}
      >
        Join league
      </Text>

      <Text style={{ color: "#A7B0BC", marginBottom: 24 }}>
        Paste an invite code to join a league.
      </Text>

      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="Invite code"
        placeholderTextColor="#6B7280"
        autoCapitalize="none"
        style={{
          backgroundColor: "#111827",
          color: "white",
          padding: 16,
          borderRadius: 12,
          marginBottom: 16,
        }}
      />

      <Pressable
        onPress={() => {
          // TEMP — later this will call Supabase
          router.push(`/league/${code || "example"}`);
        }}
        style={{
          padding: 16,
          borderRadius: 14,
          backgroundColor: "#1A2430",
          marginBottom: 12,
        }}
      >
        <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
          Join league
        </Text>
      </Pressable>

      <Pressable onPress={() => router.back()}>
        <Text style={{ color: "#A7B0BC" }}>Back</Text>
      </Pressable>
    </View>
  );
}
