import * as Linking from "expo-linking";
import { supabase } from "../../lib/supabase";

type AuthCallbackResult =
  | { kind: "none" }
  | { kind: "recovery" }
  | { kind: "signed-in" }
  | { kind: "error"; message: string };

function normalizedPath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

const ALLOWED_AUTH_CALLBACK_PATHS = new Set(["/sign-in", "/update-password"]);

function collectParams(url: string) {
  const parsed = Linking.parse(url);
  const params = new Map<string, string>();

  const addValue = (key: string, value: unknown) => {
    if (typeof value === "string" && value) params.set(key, value);
  };

  Object.entries(parsed.queryParams ?? {}).forEach(([key, value]) => addValue(key, value));

  const hashIndex = url.indexOf("#");
  if (hashIndex >= 0) {
    const hash = url.slice(hashIndex + 1);
    const hashParams = new URLSearchParams(hash);
    hashParams.forEach((value, key) => addValue(key, value));
  }

  return params;
}

export function buildAuthRedirectUrl(path: string) {
  return Linking.createURL(normalizedPath(path));
}

function parseAuthCallbackUrl(url: string) {
  const params = collectParams(url);
  const parsed = Linking.parse(url);
  const path = normalizedPath(parsed.path ?? "/");

  return {
    path,
    code: params.get("code") ?? undefined,
    accessToken: params.get("access_token") ?? undefined,
    refreshToken: params.get("refresh_token") ?? undefined,
    type: params.get("type") ?? undefined,
    errorDescription: params.get("error_description") ?? params.get("error") ?? undefined,
  };
}

export function isAuthCallbackUrl(url: string) {
  const params = parseAuthCallbackUrl(url);
  if (!ALLOWED_AUTH_CALLBACK_PATHS.has(params.path)) return false;

  return (
    !!params.code ||
    !!params.accessToken ||
    !!params.refreshToken ||
    !!params.errorDescription ||
    params.type === "recovery"
  );
}

export async function consumeAuthCallbackUrl(url: string): Promise<AuthCallbackResult> {
  const params = parseAuthCallbackUrl(url);
  if (!ALLOWED_AUTH_CALLBACK_PATHS.has(params.path)) {
    return { kind: "none" };
  }

  if (params.errorDescription) {
    return {
      kind: "error",
      message: decodeURIComponent(params.errorDescription.replace(/\+/g, " ")),
    };
  }

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) return { kind: "error", message: error.message };
    return params.type === "recovery" ? { kind: "recovery" } : { kind: "signed-in" };
  }

  if (params.accessToken && params.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
    });
    if (error) return { kind: "error", message: error.message };
    return params.type === "recovery" ? { kind: "recovery" } : { kind: "signed-in" };
  }

  return { kind: "none" };
}
