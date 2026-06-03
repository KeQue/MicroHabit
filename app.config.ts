import type { ExpoConfig } from "@expo/config-types";

const config: ExpoConfig = {
  name: "MicroHabit",
  slug: "microhabit",
  version: "1.0.2",
  orientation: "portrait",
  icon: "./assets/images/commito-icon.png",
  scheme: "microhabit",
  userInterfaceStyle: "automatic",

  ios: {
    bundleIdentifier: "com.sadik.microhabit",
    supportsTablet: false,

    // IMPORTANT: increment this every TestFlight/App Store upload
    // Must be higher than the last uploaded build number
    buildNumber: "22",

    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },

  android: {
    package: "com.sadik.microhabit",
    adaptiveIcon: {
      backgroundColor: "#0B0F14",
      foregroundImage: "./assets/images/commito-android-foreground.png",
      backgroundImage: "./assets/images/commito-android-background.png",
      monochromeImage: "./assets/images/commito-android-monochrome.png",
    },
    // OPTIONAL but recommended: increment for every Play upload
    // versionCode: 2,
  },

  web: {
    favicon: "./assets/images/commito-favicon.png",
  },

  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/commito-splash.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#0B0F14",
        dark: {
          backgroundColor: "#0B0F14",
        },
      },
    ],
    "expo-font",
    "expo-notifications",
  ],

  extra: {
    eas: {
      projectId: "d3fde64e-5b05-47c2-b4c5-91ff25cd3045",
    },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnon: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
};

export default config;
