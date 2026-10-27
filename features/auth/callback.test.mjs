import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeAuthCallback, parseAuthCallbackUrl } from './callback.ts';

function fakeAuth({ error = null, recovery = false } = {}) {
  const calls = [];
  return {
    calls,
    async getPendingFlow() { return recovery ? "recovery" : "sign-in"; },
    async exchangeCodeForSession(code) {
      calls.push(code);
      return { error, data: { redirectType: recovery ? 'PASSWORD_RECOVERY' : null } };
    },
  };
}

test('trusted native PKCE reset links preserve the locally bound recovery flow', async () => {
  for (const base of ['microhabit://update-password', 'microhabit://update-password/', 'microhabit:///update-password']) {
    const auth = fakeAuth({ recovery: true });
    assert.deepEqual(await consumeAuthCallback(`${base}?code=synthetic`, auth), { kind: 'recovery' });
    assert.deepEqual(auth.calls, ['synthetic']);
  }
});

test('Expo callbacks require the exact configured development address', async () => {
  const redirects = ['exp://192.0.2.1:8082/--/update-password'];
  const auth = fakeAuth({ recovery: true });
  assert.equal((await consumeAuthCallback(redirects[0] + '?code=synthetic', auth)).kind, 'none');
  assert.equal((await consumeAuthCallback(redirects[0] + '?code=synthetic', auth, redirects)).kind, 'recovery');
  assert.equal((await consumeAuthCallback('exp://192.0.2.2:8082/--/update-password?code=synthetic', auth, redirects)).kind, 'none');
  assert.equal(auth.calls.length, 1);
});

test('wrong origins, schemes, credentials, ports and paths never exchange a code', async () => {
  const auth = fakeAuth();
  for (const url of [
    'https://unrelated.example/sign-in?code=synthetic',
    'otherapp://sign-in?code=synthetic',
    'microhabit://attacker/sign-in?code=synthetic',
    'microhabit://user@sign-in?code=synthetic',
    'microhabit://sign-in:123?code=synthetic',
    'microhabit://sign-in/extra?code=synthetic',
    'microhabit://leagues?code=synthetic', 'not a URL',
  ]) {
    assert.equal(parseAuthCallbackUrl(url).isCallback, false, url);
    assert.equal((await consumeAuthCallback(url, auth)).kind, 'none', url);
  }
  assert.equal(auth.calls.length, 0);
});

test('implicit tokens, duplicate parameters and fragment codes never authenticate', async () => {
  const auth = fakeAuth();
  for (const suffix of [
    '#access_token=synthetic&refresh_token=synthetic&type=recovery',
    '?code=one&code=two', '?code=one#code=two', '#code=one',
    '?code=one&access_token=synthetic', '?access_token=synthetic',
    '?code=one&type=signup#type=recovery',
  ]) assert.equal((await consumeAuthCallback('microhabit://sign-in' + suffix, auth)).kind, 'error', suffix);
  assert.equal(auth.calls.length, 0);
});

test('URL recovery markers cannot turn an ordinary flow into recovery', async () => {
  for (const url of ['microhabit://update-password?code=synthetic', 'microhabit://sign-in?code=synthetic&type=recovery']) {
    assert.equal((await consumeAuthCallback(url, fakeAuth())).kind, 'error');
  }
  assert.deepEqual(await consumeAuthCallback('microhabit://sign-in?code=synthetic', fakeAuth({ recovery: true })), { kind: 'recovery' });
});

test('ordinary PKCE OAuth and confirmation callbacks still sign in', async () => {
  for (const url of ['microhabit://sign-in?code=synthetic', 'microhabit:///sign-in?code=synthetic&type=signup']) {
    assert.deepEqual(await consumeAuthCallback(url, fakeAuth()), { kind: 'signed-in' });
  }
});

test('expired links show an error without trying to authenticate', async () => {
  const auth = fakeAuth();
  assert.deepEqual(await consumeAuthCallback('microhabit://update-password#error_description=Link+expired', auth), { kind: 'error', message: 'Link expired' });
  assert.equal(auth.calls.length, 0);
});

test('a path alone cannot authenticate, and failed/missing-verifier exchanges fail', async () => {
  const auth = fakeAuth({ recovery: true, error: { message: 'PKCE verifier missing' } });
  for (const url of ['microhabit://update-password', 'microhabit://update-password?type=recovery']) {
    assert.equal((await consumeAuthCallback(url, auth)).kind, 'none');
  }
  assert.deepEqual(await consumeAuthCallback('microhabit://update-password?code=synthetic', auth), { kind: 'error', message: 'PKCE verifier missing' });
  const missing = fakeAuth();
  missing.getPendingFlow = async () => null;
  assert.equal((await consumeAuthCallback('microhabit://sign-in?code=synthetic', missing)).kind, 'error');
  assert.equal(missing.calls.length, 0);
  auth.exchangeCodeForSession = async () => { throw new Error('offline'); };
  assert.equal((await consumeAuthCallback('microhabit://sign-in?code=synthetic', auth)).kind, 'error');
});
