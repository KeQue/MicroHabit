import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as invite from './invite.ts';

function moduleFrom(file, dependencies) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, URL, URLSearchParams, __DEV__: false,
    require(name) {
      if (name in dependencies) return dependencies[name];
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return module.exports;
}

function linksFixture(expoGo = false) {
  const constants = {
    executionEnvironment: expoGo ? 'store' : 'bare',
    expoConfig: { scheme: 'microhabit', ios: { bundleIdentifier: 'com.sadik.microhabit' }, ...(expoGo ? { hostUri: '192.0.2.1:8082' } : {}) },
    ...(expoGo ? { expoGoConfig: { developer: {} } } : {}),
    linkingUri: 'microhabit://',
  };
  const native = { 'expo-constants': { __esModule: true, default: constants, ExecutionEnvironment: { Bare: 'bare', Standalone: 'standalone', StoreClient: 'store' } },
    'expo-modules-core': { Platform: { OS: 'ios', select: values => values.ios } },
  };
  const schemes = moduleFrom('node_modules/expo-linking/src/Schemes.ts', native);
  const linking = moduleFrom('node_modules/expo-linking/src/createURL.ts', { ...native, './Schemes': schemes, './validateURL': { validateURL() {} } });
  return moduleFrom('features/invitations/links.ts', { 'expo-linking': linking, './invite': invite });
}

test('codes normalize without accepting ambiguous characters or unbounded input', () => {
  for (const [input, expected] of [[' abc234 ', 'ABC234'], ['A', 'A'], ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'], ['a'.repeat(64), 'A'.repeat(64)]]) {
    assert.equal(invite.normalizeInviteCode(input), expected);
  }
  for (const invalid of ['', ' ', 'a'.repeat(65), 'A B', 'ABC\nDEF', 'ABC?DEF', 'ABC/DEF', '\u0410BC', null, ['ABC']]) {
    assert.throws(() => invite.normalizeInviteCode(invalid));
  }
});

test('installed Expo standalone builder produces the invitation address we validate', () => {
  const links = linksFixture();
  const url = links.buildInviteUrl(' abc234 ');
  assert.equal(url, 'microhabit:///league/join?code=ABC234');
  assert.equal(links.parseInviteUrl(url), 'ABC234');
  assert.equal(links.parseInviteUrl('microhabit://league/join?code=ABC234'), null);
});

test('invites reject other origins, auth paths, duplicated parameters, fragments and excess keys', () => {
  const links = linksFixture();
  for (const url of [
    'https://unrelated.example/league/join?code=ABC234', 'other:///league/join?code=ABC234',
    'microhabit:///sign-in?code=ABC234', 'microhabit:///update-password?code=ABC234',
    'microhabit://user:pw@/league/join?code=ABC234', 'microhabit:///league/join?code=ABC234&code=DEF567',
    'microhabit:///league/join?code=ABC234#', 'microhabit:///league/join?code=ABC234#code=DEF567',
    'microhabit:///league/join?code=ABC234&next=anything', 'microhabit:///league/join?code=ABC%20DEF',
    'microhabit:///league/join?code=ABC234' + 'x'.repeat(2048), 'microhabit:///league/join',
  ]) assert.equal(links.parseInviteUrl(url), null, url.slice(0, 100));
});

test('installed Expo Go builder remains limited to its exact development host, port and path', () => {
  const links = linksFixture(true);
  assert.equal(links.buildInviteUrl('ABC234'), 'exp://192.0.2.1:8082/--/league/join?code=ABC234');
  assert.equal(links.parseInviteUrl(links.buildInviteUrl('ABC234')), 'ABC234');
  for (const url of ['exp://192.0.2.2:8082/--/league/join?code=ABC234', 'exp://192.0.2.1:8081/--/league/join?code=ABC234', 'exp://192.0.2.1:8082/league/join?code=ABC234']) {
    assert.equal(links.parseInviteUrl(url), null);
  }
});

test('shared message keeps the readable code and honest manual installation fallback', () => {
  const links = linksFixture();
  const message = links.buildInviteMessage('abc234');
  assert.match(message, /Invite code: ABC234/);
  assert.ok(message.includes(links.buildInviteUrl('abc234')));
  assert.match(message, /create an account/);
  assert.match(message, /Keep this code if you need to install first/);
  assert.doesNotMatch(message, /apps\.apple\.com|https:\/\/|automatically join/i);
});

test('stored invitations expire at seven days and old accounts are hidden immediately', () => {
  const now = Date.UTC(2026, 10, 1);
  const value = { code: 'ABC234', nonce: 'test-nonce', userId: 'user-a', createdAt: now };
  const stored = JSON.stringify({ version: 1, ...value });
  assert.deepEqual(invite.readStoredInvite(stored, now), value);
  assert.equal(invite.readStoredInvite(stored, now - 1), null);
  assert.equal(invite.readStoredInvite(stored, now + invite.INVITE_TTL_MS), null);
  assert.equal(invite.readStoredInvite('{broken', now), null);
  assert.equal(invite.readStoredInvite(JSON.stringify({ version: 1, ...value, code: 'not valid' }), now), null);
  assert.equal(invite.pendingInviteForUser(value, 'user-b', now), null);
  assert.equal(invite.pendingInviteForUser(value, null, now), null);
  assert.equal(invite.pendingInviteForUser(value, 'user-a', now + invite.INVITE_TTL_MS), null);
  assert.equal(invite.pendingInviteForUser(value, 'user-a', now), value);
});

const { createPendingInviteStore } = moduleFrom('features/invitations/pending-store.ts', { './invite': invite });
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture(initial = null, overrides = {}) {
  let raw = initial;
  let clock = Date.UTC(2026, 10, 1);
  let sequence = 0;
  const calls = [];
  const storage = {
    async getItem(key) { calls.push(['get', key]); return raw; },
    async setItem(key, value) { calls.push(['set', key]); raw = value; },
    async removeItem(key) { calls.push(['remove', key]); raw = null; },
    ...overrides,
  };
  const store = createPendingInviteStore(storage, 'test-invite-only', { now: () => clock, nonce: () => `nonce-${++sequence}`, onChange() {} });
  return { store, calls, storage, raw: () => raw, advance: (ms) => { clock += ms; } };
}

test('anonymous invitation persists through signup binding and restart; duplicate delivery reuses nonce', async () => {
  const f = fixture();
  await f.store.setAuth(null, false);
  const first = await f.store.capture(' abc234 ');
  const duplicate = await f.store.capture('ABC234');
  assert.equal(first.nonce, duplicate.nonce);
  assert.equal(first.userId, null);
  await f.store.setAuth('user-a', false);
  assert.equal(f.store.getSnapshot().pending.userId, 'user-a');
  assert.equal(f.store.getSnapshot().pending.nonce, first.nonce);
  const restored = fixture(f.raw()); await restored.store.setAuth('user-a', false);
  assert.equal(restored.store.getSnapshot().pending.nonce, first.nonce);
  assert.equal((await restored.store.capture('ABC234')).nonce, first.nonce);
  assert.ok(f.calls.every((call) => call[1] === 'test-invite-only'));
});

test('new invitation survives a stale conditional clear; clearing allows a fresh retap', async () => {
  const f = fixture(); await f.store.setAuth('user-a', false);
  const a = await f.store.capture('AAA234');
  const b = await f.store.capture('BBB234');
  await f.store.clear(a.nonce);
  assert.equal(f.store.getSnapshot().pending.nonce, b.nonce);
  await f.store.clear(b.nonce);
  assert.equal(f.store.getSnapshot().pending, null);
  assert.equal(f.raw(), null);
  const c = await f.store.capture('BBB234');
  assert.notEqual(c.nonce, b.nonce);
});

test('signout and account replacement erase old intent without assigning it to the new account', async () => {
  const f = fixture(); await f.store.setAuth('user-a', false); await f.store.capture('AAA234');
  const change = f.store.setAuth('user-b', false);
  assert.equal(f.store.getSnapshot().pending, null);
  await change;
  assert.equal(f.raw(), null);
  assert.equal((await f.store.capture('BBB234')).userId, 'user-b');
  await f.store.setAuth(null, false, true);
  assert.equal(f.store.getSnapshot().pending, null);
  assert.equal(f.raw(), null);
});

test('slow hydration cannot resurrect an invitation after explicit signout', async () => {
  const read = deferred();
  const f = fixture(null, { getItem: () => read.promise });
  const hydration = f.store.start();
  await Promise.resolve();
  const signout = f.store.setAuth(null, false, true);
  read.resolve(JSON.stringify({ version: 1, code: 'AAA234', nonce: 'old', userId: 'user-a', createdAt: Date.UTC(2026, 10, 1) }));
  await Promise.all([hydration, signout]);
  assert.equal(f.store.getSnapshot().ready, true);
  assert.equal(f.store.getSnapshot().pending, null);
});

test('capture serializes behind hydration and does not lose the newer invitation', async () => {
  const read = deferred(); const f = fixture(null, { getItem: () => read.promise });
  const capture = f.store.capture('NEW234');
  await Promise.resolve();
  read.resolve(JSON.stringify({ version: 1, code: 'OLD234', nonce: 'old', userId: null, createdAt: Date.UTC(2026, 10, 1) }));
  const captured = await capture;
  assert.equal(captured.code, 'NEW234');
  assert.equal(f.store.getSnapshot().pending.code, 'NEW234');
});

test('storage read/write failures settle ready and do not fabricate a remembered invitation', async () => {
  const f = fixture(null, { async getItem() { throw new Error('private keychain details'); } });
  await f.store.start();
  assert.equal(f.store.getSnapshot().ready, true);
  assert.equal(f.store.getSnapshot().pending, null);
  assert.match(f.store.getSnapshot().error, /still sign in/);
  assert.doesNotMatch(f.store.getSnapshot().error, /private/);
  f.storage.setItem = async () => { throw new Error('private write details'); };
  await assert.rejects(f.store.capture('AAA234'), /still sign in/);
  assert.equal(f.store.getSnapshot().pending, null);
  assert.equal(f.store.getSnapshot().ready, true);
});

test('expiry on refresh removes both visible and persisted state', async () => {
  const f = fixture(); await f.store.setAuth('user-a', false); await f.store.capture('AAA234');
  f.advance(invite.INVITE_TTL_MS); await f.store.refresh();
  assert.equal(f.store.getSnapshot().pending, null);
  assert.equal(f.raw(), null);
});

test('a bound record from another account is discarded during hydration', async () => {
  const raw = JSON.stringify({ version: 1, code: 'AAA234', nonce: 'old', userId: 'user-a', createdAt: Date.UTC(2026, 10, 1) });
  const f = fixture(raw); await f.store.setAuth('user-b', false);
  assert.equal(f.store.getSnapshot().pending, null);
  assert.equal(f.raw(), null);
});

test('signout during a capture write prevents late publication and removes that stored intent', async () => {
  const started = deferred(); const release = deferred();
  const f = fixture(); await f.store.setAuth('user-a', false);
  const write = f.storage.setItem;
  f.storage.setItem = async (key, value) => { started.resolve(); await release.promise; await write(key, value); };
  const capture = f.store.capture('AAA234');
  const rejected = assert.rejects(capture, /still sign in/);
  await started.promise;
  const signout = f.store.setAuth(null, false, true);
  assert.equal(f.store.getSnapshot().pending, null);
  release.resolve(); await Promise.all([rejected, signout]);
  assert.equal(f.store.getSnapshot().pending, null);
  assert.equal(f.raw(), null);
});

test('an account switch during anonymous binding cannot publish the old binding', async () => {
  const started = deferred(); const release = deferred();
  const f = fixture(); await f.store.setAuth(null, false); await f.store.capture('AAA234');
  const write = f.storage.setItem;
  f.storage.setItem = async (key, value) => { started.resolve(); await release.promise; await write(key, value); };
  const binding = f.store.setAuth('user-a', false); await started.promise;
  const switching = f.store.setAuth('user-b', false);
  assert.equal(f.store.getSnapshot().pending, null);
  release.resolve(); await Promise.all([binding, switching]);
  assert.equal(f.store.getSnapshot().pending, null);
  assert.equal(f.raw(), null);
});

test('a failed erase hides old data and leaves login unblocked with a safe error', async () => {
  const f = fixture(); await f.store.setAuth('user-a', false); await f.store.capture('AAA234');
  f.storage.removeItem = async () => { throw new Error('private erase failure'); };
  await f.store.setAuth(null, false, true);
  assert.equal(f.store.getSnapshot().ready, true);
  assert.equal(f.store.getSnapshot().pending, null);
  assert.match(f.store.getSnapshot().error, /still sign in/);
  assert.doesNotMatch(f.store.getSnapshot().error, /private/);
});
