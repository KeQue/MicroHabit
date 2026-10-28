type VersionInfo = {
  environment: "expo" | "native" | "web";
  nativeVersion?: string | null;
  nativeBuild?: string | null;
  configuredVersion?: string;
};

/** Expo Go's native version belongs to the host app, not to Commito. */
export function appVersionLabel(info: VersionInfo) {
  const version = info.environment === "native" ? info.nativeVersion : info.configuredVersion;
  const build = info.environment === "native" ? info.nativeBuild : null;
  return {
    title: `Commito${version ? ` ${version}` : ""}${build ? ` (${build})` : ""}`,
    detail: info.environment === "expo" ? "Development preview · Expo Go"
      : info.environment === "web" ? "Web preview" : null,
  };
}
