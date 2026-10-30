import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAndroidReport } from './ios-preflight.mjs';

const sha = 'a'.repeat(40);
const screenshot = { status: 'CAPTURED', stateBefore: { serverLoaded: true }, stateAfter: { serverLoaded: true } };
const passed = { sourceRevision: sha, platform: 'android', backendEnvironment: 'production', backendHost: 'nzpnfrutomyuvrprkrwi.supabase.co', status: 'PASS', evidenceStatus: 'COMPLETE', attempts: [{ status: 'PASS', screenshot }] };
test('only a matching Android pass with complete evidence qualifies', () => {
  assert.equal(validateAndroidReport(passed, sha), null);
  assert.ok(validateAndroidReport(passed, 'b'.repeat(40)));
  assert.ok(validateAndroidReport({ ...passed, evidenceStatus: 'INCOMPLETE' }, sha));
  assert.ok(validateAndroidReport({ ...passed, backendHost: 'other.example.com' }, sha));
  assert.ok(validateAndroidReport({ ...passed, attempts: [{ status: 'PASS', screenshot: { ...screenshot, stateAfter: {} } }] }, sha));
  assert.ok(validateAndroidReport({ ...passed, attempts: [{ status: 'FAIL', screenshot: {} }, ...passed.attempts] }, sha));
  assert.equal(validateAndroidReport({ ...passed, attempts: [{ status: 'FAIL', screenshot }, ...passed.attempts] }, sha), null);
});
