import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash, webcrypto } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { consumeAuthCallback } from './callback.ts';
import { pendingPkceFlow } from './pkce-flow.ts';
import { createSessionStorage } from '../../lib/session-storage.ts';
import { supplyPkceCrypto } from '../../lib/pkce-crypto.ts';

function memory() {
  const map = new Map();
  return { map, async getItem(k) { return map.get(k) ?? null; }, async setItem(k,v) { map.set(k,v); }, async removeItem(k) { map.delete(k); } };
}
function fixture() {
  const secure = memory(), legacy = memory(), storage = createSessionStorage(secure, legacy);
  const state = { challenge: null, requests: 0 };
  const auth = createClient('https://synthetic.example.invalid', 'synthetic-public-key', {
    auth: { flowType: 'pkce', storageKey: 'test-auth', storage, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, options = {}) => {
      state.requests++;
      const body = JSON.parse(options.body ?? '{}');
      if (String(url).includes('/recover') || String(url).includes('/signup')) {
        state.challenge = body.code_challenge;
        assert.equal(body.code_challenge_method, 's256');
        return Response.json(String(url).includes('/signup') ? { id: 'synthetic-user', email: 'nobody@example.invalid', identities: [] } : {});
      }
      if (String(url).includes('/token?grant_type=pkce')) {
        const challenge = createHash('sha256').update(body.code_verifier).digest('base64url');
        if (body.auth_code !== 'synthetic-code' || challenge !== state.challenge) return Response.json({ code: 'invalid_grant', msg: 'Verifier does not match' }, { status: 400 });
        return Response.json({ access_token: 'synthetic-session-token', refresh_token: 'synthetic-refresh-token', expires_in: 3600, token_type: 'bearer', user: { id: 'synthetic-user', email: 'nobody@example.invalid' } });
      }
      throw Error('Unexpected mocked endpoint');
    } },
  }).auth;
  const consume = url => consumeAuthCallback(url, {
    exchangeCodeForSession: code => auth.exchangeCodeForSession(code),
    getPendingFlow: async () => pendingPkceFlow(await storage.getItem('test-auth-code-verifier')),
  });
  return { auth, consume, storage, state, secure, legacy };
}

test('native PKCE bridge supplies SHA-256 and secure randomness without replacing existing crypto', async () => {
  const target = {};
  supplyPkceCrypto(target, a => webcrypto.getRandomValues(a), data => webcrypto.subtle.digest('SHA-256', data));
  const values = target.getRandomValues(new Uint32Array(56));
  assert.ok(values.some(v => v !== 0));
  const bytes = new TextEncoder().encode('abc');
  const expected = createHash('sha256').update('abc').digest('hex');
  assert.equal(Buffer.from(await target.subtle.digest('SHA-256', bytes)).toString('hex'), expected);
  await assert.rejects(target.subtle.digest('MD5', bytes), /Unsupported/);
  const original = { getRandomValues: target.getRandomValues, subtle: target.subtle };
  supplyPkceCrypto(target, () => { throw Error('replaced'); }, () => { throw Error('replaced'); });
  assert.equal(target.getRandomValues, original.getRandomValues);
  assert.equal(target.subtle, original.subtle);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Object.defineProperty(globalThis, 'crypto', { value: target, configurable: true });
    const f = fixture();
    const started = await f.auth.signInWithOAuth({ provider: 'google', options: { skipBrowserRedirect: true } });
    assert.equal(started.error, null);
    const url = new URL(started.data.url);
    const verifier = JSON.parse(await f.storage.getItem('test-auth-code-verifier'));
    assert.equal(url.searchParams.get('code_challenge_method'), 's256');
    assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(verifier).digest('base64url'));
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    else delete globalThis.crypto;
  }
});

test('actual SDK rejects missing verifiers before a token request', async () => {
  const f = fixture();
  const result = await f.auth.exchangeCodeForSession('synthetic-code');
  assert.ok(result.error);
  assert.equal(f.state.requests, 0);
  assert.equal((await f.consume('microhabit://sign-in?code=synthetic-code')).kind, 'error');
  assert.equal(f.state.requests, 0);
});

test('actual SDK OAuth requests use S256, keep verifier protected and consume it once', async () => {
  for (const provider of ['google', 'apple']) {
    const f = fixture();
    const started = await f.auth.signInWithOAuth({ provider, options: { redirectTo: 'microhabit://sign-in', skipBrowserRedirect: true } });
    assert.equal(started.error, null);
    const url = new URL(started.data.url);
    assert.equal(url.searchParams.get('code_challenge_method'), 's256');
    f.state.challenge = url.searchParams.get('code_challenge');
    assert.equal(pendingPkceFlow(await f.storage.getItem('test-auth-code-verifier')), 'sign-in');
    assert.equal(f.legacy.map.size, 0);
    assert.deepEqual(await f.consume('microhabit://sign-in?code=synthetic-code'), { kind: 'signed-in' });
    assert.equal(await f.storage.getItem('test-auth-code-verifier'), null);
    assert.equal((await f.consume('microhabit://sign-in?code=synthetic-code')).kind, 'error');
    assert.equal(f.state.requests, 1);
    await f.storage.removeItem('test-auth');
  }
});

test('actual SDK reset flow remains recovery across storage reload and rejects spoofed type', async () => {
  const f = fixture();
  const requested = await f.auth.resetPasswordForEmail('nobody@example.invalid', { redirectTo: 'microhabit://update-password' });
  assert.equal(requested.error, null);
  const restarted = createSessionStorage(f.secure, f.legacy);
  assert.equal(pendingPkceFlow(await restarted.getItem('test-auth-code-verifier')), 'recovery');
  assert.deepEqual(await f.consume('microhabit://update-password?code=synthetic-code'), { kind: 'recovery' });
  assert.equal(await f.storage.getItem('test-auth-code-verifier'), null);
});

test('a code from a different PKCE request cannot create a session', async () => {
  const f = fixture();
  await f.auth.signInWithOAuth({ provider: 'google', options: { skipBrowserRedirect: true } });
  f.state.challenge = 'challenge-from-a-different-request';
  assert.equal((await f.consume('microhabit://sign-in?code=synthetic-code')).kind, 'error');
  assert.equal((await f.auth.getSession()).data.session, null);
});

test('signup stores a protected verifier; malformed or unknown local flow markers are rejected', async () => {
  const f = fixture();
  assert.equal((await f.auth.signUp({ email: 'nobody@example.invalid', password: 'synthetic-test-password', options: { emailRedirectTo: 'microhabit://sign-in' } })).error, null);
  assert.equal(pendingPkceFlow(await f.storage.getItem('test-auth-code-verifier')), 'sign-in');
  assert.equal(f.legacy.map.size, 0);
  for (const raw of [null, 'not-json', '123', '""', '"value/UNKNOWN"', '"value/PASSWORD_RECOVERY/extra"']) assert.equal(pendingPkceFlow(raw), null);
});
