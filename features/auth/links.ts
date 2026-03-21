import * as Linking from "expo-linking";
import { supabase } from "../../lib/supabase";

export type ParsedAuthCallback = {
  code?: string;
  accessToken?: string;
  refreshToken?: string;
  type?: string;
  errorDescription?: string;
};

type AuthCallbackResult =
  | { kind: "none" }
  | { kind: "recovery" }
  | { kind: "signed-in" }
  | { kind: "error"; message: string };

function normalizedPath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

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

export function createAuthRedirectUrl(path: string) {
  return Linking.createURL(normalizedPath(path));
}

export const buildAuthRedirectUrl = createAuthRedirectUrl;

export function parseAuthCallbackUrl(url: string): ParsedAuthCallback {
  const params = collectParams(url);
  return {
    code: params.get("code") ?? undefined,
    accessToken: params.get("access_token") ?? undefined,
    refreshToken: params.get("refresh_token") ?? undefined,
    type: params.get("type") ?? undefined,
    errorDescription: params.get("error_description") ?? params.get("error") ?? undefined,
  };
}

export function isAuthCallbackUrl(url: string) {
  const params = parseAuthCallbackUrl(url);
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

  const errorDescription = params.errorDescription;
  if (errorDescription) {
    return { kind: "error", message: decodeURIComponent(errorDescription.replace(/\+/g, " ")) };
  }

  const authCode = params.code;
  if (authCode) {
    const { error } = await supabase.auth.exchangeCodeForSession(authCode);
    if (error) return { kind: "error", message: error.message };
    return params.type === "recovery" ? { kind: "recovery" } : { kind: "signed-in" };
  }

  const accessToken = params.accessToken;
  const refreshToken = params.refreshToken;
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) return { kind: "error", message: error.message };
    return params.type === "recovery" ? { kind: "recovery" } : { kind: "signed-in" };
  }

  return { kind: "none" };
}
