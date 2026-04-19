import { Link, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../features/auth/useAuth";

const TEXT = "#FFFFFF";

export default function CheckEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { resendSignUpConfirmation } = useAuth();
  const email = typeof params.email === "string" ? params.email : "";
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <LinearGradient
      colors={["#08040F", "#0B0F14", "#160A2D"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.screen}
    >
      <View style={styles.shell}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>MICROHABIT</Text>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.body}>
            {email
              ? `We sent a confirmation link to ${email}. Open it on this device to finish creating your account.`
              : "We sent a confirmation link to your email. Open it on this device to finish creating your account."}
          </Text>

          {resent ? <Text style={styles.info}>Confirmation email sent again.</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {email ? (
            <Pressable
              disabled={loading}
              onPress={async () => {
                try {
                  setError(null);
                  setResent(false);
                  setLoading(true);
                  await resendSignUpConfirmation(email);
                  setResent(true);
                } catch (e: any) {
                  setError(e?.message ?? "Could not resend confirmation email");
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
              <Text style={styles.primaryBtnText}>{loading ? "Sending..." : "Resend email"}</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() =>
              router.replace({
                pathname: "/(auth)/sign-in",
                params: { message: "Check your inbox, then sign in after confirming your email." },
              })
            }
          >
            <Text style={styles.secondaryLink}>Back to sign in</Text>
          </Pressable>

          <Link href="/(auth)/forgot-password" style={styles.secondaryLink}>
            Need password help?
          </Link>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  shell: {
    flex: 1,
    paddingHorizontal: 22,
    justifyContent: "center",
  },
  card: {
    borderRadius: 24,
    padding: 22,
    gap: 14,
    backgroundColor: "rgba(14,18,29,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  eyebrow: {
    color: "rgba(237,231,255,0.58)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  title: {
    color: TEXT,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  body: {
    color: "rgba(237,231,255,0.78)",
    fontSize: 16,
    lineHeight: 24,
  },
  info: {
    color: "rgba(140,255,190,0.92)",
    fontSize: 13,
    fontWeight: "600",
  },
  error: {
    color: "#FF8B8B",
    fontSize: 13,
    fontWeight: "600",
  },
  primaryBtn: {
    marginTop: 4,
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
  secondaryLink: {
    marginTop: 2,
    color: "rgba(237,231,255,0.82)",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
});
