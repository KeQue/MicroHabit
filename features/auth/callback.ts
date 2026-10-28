export type AuthCallbackResult =
  | { kind: "none" }
  | { kind: "recovery" }
  | { kind: "signed-in" }
  | { kind: "error"; message: string };

const ALLOWED_PATHS = new Set(["/sign-in", "/update-password"]);
const NATIVE_REDIRECTS = [
  "microhabit://sign-in", "microhabit://update-password",
  "microhabit:///sign-in", "microhabit:///update-password",
];

function address(url: URL) {
  return `${url.protocol}//${url.host}${url.pathname.replace(/\/$/, "")}`;
}

export function parseAuthCallbackUrl(url: string, redirects: readonly string[] = NATIVE_REDIRECTS) {
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password || !redirects.some((allowed) => address(new URL(allowed)) === address(parsed))) {
      return { isCallback: false, recovery: false };
    }
    // Native links may put the screen in the hostname (scheme://screen) or
    // pathname (scheme:///screen). Expo Go adds /--/ before the screen.
    const rawPath = parsed.pathname.replace(/^\/--\//, "/");
    const path = `/${(rawPath.replace(/^\/+|\/+$/g, "") || parsed.hostname)}`;
    const params = new URLSearchParams(parsed.search);
    const fragment = new URLSearchParams(parsed.hash.slice(1));
    const ambiguous = ["code", "access_token", "refresh_token", "type", "error", "error_description"]
      .some((key) => params.getAll(key).length + fragment.getAll(key).length > 1);
    fragment.forEach((value, key) => params.set(key, value));
    const code = params.get("code");
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const error = params.get("error_description") || params.get("error");
    const recovery = path === "/update-password" || params.get("type") === "recovery";
    const isCallback = ALLOWED_PATHS.has(path) && !!(code || accessToken || refreshToken || error);
    const invalid = ambiguous || fragment.has("code") || params.has("access_token") || params.has("refresh_token");
    return { code, error, recovery, isCallback, invalid };
  } catch {
    return { isCallback: false, recovery: false };
  }
}

type CallbackAuth = {
  getPendingFlow: () => Promise<"recovery" | "sign-in" | null>;
  exchangeCodeForSession: (code: string) => PromiseLike<{
    error: { message: string } | null;
  }>;
};

export async function consumeAuthCallback(
  url: string,
  auth: CallbackAuth,
  redirects: readonly string[] = NATIVE_REDIRECTS,
): Promise<AuthCallbackResult> {
  const params = parseAuthCallbackUrl(url, redirects);
  if (!params.isCallback) return { kind: "none" };
  if (params.invalid) return { kind: "error", message: "This link uses an unsupported format. Please request a new link in Commito on this device." };
  if (params.error) return { kind: "error", message: params.error };

  try {
    const flow = await auth.getPendingFlow();
    if (!flow) return { kind: "error", message: "Start this sign-in or reset request in Commito on this device, then open the newest email link here." };
    if (params.recovery && flow !== "recovery") {
      return { kind: "error", message: "This is not a password-reset request. Please request a new reset link in Commito on this device." };
    }
    // Supabase binds the one-use code to the verifier saved by this device
    // when the flow started. Never establish a session from tokens in a URL.
    const result = params.code ? await auth.exchangeCodeForSession(params.code) : null;
    if (!result) return { kind: "error", message: "This sign-in link is incomplete. Please request a new link." };
    if (result.error) return { kind: "error", message: result.error.message };
    // Recovery comes from the locally stored PKCE flow, not a URL-supplied type.
    return { kind: flow === "recovery" ? "recovery" : "signed-in" };
  } catch {
    return { kind: "error", message: "Could not open this sign-in link. Please try again or request a new link." };
  }
}
