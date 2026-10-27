import * as Linking from "expo-linking";
import { supabase } from "../../lib/supabase";
import { consumeAuthCallback, parseAuthCallbackUrl } from "./callback";

export { parseAuthCallbackUrl } from "./callback";

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
  const result = consumeAuthCallback(url, supabase.auth);
  lastCallback = { url, result };
  return result;
}
