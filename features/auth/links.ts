import * as Linking from "expo-linking";
import { AUTH_STORAGE_KEY, authStorage, supabase } from "../../lib/supabase";
import { consumeAuthCallback, parseAuthCallbackUrl as parseCallback } from "./callback";
import { pendingPkceFlow } from "./pkce-flow";

export function parseAuthCallbackUrl(url: string) {
  return parseCallback(url, [buildAuthRedirectUrl("/sign-in"), buildAuthRedirectUrl("/update-password")]);
}

export function buildAuthRedirectUrl(path: string) {
  return Linking.createURL(path.startsWith("/") ? path : `/${path}`);
}

export function isAuthCallbackUrl(url: string) {
  return parseAuthCallbackUrl(url).isCallback;
}

// OAuth's browser callback and the native link event can report the same URL.
// Share the exchange, since a one-use code must not be consumed twice.
let lastCallback: { url: string; result: ReturnType<typeof consumeAuthCallback> } | undefined;
export function consumeAuthCallbackUrl(url: string) {
  if (lastCallback?.url === url) return lastCallback.result;
  const result = consumeAuthCallback(url, {
    exchangeCodeForSession: (code) => supabase.auth.exchangeCodeForSession(code),
    getPendingFlow: getPendingAuthFlow,
  }, [buildAuthRedirectUrl("/sign-in"), buildAuthRedirectUrl("/update-password")]);
  lastCallback = { url, result };
  return result;
}

export async function getPendingAuthFlow() {
  return pendingPkceFlow(await authStorage.getItem(`${AUTH_STORAGE_KEY}-code-verifier`));
}

export async function cancelPendingAuthFlow() {
  lastCallback = undefined;
  await authStorage.removeItem(`${AUTH_STORAGE_KEY}-code-verifier`);
}
