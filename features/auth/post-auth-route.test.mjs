import test from 'node:test';
import assert from 'node:assert/strict';
import { postAuthRoute } from './post-auth-route.ts';

const pending = { code: 'ABC123', nonce: 'intent-a', userId: 'user-a', createdAt: 1 };
const base = { userId: 'user-a', initializing: false, initialLinkChecked: true,
  processingAuthLink: false, passwordRecovery: false, pendingReady: true,
  pending, segments: ['(auth)', 'sign-in'], lastOffered: null };

test('ordinary email, social and confirmed signup share one invitation destination', () => {
  for (const screen of ['sign-in', 'sign-up', 'check-email']) {
    assert.deepEqual(postAuthRoute({ ...base, segments: ['(auth)', screen] }),
      { code: 'ABC123', nonce: 'intent-a', offeredKey: 'user-a:intent-a' });
  }
});
test('auth initialization, callback processing and recovery take priority over invites', () => {
  for (const patch of [{ initializing: true }, { initialLinkChecked: false },
    { processingAuthLink: true }, { pendingReady: false }]) {
    assert.equal(postAuthRoute({ ...base, ...patch }), null);
  }
  assert.equal(postAuthRoute({ ...base, passwordRecovery: true }), 'update-password');
  assert.equal(postAuthRoute({ ...base, segments: ['(auth)', 'update-password'] }), null);
});
test('signed-out and different-account sessions cannot receive an old invitation', () => {
  assert.equal(postAuthRoute({ ...base, userId: null, segments: ['(app)'] }), 'sign-in');
  assert.equal(postAuthRoute({ ...base, userId: null }), null);
  assert.equal(postAuthRoute({ ...base, userId: 'user-b' }), 'app');
  assert.equal(postAuthRoute({ ...base, pending: { ...pending, userId: null } }), 'app');
});
test('offer each intent once without trapping navigation; a fresh invite can still open', () => {
  const offered = { ...base, lastOffered: 'user-a:intent-a', segments: ['(app)', 'league', 'join'] };
  assert.equal(postAuthRoute(offered), null);
  assert.equal(postAuthRoute({ ...offered, segments: ['(app)'] }), null);
  assert.equal(postAuthRoute({ ...offered, pending: { ...pending, nonce: 'intent-b' } }).nonce, 'intent-b');
  assert.equal(postAuthRoute({ ...base, pending: null }), 'app');
});
