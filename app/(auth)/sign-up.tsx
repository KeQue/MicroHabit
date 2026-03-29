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
import { trackEvent } from "../../features/analytics";
import { useAuth } from "../../features/auth/useAuth";
import { supabase } from "../../lib/supabase";

const INPUT_BG = "rgba(255,255,255,0.04)";
const INPUT_BORDER = "rgba(255,255,255,0.12)";
const TEXT = "#FFFFFF";
const PLACEHOLDER = "rgba(255,255,255,0.44)";

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp, signInWithProvider } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "apple" | null>(null);

  const handleSocialSignIn = async (provider: "google" | "apple") => {
    try {
      setError(null);
      setSocialLoading(provider);
      await trackEvent("sign_up_started", { method: provider });
      const result = await signInWithProvider(provider);
      if (result === "signed-in") {
        await trackEvent("sign_up_completed", { method: provider });
        router.replace("/(app)");
      }
    } catch (e: any) {
      setError(e?.message ?? "Social sign-in failed");
    } finally {
      setSocialLoading(null);
    }
  };

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
            <View style={styles.socialStack}>
              <Pressable
                disabled={loading || !!socialLoading}
                onPress={() => void handleSocialSignIn("google")}
                style={({ pressed }) => [
                  styles.socialBtn,
                  pressed && !socialLoading && !loading && styles.socialBtnPressed,
                  socialLoading === "google" && styles.socialBtnDisabled,
                ]}
              >
                <Text style={styles.socialBtnText}>
                  {socialLoading === "google" ? "Connecting Google..." : "Continue with Google"}
                </Text>
              </Pressable>

              {Platform.OS === "ios" ? (
                <Pressable
                  disabled={loading || !!socialLoading}
                  onPress={() => void handleSocialSignIn("apple")}
                  style={({ pressed }) => [
                    styles.socialBtn,
                    pressed && !socialLoading && !loading && styles.socialBtnPressed,
                    socialLoading === "apple" && styles.socialBtnDisabled,
                  ]}
                >
                  <Text style={styles.socialBtnText}>
                    {socialLoading === "apple" ? "Connecting Apple..." : "Continue with Apple"}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR CREATE WITH EMAIL</Text>
              <View style={styles.dividerLine} />
            </View>

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
              disabled={loading || !!socialLoading}
              onPress={async () => {
                try {
                  setError(null);
                  setLoading(true);

                  const e = email.trim();
                  if (!e) throw new Error("Email is required");
                  if (!password || password.length < 6) {
                    throw new Error("Password must be at least 6 characters");
                  }

                  await trackEvent("sign_up_started", { email_domain: e.split("@")[1] ?? null });
                  await signUp(e, password);
                  await trackEvent("sign_up_completed");

                  const { data } = await supabase.auth.getSession();
                  const hasSession = !!data.session;

                  if (hasSession) {
                    router.replace("/(app)");
                  } else {
                    router.replace({
                      pathname: "/(auth)/check-email",
                      params: { email: e },
                    });
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
              Email sign-up keeps the inbox verification flow, so you can confirm ownership before
              continuing.
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
  socialStack: {
    gap: 10,
  },
  socialBtn: {
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 14,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  socialBtnPressed: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  socialBtnDisabled: {
    opacity: 0.7,
  },
  socialBtnText: {
    color: TEXT,
    fontSize: 16,
    fontWeight: "700",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  dividerText: {
    color: "rgba(237,231,255,0.44)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
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
