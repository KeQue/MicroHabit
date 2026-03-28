import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import * as Linking from "expo-linking";
import { Stack, useRouter, useSegments } from "expo-router";
import React, { useEffect, useRef } from "react";
import { consumeAuthCallbackUrl, isAuthCallbackUrl } from "../features/auth/links";
import { AuthProvider, useAuth } from "../features/auth/useAuth";

function RouteGate() {
  const { user, initializing } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const lastHandledUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    const handleAuthUrl = async (url: string) => {
      if (!isAuthCallbackUrl(url) || lastHandledUrlRef.current === url) return;
      lastHandledUrlRef.current = url;

      const result = await consumeAuthCallbackUrl(url);
      if (!active || result.kind === "none") return;

      if (result.kind === "error") {
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

      router.replace("/(app)");
    };

    void Linking.getInitialURL().then((url) => {
      if (!active || !url) return;
      void handleAuthUrl(url);
    });

    const sub = Linking.addEventListener("url", ({ url }) => {
      void handleAuthUrl(url);
    });

    return () => {
      active = false;
      sub.remove();
    };
  }, [router]);

  useEffect(() => {
    if (initializing) return;

    const group = segments[0]; // "(auth)" | "(app)" | etc.
    const inAuthGroup = group === "(auth)";
    const inAppGroup = group === "(app)";
    const currentPath = segments.join("/");
    const allowSignedInAuthScreen = currentPath === "(auth)/update-password";

    if (!user) {
      if (!inAuthGroup) router.replace("/(auth)/sign-in");
      return;
    }

    if (!inAppGroup && !allowSignedInAuthScreen) router.replace("/(app)");
  }, [user, initializing, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

function RootLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <AuthProvider>
        <RouteGate />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default RootLayout;
