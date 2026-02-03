import type { ExpoConfig } from "@expo/config-types";

const config: ExpoConfig = {
  name: "MicroHabit",
  slug: "microhabit",
  ios: {
    bundleIdentifier: "com.sadik.microhabit",
    supportsTablet: false
  },
  scheme: "microhabit",
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnon: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  }
};

export default config;
