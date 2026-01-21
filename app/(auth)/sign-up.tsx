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

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "600" }}>Create account</Text>

      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, borderColor: "#ccc", padding: 12, borderRadius: 10 }}
      />

      <TextInput
        placeholder="Password (min 6 chars)"
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

            const e = email.trim();
            if (!e) throw new Error("Email is required");
            if (!password || password.length < 6) throw new Error("Password must be at least 6 characters");

            await signUp(e, password);

            // If email confirmation is ON, session may still be null here.
            const { data } = await supabase.auth.getSession();
            const hasSession = !!data.session;

            if (hasSession) {
              // Your leagues list is app/(app)/index.tsx => route "/(app)"
              router.replace("/(app)");
            } else {
              // Confirmation required: send them to sign in (or tell them to confirm email)
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

      <Link href="/(auth)/sign-in" style={{ marginTop: 8 }}>
        Back to sign in
      </Link>
    </View>
  );
}
