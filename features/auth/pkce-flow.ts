// Supabase serializes its verifier through the configured storage adapter.
// The recovery suffix is written locally by resetPasswordForEmail, not read
// from the incoming URL. SDK integration tests protect this dependency.
export function pendingPkceFlow(raw: string | null): "recovery" | "sign-in" | null {
  if (!raw) return null;
  try {
    const verifier = JSON.parse(raw);
    if (typeof verifier !== "string") return null;
    const [value, flow, extra] = verifier.split("/");
    if (!value || !/^[A-Za-z0-9._~-]+$/.test(value) || extra !== undefined) return null;
    if (flow !== undefined && flow !== "PASSWORD_RECOVERY") return null;
    return flow === "PASSWORD_RECOVERY" ? "recovery" : "sign-in";
  } catch { return null; }
}
