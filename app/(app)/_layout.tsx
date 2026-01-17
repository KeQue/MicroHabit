import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "../../features/auth/useAuth";

export default function AppLayout() {
  const router = useRouter();
  const { user, initializing } = useAuth();

  useEffect(() => {
    if (initializing) return;

    // If not signed in, kick to auth and DO NOT render the app stack
    if (!user?.id) {
      router.replace("/(auth)/sign-in");
    }
  }, [initializing, user?.id, router]);

  // Prevent rendering app routes while auth state is unknown or signed out
  if (initializing) return null;
  if (!user?.id) return null;

  return <Stack screenOptions={{ headerShown: false }} />;
}
