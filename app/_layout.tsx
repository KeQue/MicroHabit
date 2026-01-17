import { Stack, router, useSegments } from "expo-router";
import React, { useEffect } from "react";
import { AuthProvider, useAuth } from "../features/auth/useAuth";

function RouteGate() {
  const { user, initializing } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (initializing) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
      return;
    }

    if (user && inAuthGroup) {
      // Typed routes in this project don't include "/league" even though it exists at runtime.
      router.replace("/league" as any);
      return;
    }
  }, [user, initializing, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RouteGate />
    </AuthProvider>
  );
}
