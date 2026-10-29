import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import * as Linking from "expo-linking";
import { Stack, useRouter, useSegments } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Alert, AppState } from "react-native";
import { isAuthCallbackUrl } from "../features/auth/links";
import { postAuthRoute } from "../features/auth/post-auth-route";
import { parseInviteUrl } from "../features/invitations/links";
import { PendingInviteProvider, usePendingInvite } from "../features/invitations/pending-invite";
import {
  configureNotifications,
  refreshGentleDailyReminder,
  setReminderAccount,
} from "../features/notifications/local";
import { AuthProvider, useAuth } from "../features/auth/useAuth";
import { supabase } from "../lib/supabase";

function RouteGate() {
  const { user, initializing, passwordRecovery, processingAuthLink, handleAuthCallback } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { ready: pendingReady, pending, capture } = usePendingInvite();
  const captureRef = useRef(capture);
  captureRef.current = capture;
  const lastOfferedRef = useRef<string | null>(null);
  const lastHandledUrlRef = useRef<string | null>(null);
  const [initialLinkChecked, setInitialLinkChecked] = useState(false);

  useEffect(() => {
    let active = true;

    const handleAuthUrl = async (url: string) => {
      const inviteCode = parseInviteUrl(url);
      if (inviteCode) {
        try { await captureRef.current(inviteCode); }
        catch {
          if (active) Alert.alert("Invitation", `Please sign in, choose Join, and enter ${inviteCode}.`);
        }
        return;
      }
      if (!isAuthCallbackUrl(url) || lastHandledUrlRef.current === url) return;
      lastHandledUrlRef.current = url;

      const result = await handleAuthCallback(url);
      if (!active || result.kind === "none") return;

      if (result.kind === "error") {
        Alert.alert("Could not open link", result.message);
        router.replace({
          pathname: "/(auth)/sign-in",
          params: { error: result.message },
        });
        return;
      }

      if (result.kind === "recovery") {
        router.replace("/(auth)/update-password");
        return;
      }

      // The route gate chooses the post-auth destination, including pending invites.
    };

    void (async () => {
      try {
        const url = await Linking.getInitialURL();
        if (active && url) await handleAuthUrl(url);
      } catch {
        if (active) Alert.alert("Could not open link", "Please reopen the email link, or request a new one.");
      } finally {
        if (active) setInitialLinkChecked(true);
      }
    })();

    const sub = Linking.addEventListener("url", ({ url }) => {
      void handleAuthUrl(url);
    });

    return () => {
      active = false;
      sub.remove();
    };
  }, [router, handleAuthCallback]);

  useEffect(() => {
    const destination = postAuthRoute({ userId: user?.id ?? null, initializing,
      initialLinkChecked, processingAuthLink, passwordRecovery, pendingReady,
      pending, segments, lastOffered: lastOfferedRef.current });
    if (destination === "sign-in") router.replace("/(auth)/sign-in");
    else if (destination === "update-password") router.replace("/(auth)/update-password");
    else if (destination === "app") router.replace("/(app)");
    else if (destination) {
      lastOfferedRef.current = destination.offeredKey;
      router.replace({ pathname: "/(app)/league/join", params: { code: destination.code, inviteNonce: destination.nonce } });
    }
  }, [user, initializing, initialLinkChecked, processingAuthLink, passwordRecovery, pendingReady, pending, segments, router]);

  useEffect(() => {
    if (initializing) return;
    // Observe auth events directly so cancellation invalidates pending schedules
    // before React has rendered the signed-out/account-replacement state.
    void setReminderAccount(user?.id ?? null).catch(() => undefined);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void setReminderAccount(session?.user.id ?? null).catch(() => undefined);
    });
    const foreground = AppState.addEventListener("change", (status) => {
      if (status === "active") void refreshGentleDailyReminder().catch(() => undefined);
    });
    return () => { subscription.unsubscribe(); foreground.remove(); };
  }, [user?.id, initializing]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    configureNotifications();
  }, []);

  return (
    <ThemeProvider value={DarkTheme}>
      <AuthProvider>
        <PendingInviteProvider><RouteGate /></PendingInviteProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
