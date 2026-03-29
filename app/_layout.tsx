import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import React, { useEffect } from "react";
import {
  cancelGentleDailyReminder,
  configureNotifications,
  ensureGentleDailyReminder,
} from "../features/notifications/local";
import { AuthProvider, useAuth } from "../features/auth/useAuth";

function RouteGate() {
  const { user, initializing } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;

    const group = segments[0]; // "(auth)" | "(app)" | etc.
    const inAuthGroup = group === "(auth)";
    const inAppGroup = group === "(app)";

    if (!user) {
      if (!inAuthGroup) router.replace("/(auth)/sign-in");
      return;
    }

    if (!inAppGroup) router.replace("/(app)");
  }, [user, initializing, segments, router]);

  useEffect(() => {
    if (initializing) return;

    if (!user) {
      void cancelGentleDailyReminder();
      return;
    }

    void ensureGentleDailyReminder();
  }, [user, initializing]);

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
        <RouteGate />
      </AuthProvider>
    </ThemeProvider>
  );
}
