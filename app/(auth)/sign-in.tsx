import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useAuth } from "../../features/auth/useAuth";

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const INPUT_BG = "rgba(255,255,255,0.06)";
  const INPUT_BORDER = "rgba(255,255,255,0.16)";
  const TEXT = "#FFFFFF";
  const PLACEHOLDER = "rgba(255,255,255,0.55)";

  const inputStyle = {
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    backgroundColor: INPUT_BG,
    padding: 12,
    borderRadius: 10,
    color: TEXT,
  } as const;

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "600", color: TEXT }}>Sign in</Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor={PLACEHOLDER}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={inputStyle}
      />

      <TextInput
        placeholder="Password"
        placeholderTextColor={PLACEHOLDER}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={inputStyle}
      />

      {error ? <Text style={{ color: "#FF6B6B" }}>{error}</Text> : null}

      <Pressable
        disabled={loading}
        onPress={async () => {
          try {
            setError(null);
            setLoading(true);

            const e = email.trim();
            if (!e) throw new Error("Email is required");
            if (!password) throw new Error("Password is required");

            await signIn(e, password);

            // Leagues list is app/(app)/index.tsx => route "/(app)"
            router.replace("/(app)");
          } catch (e: any) {
            setError(e?.message ?? "Sign-in failed");
          } finally {
            setLoading(false);
          }
        }}
        style={{
          backgroundColor: "black",
          padding: 14,
          borderRadius: 12,
          alignItems: "center",
          opacity: loading ? 0.6 : 1,
        }}
      >
        <Text style={{ color: "white", fontWeight: "600" }}>
          {loading ? "Signing in..." : "Sign in"}
        </Text>
      </Pressable>

      <Link href="/(auth)/sign-up" style={{ marginTop: 8, color: "rgba(255,255,255,0.85)" }}>
        Create an account
      </Link>
    </View>
  );
}