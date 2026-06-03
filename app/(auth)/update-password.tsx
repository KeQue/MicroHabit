import { useRouter } from "expo-router";
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

const INPUT_BG = "rgba(255,255,255,0.04)";
const INPUT_BORDER = "rgba(255,255,255,0.12)";
const TEXT = "#FFFFFF";
const PLACEHOLDER = "rgba(255,255,255,0.44)";

export default function UpdatePasswordScreen() {
  const router = useRouter();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
            <Text style={styles.eyebrow}>COMMITO</Text>
            <Text style={styles.title}>Choose a new password</Text>
            <Text style={styles.subtitle}>Use at least 6 characters.</Text>
          </View>

          <View style={styles.card}>
            <TextInput
              placeholder="New password"
              placeholderTextColor={PLACEHOLDER}
              secureTextEntry
              accessibilityLabel="New password"
              textContentType="newPassword"
              value={password}
              onChangeText={setPassword}
              style={styles.input}
            />

            <TextInput
              placeholder="Confirm password"
              placeholderTextColor={PLACEHOLDER}
              secureTextEntry
              accessibilityLabel="Confirm password"
              textContentType="newPassword"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              style={styles.input}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Update password"
              accessibilityState={{ disabled: loading }}
              onPress={async () => {
                try {
                  setError(null);
                  setLoading(true);

                  if (!password || password.length < 6) {
                    throw new Error("Password must be at least 6 characters");
                  }
                  if (password !== confirmPassword) {
                    throw new Error("Passwords do not match");
                  }

                  await updatePassword(password);
                  router.replace({
                    pathname: "/(auth)/sign-in",
                    params: { message: "Password updated. Sign in with your new password." },
                  });
                } catch (e: any) {
                  setError(e?.message ?? "Could not update password");
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
              <Text style={styles.primaryBtnText}>
                {loading ? "Saving..." : "Update password"}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  shell: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 88,
    paddingBottom: 28,
    justifyContent: "center",
    gap: 26,
  },
  hero: { gap: 8 },
  eyebrow: {
    color: "rgba(237,231,255,0.58)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  title: {
    color: TEXT,
    fontSize: 36,
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
});
