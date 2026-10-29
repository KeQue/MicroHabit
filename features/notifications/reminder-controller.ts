export type ReminderPreferences = { enabled: boolean; hour: number; minute: number };
export type ReminderState = { preferences: ReminderPreferences; permission: "unknown" | "granted" | "denied"; scheduled: boolean; error: string | null };
export const REMINDER_KIND = "gentle-daily-reminder";
export const TEST_KIND = "gentle-test-reminder";
export const REMINDER_STORAGE_KEY = "commito.reminder-preferences.v1";
const defaults: ReminderPreferences = { enabled: true, hour: 17, minute: 0 };
type Scheduled = { identifier: string; content: { data?: Record<string, unknown> } };
type Ports = {
  read: () => Promise<string | null>; write: (value: string) => Promise<void>;
  permission: (request: boolean) => Promise<boolean>;
  list: () => Promise<Scheduled[]>; cancel: (id: string) => Promise<void>;
  schedule: (preferences: ReminderPreferences, timezone: string) => Promise<string>;
  test: () => Promise<void>; timezone: () => string;
};
function valid(value: unknown): value is ReminderPreferences {
  if (!value || typeof value !== "object") return false;
  const p = value as ReminderPreferences;
  return typeof p.enabled === "boolean" && Number.isInteger(p.hour) && p.hour >= 0 && p.hour <= 23 &&
    Number.isInteger(p.minute) && p.minute >= 0 && p.minute <= 59;
}
// Serialize storage and OS work; account changes invalidate in-flight work immediately.
export function createReminderController(ports: Ports) {
  let account: string | null = null;
  let accountInitialized = false;
  let generation = 0;
  let loaded = false;
  let state: ReminderState = { preferences: { ...defaults }, permission: "unknown", scheduled: false, error: null };
  let queue = Promise.resolve();
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<ReminderState>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };
  const enqueue = (work: () => Promise<void>) => {
    const result = queue.then(async () => {
      try { await work(); }
      catch { publish({ scheduled: false, error: "Could not update reminders. Please try again." }); }
      return state;
    });
    queue = result.then(() => undefined, () => undefined);
    return result;
  };
  const load = async () => {
    if (loaded) return;
    const raw = await ports.read();
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (!valid(parsed)) throw new Error("invalid reminder preferences");
      publish({ preferences: parsed });
    }
    loaded = true;
  };
  const cancelAll = async (includeTests = false) => {
    for (const item of await ports.list()) {
      if (item.content.data?.kind === REMINDER_KIND || (includeTests && item.content.data?.kind === TEST_KIND)) await ports.cancel(item.identifier);
    }
  };
  const reconcile = async (request: boolean, expected: number) => {
    await load();
    if (expected !== generation) return;
    if (!account || !state.preferences.enabled) {
      await cancelAll(!account);
      publish({ scheduled: false, error: null }); return;
    }
    const granted = await ports.permission(request);
    if (expected !== generation) return;
    publish({ permission: granted ? "granted" : "denied" });
    if (!granted) { await cancelAll(); publish({ scheduled: false, error: null }); return; }
    const timezone = ports.timezone();
    const signature = `${state.preferences.hour}:${state.preferences.minute}:${timezone}`;
    const scheduled = (await ports.list()).filter((item) => item.content.data?.kind === REMINDER_KIND);
    if (expected !== generation) return;
    if (scheduled.length === 1 && scheduled[0].content.data?.signature === signature) {
      publish({ scheduled: true, error: null }); return;
    }
    await cancelAll();
    if (expected !== generation) return;
    const identifier = await ports.schedule(state.preferences, timezone);
    if (expected !== generation) { await ports.cancel(identifier); return; }
    publish({ scheduled: true, error: null });
  };
  return {
    getState: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setAccount(next: string | null) {
      if (accountInitialized && next === account) {
        const expected = generation;
        return enqueue(() => reconcile(false, expected));
      }
      accountInitialized = true;
      account = next;
      const expected = ++generation;
      return enqueue(async () => {
        await cancelAll(true); publish({ scheduled: false });
        await reconcile(false, expected);
      });
    },
    refresh() { const expected = generation; return enqueue(() => reconcile(false, expected)); },
    save(preferences: ReminderPreferences) {
      const expected = generation;
      return enqueue(async () => {
        if (!valid(preferences)) { publish({ error: "Use a time between 00:00 and 23:59." }); return; }
        if (expected !== generation || !account) return;
        await ports.write(JSON.stringify(preferences));
        loaded = true;
        publish({ preferences: { ...preferences } });
        await reconcile(preferences.enabled, expected);
      });
    },
    async test() {
      const expected = generation;
      let succeeded = false;
      await enqueue(async () => {
        if (!account) return;
        const granted = await ports.permission(true);
        if (expected !== generation) return;
        publish({ permission: granted ? "granted" : "denied" });
        if (!granted) return;
        for (const item of await ports.list()) {
          if (item.content.data?.kind === TEST_KIND) await ports.cancel(item.identifier);
        }
        if (expected !== generation) return;
        await ports.test();
        if (expected !== generation) { await cancelAll(true); return; }
        publish({ error: null });
        succeeded = true;
      });
      return succeeded;
    },
  };
}
