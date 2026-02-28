import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../features/auth/useAuth";
import { supabase } from "../../lib/supabase";

const INPUT_BG = "rgba(255,255,255,0.04)";
const INPUT_BORDER = "rgba(255,255,255,0.12)";
const TEXT = "#FFFFFF";
const PLACEHOLDER = "rgba(255,255,255,0.44)";

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <LinearGradient
      colors={["#08040F", "#0B0F14", "#160A2D"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.screen}
    >
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", android: undefined })}
        style={styles.flex}
      >
        <View style={styles.shell}>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>MICROHABIT</Text>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Start your first league with a real email.</Text>
          </View>

          <View style={styles.card}>
            <TextInput
              placeholder="Email"
              placeholderTextColor={PLACEHOLDER}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              style={styles.input}
            />

            <TextInput
              placeholder="Password (min 6 chars)"
              placeholderTextColor={PLACEHOLDER}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={styles.input}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              disabled={loading}
              onPress={async () => {
                try {
                  setError(null);
                  setLoading(true);

                  const e = email.trim();
                  if (!e) throw new Error("Email is required");
                  if (!password || password.length < 6) {
                    throw new Error("Password must be at least 6 characters");
                  }

                  await signUp(e, password);

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
              style={({ pressed }) => [
                styles.primaryBtn,
                loading && styles.primaryBtnDisabled,
                pressed && !loading && styles.primaryBtnPressed,
              ]}
            >
              <Text style={styles.primaryBtnText}>{loading ? "Creating..." : "Create account"}</Text>
            </Pressable>

            <Text style={styles.helperText}>
              If email confirmation is enabled, you will continue after confirming your inbox.
            </Text>

            <Link href="/(auth)/sign-in" style={styles.secondaryLink}>
              Back to sign in
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  shell: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 88,
    paddingBottom: 28,
    justifyContent: "center",
    gap: 26,
  },
  hero: {
    gap: 8,
  },
  eyebrow: {
    color: "rgba(237,231,255,0.58)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  title: {
    color: TEXT,
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  subtitle: {
    color: "rgba(237,231,255,0.74)",
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 24,
  },
  card: {
    borderRadius: 24,
    padding: 18,
    gap: 14,
    backgroundColor: "rgba(14,18,29,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  input: {
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    backgroundColor: INPUT_BG,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    color: TEXT,
    fontSize: 17,
  },
  error: {
    color: "#FF8B8B",
    fontSize: 13,
    fontWeight: "600",
  },
  primaryBtn: {
    marginTop: 2,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: "rgba(162,89,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(162,89,255,0.48)",
  },
  primaryBtnPressed: {
    backgroundColor: "rgba(162,89,255,0.26)",
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: TEXT,
    fontSize: 17,
    fontWeight: "800",
  },
  helperText: {
    color: "rgba(237,231,255,0.5)",
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 17,
    textAlign: "center",
  },
  secondaryLink: {
    marginTop: 2,
    color: "rgba(237,231,255,0.82)",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
});
