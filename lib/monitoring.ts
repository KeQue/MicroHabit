export function initMonitoring() {
  // Sentry temporarily disabled while isolating the iOS startup crash.
}

export const Sentry = {
  wrap<T>(component: T) {
    return component;
  },
};
