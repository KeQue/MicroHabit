import type { ExpoConfig } from "@expo/config-types";

const config: ExpoConfig = {
  name: "MicroHabit",
  slug: "microhabit",

  // App Store "version" (1.0.1 etc) should live here too if you want it controlled by app.config.ts
  // version: "1.0.1",

  ios: {
    bundleIdentifier: "com.sadik.microhabit",
    supportsTablet: false,

    // IMPORTANT: increment this every TestFlight/App Store upload
    // Must be higher than the last uploaded build number
    buildNumber: "3",

    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },

  android: {
    package: "com.sadik.microhabit",
    // OPTIONAL but recommended: increment for every Play upload
    // versionCode: 2,
  },

  scheme: "microhabit",

  extra: {
    eas: {
      projectId: "d3fde64e-5b05-47c2-b4c5-91ff25cd3045",
    },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnon: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
};

export default config;
