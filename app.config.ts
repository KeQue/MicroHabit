import type { ExpoConfig } from "@expo/config-types";

const config: ExpoConfig = {
  name: "MicroHabit",
  slug: "microhabit",
  ios: {
    bundleIdentifier: "com.sadik.microhabit",
    supportsTablet: false
  },
  android: {
    package: "com.sadik.microhabit"
  },
  scheme: "microhabit",
  extra: {
    eas: {
      projectId: "d3fde64e-5b05-47c2-b4c5-91ff25cd3045"
    },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnon: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  }
};

export default config;
