import test from 'node:test';
import assert from 'node:assert/strict';
import { deletionHandler, notificationHandler, appleVerifier } from './_shared/apple-deletion.ts';
import { runtime } from './_shared/apple-runtime.ts';

const now = 1793290000;
const request = (value = {}, auth = 'Bearer current-user') => new Request('https://local.invalid', {
  method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) }, body: JSON.stringify(value),
});
function fixture(overrides = {}) {
  const calls = [];
  let receipt = null;
  const deps = {
    authenticate: async token => token === 'current-user' ? 'uuid-current' : null,
    context: async () => ({ uses_apple: true, apple_subject: 'apple-current', receipt }),
    prepare: async (...args) => { calls.push(['prepare', ...args]); receipt = { state: args[3], token_hash: args[2] }; },
    deleteCurrent: async token => calls.push(['delete', token]),
    refresh: async token => { calls.push(['refresh', token]); return { id_token: 'identity' }; },
    revoke: async token => calls.push(['revoke', token]),
    verify: async () => ({ sub: 'apple-current', iat: now, events: { type: 'consent-revoked', sub: 'apple-current', event_time: now } }),
    invalidate: async (...args) => calls.push(['invalidate', ...args]), now: () => now,
    ...overrides,
  };
  return { deps, calls };
}
test('delete authenticates current UUID, rejects supplied account selection and bounds actual body', async () => {
  const { deps, calls } = fixture(); const handler = deletionHandler(deps);
  assert.equal((await handler(request({}, ''))).status, 401);
  assert.equal((await handler(request({}, 'Bearer fake'))).status, 401);
  assert.equal((await handler(request({ user_id: 'other' }))).status, 400);
  assert.equal((await handler(request({ apple_refresh_token: 'x'.repeat(17000) }))).status, 413);
  assert.deepEqual(calls, []);
});
test('identity is checked before revoke, receipt before provider call, user JWT owns deletion', async () => {
  const { deps, calls } = fixture();
  const response = await deletionHandler(deps)(request({ apple_refresh_token: 'refresh-secret' }));
  const result = await response.json();
  assert.deepEqual(result, { deleted: true, apple_access: 'revoked' });
  assert.deepEqual(calls.map(c => c[0]), ['refresh', 'prepare', 'revoke', 'prepare', 'delete']);
  assert.equal(calls[1][1], 'uuid-current'); assert.equal(calls[1][2], 'apple-current');
  assert.match(calls[1][3], /^[a-f0-9]{64}$/); assert.equal(calls.at(-1)[1], 'current-user');
  assert.ok(!JSON.stringify(result).includes('refresh-secret'));
});
test('another Apple subject or unverified identity cannot revoke or delete', async () => {
  for (const verify of [async () => ({ sub: 'other' }), async () => { throw Error('bad signature'); }]) {
    const { deps, calls } = fixture({ verify });
    assert.equal((await deletionHandler(deps)(request({ apple_refresh_token: 'other-token' }))).status, 409);
    assert.deepEqual(calls.map(c => c[0]), ['refresh']);
  }
});
test('missing token, provider denial, provider outage allow honest manual removal', async () => {
  for (const refresh of [async () => null, async () => { throw Error('outage'); }]) {
    for (const input of [{}, { apple_refresh_token: 'stale-token' }]) {
      const { deps, calls } = fixture({ refresh });
      assert.deepEqual(await (await deletionHandler(deps)(request(input))).json(), { deleted: true, apple_access: 'manual_required' });
      assert.equal(calls.some(c => c[0] === 'revoke'), false); assert.equal(calls.at(-1)[0], 'delete');
    }
  }
});
test('non-Apple account needs no provider calls', async () => {
  const { deps, calls } = fixture({ context: async () => ({ uses_apple: false, receipt: null, apple_subject: null }) });
  assert.deepEqual(await (await deletionHandler(deps)(request())).json(), { deleted: true, apple_access: 'not_linked' });
  assert.deepEqual(calls, [['delete', 'current-user']]);
});
test('database failure after revoke retries via persisted receipt without Apple reuse', async () => {
  const { deps, calls } = fixture(); let fail = true;
  deps.deleteCurrent = async () => { if (fail) throw Error('db'); calls.push(['delete']); };
  const handler = deletionHandler(deps);
  assert.equal((await handler(request({ apple_refresh_token: 'refresh' }))).status, 503);
  fail = false; calls.length = 0;
  assert.equal((await handler(request({ apple_refresh_token: 'refresh' }))).status, 200);
  assert.deepEqual(calls, [['delete']]);
});
test('pending same-token receipt retries revocation even after provider refresh invalidation', async () => {
  const { deps, calls } = fixture(); let unavailable = true;
  const prepare = deps.prepare;
  deps.prepare = async (...args) => { if (args[3] === 'revoked' && unavailable) throw Error('db'); return prepare(...args); };
  deps.deleteCurrent = async () => { if (unavailable) throw Error('db'); calls.push(['delete']); };
  const handler = deletionHandler(deps);
  assert.equal((await handler(request({ apple_refresh_token: 'refresh' }))).status, 503);
  unavailable = false; calls.length = 0; deps.refresh = async () => { throw Error('must not refresh'); };
  assert.equal((await handler(request({ apple_refresh_token: 'refresh' }))).status, 200);
  assert.deepEqual(calls.map(c => c[0]), ['prepare', 'revoke', 'prepare', 'delete']);
});
test('notification only invalidates sessions by signed subject/cutoff; never deletes linked account', async () => {
  for (const type of ['consent-revoked', 'account-deleted', 'account-delete']) {
    const { deps, calls } = fixture({ verify: async () => ({ iat: now, events: JSON.stringify({ type, sub: 'apple-current', event_time: now - 100 }) }) });
    const handler = notificationHandler(deps);
    assert.equal((await handler(request({ payload: 'signed' }))).status, 200);
    assert.equal((await handler(request({ payload: 'signed' }))).status, 200);
    assert.deepEqual(calls, [['invalidate', 'apple-current', now - 100], ['invalidate', 'apple-current', now - 100]]);
  }
});
test('fake notifications, malformed events and future cutoffs make no mutation; unknown event acknowledged', async () => {
  for (const verify of [async () => { throw Error('fake'); }, async () => ({ iat: now, events: { type: 'account-deleted', sub: 'x', event_time: now + 301 } })]) {
    const { deps, calls } = fixture({ verify });
    assert.ok((await notificationHandler(deps)(request({ payload: 'fake' }))).status >= 400); assert.deepEqual(calls, []);
  }
  const { deps, calls } = fixture({ verify: async () => ({ iat: now, events: { type: 'email-disabled', sub: 'x', event_time: now } }) });
  assert.equal((await notificationHandler(deps)(request({ payload: 'signed' }))).status, 200); assert.deepEqual(calls, []);
});

const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...await crypto.subtle.exportKey('jwk', pair.publicKey), kid: 'synthetic', alg: 'RS256', use: 'sig' };
const encode = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
async function sign(claims, header = { alg: 'RS256', kid: 'synthetic' }) {
  const data = encode(header) + '.' + encode(claims);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(data));
  return data + '.' + Buffer.from(signature).toString('base64url');
}
const verifier = (key = jwk) => appleVerifier({ clientId: 'services-id', notificationAudiences: ['native-group'], now: () => now,
  fetch: async url => { assert.equal(url, 'https://appleid.apple.com/auth/keys'); return Response.json({ keys: [key] }); } });
const claims = { iss: 'https://appleid.apple.com', aud: 'services-id', iat: now, exp: now + 600, sub: 'subject' };
test('real RSA verification accepts identity and notifications without undocumented exp requirement', async () => {
  assert.equal((await verifier()(await sign(claims), 'identity')).sub, 'subject');
  const notification = { ...claims, aud: 'native-group', jti: 'event-1' }; delete notification.exp;
  assert.equal((await verifier()(await sign(notification), 'notification')).jti, 'event-1');
});
test('RSA trust boundary rejects wrong issuer/audience/timestamps/algorithm/key/signature', async () => {
  for (const changed of [{ iss: 'evil' }, { aud: 'native-group' }, { exp: now }, { iat: now + 301 }, { iat: now - 604801 }, { exp: undefined }, { sub: '' }]) {
    await assert.rejects(verifier()(await sign({ ...claims, ...changed }), 'identity'));
  }
  await assert.rejects(verifier()(await sign(claims, { alg: 'none', kid: 'synthetic' }), 'identity'));
  await assert.rejects(verifier()(await sign(claims, { alg: 'RS256', kid: 'other' }), 'identity'));
  const signed = await sign(claims); const pieces = signed.split('.'); pieces[1] = encode({ ...claims, sub: 'attacker' });
  await assert.rejects(verifier()(pieces.join('.'), 'identity'));
  await assert.rejects(verifier({ ...jwk, use: 'enc' })(signed, 'identity'));
  await assert.rejects(verifier()(await sign({ ...claims, aud: 'native-group', jti: '' }), 'notification'));
});
test('runtime adapter authenticates user JWT and scopes service RPC credentials separately', async () => {
  const seen = [];
  const env = { SUPABASE_URL: 'https://project.invalid', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'server-secret', APPLE_CLIENT_ID: 'services-id', APPLE_CLIENT_SECRET: 'apple-secret' };
  const deps = runtime(name => env[name], async (url, options) => {
    seen.push([url, options]);
    if (url.endsWith('/user')) return Response.json({ id: 'current-id' });
    return Response.json(null);
  });
  assert.equal(await deps.authenticate('current-jwt'), 'current-id');
  await deps.prepare('current-id', 'subject', 'hash', 'pending'); await deps.deleteCurrent('current-jwt');
  assert.equal(seen[0][1].headers.Authorization, 'Bearer current-jwt');
  assert.equal(seen[1][1].headers.Authorization, 'Bearer server-secret');
  assert.equal(seen[2][1].headers.Authorization, 'Bearer current-jwt');
  assert.equal(seen[2][1].headers.apikey, 'anon');
});
