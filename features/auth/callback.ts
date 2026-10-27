export type AuthCallbackResult =
  | { kind: "none" }
  | { kind: "recovery" }
  | { kind: "signed-in" }
  | { kind: "error"; message: string };

const ALLOWED_PATHS = new Set(["/sign-in", "/update-password"]);

export function parseAuthCallbackUrl(url: string) {
  try {
    const parsed = new URL(url);
    // Native links may put the screen in the hostname (scheme://screen) or
    // pathname (scheme:///screen). Expo Go adds /--/ before the screen.
    const rawPath = parsed.pathname.replace(/^\/--\//, "/");
    const path = `/${(rawPath.replace(/^\/+|\/+$/g, "") || parsed.hostname)}`;
    const params = new URLSearchParams(parsed.search);
    new URLSearchParams(parsed.hash.slice(1)).forEach((value, key) => params.set(key, value));
    const code = params.get("code");
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const error = params.get("error_description") || params.get("error");
    const recovery = path === "/update-password" || params.get("type") === "recovery";
    const isCallback = ALLOWED_PATHS.has(path) && !!(code || accessToken || refreshToken || error);
    return { code, accessToken, refreshToken, error, recovery, isCallback };
  } catch {
    return { isCallback: false, recovery: false };
  }
}

type CallbackAuth = {
  exchangeCodeForSession: (code: string) => PromiseLike<{ error: { message: string } | null }>;
  setSession: (tokens: { access_token: string; refresh_token: string }) =>
    PromiseLike<{ error: { message: string } | null }>;
};

export async function consumeAuthCallback(
  url: string,
  auth: CallbackAuth,
): Promise<AuthCallbackResult> {
  const params = parseAuthCallbackUrl(url);
  if (!params.isCallback) return { kind: "none" };
  if (params.error) return { kind: "error", message: params.error };

  try {
    const result = params.code
      ? await auth.exchangeCodeForSession(params.code)
      : params.accessToken && params.refreshToken
        ? await auth.setSession({ access_token: params.accessToken, refresh_token: params.refreshToken })
        : null;
    if (!result) return { kind: "error", message: "This sign-in link is incomplete. Please request a new link." };
    if (result.error) return { kind: "error", message: result.error.message };
    return { kind: params.recovery ? "recovery" : "signed-in" };
  } catch {
    return { kind: "error", message: "Could not open this sign-in link. Please try again or request a new link." };
  }
}
