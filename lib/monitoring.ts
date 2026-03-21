import * as Sentry from "@sentry/react-native";

let monitoringConfigured = false;

export function initMonitoring() {
  if (monitoringConfigured) return;
  monitoringConfigured = true;

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    enabled: !__DEV__,
    sendDefaultPii: false,
  });
}

export { Sentry };
