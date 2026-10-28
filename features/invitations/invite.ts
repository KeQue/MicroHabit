export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type PendingInvite = {
  code: string;
  nonce: string;
  userId: string | null;
  createdAt: number;
};

export function normalizeInviteCode(value: unknown): string {
  if (typeof value !== "string" || value.length > 128) throw new Error("Enter a valid invite code.");
  const code = value.trim();
  if (!/^[A-Za-z0-9-]{1,64}$/.test(code)) throw new Error("Enter a valid invite code.");
  return code.toUpperCase();
}

export function inviteIsFresh(invite: PendingInvite, now = Date.now()): boolean {
  return Number.isFinite(invite.createdAt) && invite.createdAt <= now && now - invite.createdAt < INVITE_TTL_MS;
}

export function pendingInviteForUser(invite: PendingInvite | null, userId: string | null, now = Date.now()): PendingInvite | null {
  return invite && inviteIsFresh(invite, now) && (invite.userId === null || invite.userId === userId) ? invite : null;
}

export function readStoredInvite(raw: string | null, now = Date.now()): PendingInvite | null {
  if (raw === null || raw.length > 2048) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || value.version !== 1 || normalizeInviteCode(value.code) !== value.code ||
      typeof value.nonce !== "string" || !/^[A-Za-z0-9-]{1,128}$/.test(value.nonce) ||
      !(value.userId === null || (typeof value.userId === "string" && /^[A-Za-z0-9-]{1,128}$/.test(value.userId)))) return null;
    const invite: PendingInvite = { code: value.code, nonce: value.nonce, userId: value.userId, createdAt: value.createdAt };
    return inviteIsFresh(invite, now) ? invite : null;
  } catch {
    return null;
  }
}

/** Only the configured invitation address may supply a code; auth callbacks cannot. */
export function parseInviteAddress(value: unknown, configuredBase: string): string | null {
  if (typeof value !== "string" || value.length > 2048 || value !== value.trim()) return null;
  try {
    const url = new URL(value);
    const expected = new URL(configuredBase);
    if (url.username || url.password || url.hash || value.includes("#") ||
      url.protocol !== expected.protocol || url.hostname !== expected.hostname || url.port !== expected.port ||
      url.pathname !== expected.pathname) return null;
    const keys = Array.from(url.searchParams.keys());
    if (keys.length !== 1 || keys[0] !== "code" || url.searchParams.getAll("code").length !== 1) return null;
    return normalizeInviteCode(url.searchParams.get("code"));
  } catch {
    return null;
  }
}
