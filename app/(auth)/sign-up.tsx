import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useAuth } from "../../features/auth/useAuth";
import { supabase } from "../../lib/supabase";

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();

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
      <Text style={{ fontSize: 22, fontWeight: "600", color: TEXT }}>Create account</Text>

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
        placeholder="Password (min 6 chars)"
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
            if (!password || password.length < 6)
              throw new Error("Password must be at least 6 characters");

            await signUp(e, password);

            // If email confirmation is ON, session may still be null here.
            const { data } = await supabase.auth.getSession();
            const hasSession = !!data.session;

            if (hasSession) {
              router.replace("/(app)");
            } else {
              router.replace("/(auth)/sign-in");
            }
          } catch (e: any) {
            setError(e?.message ?? "Sign-up failed");
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
          {loading ? "Creating..." : "Sign up"}
        </Text>
      </Pressable>

      <Link href="/(auth)/sign-in" style={{ marginTop: 8, color: "rgba(255,255,255,0.85)" }}>
        Back to sign in
      </Link>
    </View>
  );
}