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

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "600" }}>Sign in</Text>

      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, borderColor: "#ccc", padding: 12, borderRadius: 10 }}
      />

      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, borderColor: "#ccc", padding: 12, borderRadius: 10 }}
      />

      {error ? <Text style={{ color: "red" }}>{error}</Text> : null}

      <Pressable
        disabled={loading}
        onPress={async () => {
          try {
            setError(null);
            setLoading(true);

            await signIn(email.trim(), password);

            // Go to the leagues list route that exists
            router.replace("/(app)/league");
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

      <Link href="/(auth)/sign-up" style={{ marginTop: 8 }}>
        Create an account
      </Link>
    </View>
  );
}
