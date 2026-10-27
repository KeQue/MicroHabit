import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeAuthCallback, parseAuthCallbackUrl } from './callback.ts';

function fakeAuth(error = null) {
  const calls = [];
  return {
    calls,
    async exchangeCodeForSession(code) { calls.push(['code', code]); return { error }; },
    async setSession(tokens) { calls.push(['tokens', tokens]); return { error }; },
  };
}

test('native and Expo recovery links all open recovery after session validation', async () => {
  for (const base of [
    'microhabit://update-password',
    'microhabit://update-password/',
    'microhabit:///update-password',
    'exp://192.0.2.1:8082/--/update-password',
  ]) {
    const auth = fakeAuth();
    const result = await consumeAuthCallback(`${base}#access_token=fake-access&refresh_token=fake-refresh&type=recovery`, auth);
    assert.deepEqual(result, { kind: 'recovery' });
    assert.equal(auth.calls.length, 1);
  }
});

test('PKCE reset links without a type parameter remain recovery links', async () => {
  const auth = fakeAuth();
  assert.deepEqual(await consumeAuthCallback('microhabit://update-password?code=fake-code', auth), { kind: 'recovery' });
  assert.deepEqual(auth.calls, [['code', 'fake-code']]);
});

test('recovery type on the sign-in callback is also preserved', async () => {
  assert.deepEqual(await consumeAuthCallback('microhabit://sign-in#access_token=a&refresh_token=r&type=recovery', fakeAuth()), { kind: 'recovery' });
});

test('ordinary OAuth and confirmation callbacks still sign in normally', async () => {
  for (const url of ['microhabit://sign-in?code=fake-code', 'microhabit:///sign-in#access_token=a&refresh_token=r&type=signup']) {
    assert.deepEqual(await consumeAuthCallback(url, fakeAuth()), { kind: 'signed-in' });
  }
});

test('expired links show the decoded error without trying to authenticate', async () => {
  const auth = fakeAuth();
  assert.deepEqual(await consumeAuthCallback('microhabit://update-password#error_description=Link+expired%3A+request+another%25', auth), { kind: 'error', message: 'Link expired: request another%' });
  assert.equal(auth.calls.length, 0);
});

test('a reset path alone cannot establish recovery; incomplete credentials fail', async () => {
  const auth = fakeAuth();
  for (const url of ['not a URL', 'microhabit://update-password', 'microhabit://update-password?type=recovery', 'microhabit://leagues?code=fake']) {
    assert.equal(parseAuthCallbackUrl(url).isCallback, false);
    assert.deepEqual(await consumeAuthCallback(url, auth), { kind: 'none' });
  }
  assert.equal((await consumeAuthCallback('microhabit://update-password#access_token=a', auth)).kind, 'error');
  assert.equal(auth.calls.length, 0);
});

test('failed code exchanges and network errors never report successful recovery', async () => {
  assert.deepEqual(await consumeAuthCallback('microhabit://update-password?code=expired', fakeAuth({ message: 'Expired code' })), { kind: 'error', message: 'Expired code' });
  const auth = fakeAuth();
  auth.setSession = async () => { throw new Error('offline'); };
  assert.equal((await consumeAuthCallback('microhabit://update-password#access_token=a&refresh_token=r', auth)).kind, 'error');
});
