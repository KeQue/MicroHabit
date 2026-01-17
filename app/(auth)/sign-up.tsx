import { Link } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useAuth } from "../../features/auth/useAuth";


export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

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
        onPress={async () => {
          try {
            setError(null);
            await signUp(email.trim(), password);
          } catch (e: any) {
            setError(e?.message ?? "Sign-up failed");
          }
        }}
        style={{ backgroundColor: "black", padding: 14, borderRadius: 12, alignItems: "center" }}
      >
        <Text style={{ color: "white", fontWeight: "600" }}>Sign up</Text>
      </Pressable>

      <Link href="/(auth)/sign-in" style={{ marginTop: 8 }}>
        Back to sign in
      </Link>
    </View>
  );
}
