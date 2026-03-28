import type { ExpoConfig } from "@expo/config-types";

const config: ExpoConfig = {
  name: "MicroHabit",
  slug: "microhabit",
  version: "1.0.1",
  newArchEnabled: true,
  plugins: [
    "expo-router",
    "@sentry/react-native",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    "expo-font",
    "expo-notifications",
    "expo-secure-store",
  ],

  ios: {
    bundleIdentifier: "com.sadik.microhabit",
    supportsTablet: false,

    // IMPORTANT: increment this every TestFlight/App Store upload
    // Must be higher than the last uploaded build number
    buildNumber: "10",

    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },

  android: {
    package: "com.sadik.microhabit",
    versionCode: 6,
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
