type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
type Manifest = { generation: string; count: number };

// SecureStore can reject large values. Each chunk is at most 500 UTF-16 units
// (under 2KB in UTF-8), without splitting a surrogate pair.
function chunks(value: string) {
  const result: string[] = [];
  let chunk = "";
  for (const character of value) {
    if (chunk.length + character.length > 500) {
      result.push(chunk);
      chunk = "";
    }
    chunk += character;
  }
  result.push(chunk);
  return result;
}

export function createSessionStorage(secure: Storage, legacy: Storage) {
  const pending = new Map<string, Promise<void>>();
  let generation = 0;
  function serialized<T>(key: string, task: () => Promise<T>): Promise<T> {
    const result = (pending.get(key) ?? Promise.resolve()).then(task);
    const settled = result.then(() => undefined, () => undefined);
    pending.set(key, settled);
    void settled.then(() => { if (pending.get(key) === settled) pending.delete(key); });
    return result;
  }
  const pointer = (key: string) => `commito.${key}.manifest`;
  const chunkKey = (key: string, m: Manifest, i: number) => `commito.${key}.${m.generation}.${i}`;
  async function manifest(key: string): Promise<Manifest | null> {
    const raw = await secure.getItem(pointer(key));
    if (raw === null) return null;
    const m = JSON.parse(raw);
    if (!m || typeof m.generation !== "string" || !/^[a-z0-9-]+$/.test(m.generation) || !Number.isInteger(m.count) || m.count < 1 || m.count > 256) {
      throw new Error("Stored sign-in data is invalid. Please sign in again.");
    }
    return m;
  }
  async function removeChunks(key: string, m: Manifest | null) {
    if (m) for (let i = 0; i < m.count; i++) await secure.removeItem(chunkKey(key, m, i));
  }
  async function write(key: string, value: string) {
    const old = await manifest(key);
    const parts = chunks(value);
    if (parts.length > 256) throw new Error("Sign-in data is too large to store safely.");
    const next = { generation: `${Date.now().toString(36)}-${(++generation).toString(36)}-${Math.random().toString(36).slice(2)}`, count: parts.length };
    try {
      for (let i = 0; i < parts.length; i++) await secure.setItem(chunkKey(key, next, i), parts[i]);
      // Publish only after every chunk is stored. Failed writes retain the old
      // session and legacy migration source rather than publishing partial data.
      await secure.setItem(pointer(key), JSON.stringify(next));
    } catch (error) {
      await removeChunks(key, next).catch(() => undefined);
      throw error;
    }
    await legacy.removeItem(key);
    await removeChunks(key, old);
  }
  return {
    getItem: (key: string) => serialized(key, async () => {
      const m = await manifest(key);
      if (m) {
        let value = "";
        for (let i = 0; i < m.count; i++) {
          const part = await secure.getItem(chunkKey(key, m, i));
          if (part === null) throw new Error("Stored sign-in data is incomplete. Please sign in again.");
          value += part;
        }
        await legacy.removeItem(key);
        return value;
      }
      const value = await legacy.getItem(key);
      if (value !== null) await write(key, value);
      return value;
    }),
    setItem: (key: string, value: string) => serialized(key, () => write(key, value)),
    removeItem: (key: string) => serialized(key, async () => {
      // Remove legacy data first so a later read cannot migrate it back in.
      await legacy.removeItem(key);
      const old = await manifest(key).catch(() => null);
      await secure.removeItem(pointer(key));
      await removeChunks(key, old);
    }),
  };
}
