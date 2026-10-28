import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createSessionStorage } from './session-storage.ts';

function memory() {
  const values = new Map();
  return {
    values,
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
    async removeItem(key) { values.delete(key); },
  };
}

test('large Unicode sessions migrate intact into bounded protected chunks', async () => {
  const secure = memory(), legacy = memory();
  const original = JSON.stringify({ token: 'synthetic', metadata: 'é👋'.repeat(2200) });
  await legacy.setItem('session', original);
  const storage = createSessionStorage(secure, legacy);
  assert.equal(await storage.getItem('session'), original);
  assert.equal(await legacy.getItem('session'), null);
  for (const value of secure.values.values()) assert.ok(Buffer.byteLength(value, 'utf8') < 2048);
  assert.equal(await createSessionStorage(secure, legacy).getItem('session'), original);
});

test('failed migration keeps the legacy session for a retry without publishing partial data', async () => {
  const secure = memory(), legacy = memory();
  await legacy.setItem('session', 'synthetic'.repeat(400));
  const set = secure.setItem;
  let writes = 0;
  secure.setItem = async (...args) => { if (++writes === 2) throw Error('Keychain unavailable'); return set(...args); };
  const storage = createSessionStorage(secure, legacy);
  await assert.rejects(storage.getItem('session'), /Keychain unavailable/);
  assert.equal(await legacy.getItem('session'), 'synthetic'.repeat(400));
  assert.equal(secure.values.size, 0);
  secure.setItem = set;
  assert.equal(await storage.getItem('session'), 'synthetic'.repeat(400));
});

test('failed replacement retains the prior complete protected session', async () => {
  const secure = memory(), legacy = memory(), storage = createSessionStorage(secure, legacy);
  await storage.setItem('session', 'old-synthetic-session');
  const set = secure.setItem;
  secure.setItem = async (key, value) => { if (key.endsWith('.manifest')) throw Error('Write denied'); return set(key, value); };
  await assert.rejects(storage.setItem('session', 'new-synthetic-session'), /Write denied/);
  assert.equal(await storage.getItem('session'), 'old-synthetic-session');
});

test('sign-out removes protected data and legacy values without resurrection', async () => {
  const secure = memory(), legacy = memory(), storage = createSessionStorage(secure, legacy);
  await storage.setItem('session', 'synthetic'.repeat(400));
  await legacy.setItem('session', 'stale-legacy-session');
  await Promise.all([storage.setItem('session', 'latest-synthetic'), storage.removeItem('session')]);
  assert.equal(await storage.getItem('session'), null);
  assert.equal(secure.values.size, 0);
  assert.equal(legacy.values.size, 0);
});

test('missing protected chunks fail closed instead of restoring a stale legacy session', async () => {
  const secure = memory(), legacy = memory(), storage = createSessionStorage(secure, legacy);
  await storage.setItem('session', 'synthetic'.repeat(400));
  const chunk = [...secure.values.keys()].find(key => !key.endsWith('.manifest'));
  secure.values.delete(chunk);
  await legacy.setItem('session', 'stale');
  await assert.rejects(storage.getItem('session'), /incomplete/);
});

test('corrupt manifests can still be removed during sign-out', async () => {
  const secure = memory(), legacy = memory(), storage = createSessionStorage(secure, legacy);
  await secure.setItem('commito.session.manifest', 'not-json');
  await legacy.setItem('session', 'stale');
  await assert.rejects(storage.getItem('session'));
  await storage.removeItem('session');
  assert.equal(await storage.getItem('session'), null);
  assert.equal(legacy.values.size, 0);
});
