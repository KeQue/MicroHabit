import { inviteIsFresh, normalizeInviteCode, readStoredInvite, type PendingInvite } from "./invite";

type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
export type InviteSnapshot = { ready: boolean; pending: PendingInvite | null; error: string | null };
const STORAGE_ERROR = "Could not remember this invitation. You can still sign in and enter its code.";

/** Serializes only this invitation key. It never reads or changes auth credentials. */
export function createPendingInviteStore(storage: Storage, key: string, options: {
  nonce: () => string;
  onChange: (snapshot: InviteSnapshot) => void;
  now?: () => number;
  userId?: string | null;
  initializing?: boolean;
}) {
  const now = options.now ?? Date.now;
  let snapshot: InviteSnapshot = { ready: false, pending: null, error: null };
  let userId = options.userId ?? null;
  let initializing = options.initializing ?? true;
  let previousUser: string | null | undefined = initializing ? undefined : userId;
  let epoch = 0;
  let queue: Promise<unknown> = Promise.resolve();
  let hydration: Promise<void> | null = null;

  function publish(next: InviteSnapshot) {
    snapshot = next;
    options.onChange(next);
  }
  function serialized<T>(task: () => Promise<T>): Promise<T> {
    const result = queue.then(task);
    queue = result.catch(() => undefined);
    return result;
  }
  async function persist(invite: PendingInvite | null) {
    if (invite) await storage.setItem(key, JSON.stringify({ version: 1, ...invite }));
    else await storage.removeItem(key);
  }
  function failure() {
    publish({ ready: true, pending: null, error: STORAGE_ERROR });
  }
  async function reconcile() {
    const request = epoch;
    const invite = snapshot.pending;
    if (!invite || initializing) return;
    let next = invite;
    if (!inviteIsFresh(invite, now()) || (invite.userId !== null && invite.userId !== userId)) {
      await persist(null);
      if (request === epoch) publish({ ready: true, pending: null, error: null });
      return;
    }
    if (invite.userId === null && userId) {
      next = { ...invite, userId };
      await persist(next);
    }
    if (request === epoch) publish({ ready: true, pending: next, error: null });
  }
  function start(): Promise<void> {
    hydration ??= serialized(async () => {
      const request = epoch;
      try {
        const raw = await storage.getItem(key);
        if (request !== epoch) return;
        const pending = readStoredInvite(raw, now());
        if (raw !== null && !pending) await persist(null);
        if (request !== epoch) return;
        publish({ ready: true, pending, error: null });
        await reconcile();
      } catch {
        if (request === epoch) failure();
      }
    });
    return hydration;
  }
  function setAuth(nextUser: string | null, isInitializing: boolean, signedOut = false): Promise<void> {
    const replacement = !isInitializing && previousUser !== undefined && previousUser !== null && previousUser !== nextUser;
    userId = nextUser;
    initializing = isInitializing;
    if (!isInitializing) previousUser = nextUser;
    if (signedOut || replacement) {
      epoch += 1;
      publish({ ...snapshot, pending: null });
      void start();
      return serialized(async () => {
        try { await persist(null); publish({ ready: true, pending: null, error: null }); }
        catch { failure(); }
      });
    }
    void start();
    return serialized(async () => {
      try { await reconcile(); }
      catch { failure(); }
    });
  }
  async function capture(rawCode: string): Promise<PendingInvite> {
    const code = normalizeInviteCode(rawCode);
    const request = epoch;
    void start();
    return serialized(async () => {
      if (request !== epoch) throw new Error("Please open this invitation again.");
      const owner = initializing ? null : userId;
      const existing = snapshot.pending;
      if (existing && existing.code === code && existing.userId === owner && inviteIsFresh(existing, now())) return existing;
      const invite: PendingInvite = { code, nonce: options.nonce(), userId: owner, createdAt: now() };
      try {
        await persist(invite);
        if (request !== epoch) throw new Error("Please open this invitation again.");
        publish({ ready: true, pending: invite, error: null });
        return invite;
      } catch {
        if (request === epoch) failure();
        throw new Error(STORAGE_ERROR);
      }
    });
  }
  async function clear(nonce?: string): Promise<void> {
    void start();
    return serialized(async () => {
      if (nonce && snapshot.pending?.nonce !== nonce) return;
      const request = epoch;
      publish({ ...snapshot, pending: null });
      try {
        await persist(null);
        if (request === epoch) publish({ ready: true, pending: null, error: null });
      } catch { if (request === epoch) failure(); }
    });
  }
  async function refresh(): Promise<void> {
    void start();
    return serialized(async () => {
      try { await reconcile(); }
      catch { failure(); }
    });
  }
  return { start, setAuth, capture, clear, refresh, getSnapshot: () => snapshot };
}
