import test from 'node:test';
import assert from 'node:assert/strict';
import { canReuse, fingerprint, isAppInput } from './apk-fingerprint.mjs';

test('app input changes invalidate the build while regression files do not', () => {
  assert.equal(isAppInput('app/index.tsx'), true);
  assert.equal(isAppInput('regression/android/run.ps1'), false);
  assert.equal(isAppInput('tests/e2e/scripts/run.mjs'), false);
  const before = fingerprint([['app/index.tsx', 'one'], ['package-lock.json', 'lock']]);
  assert.equal(before, fingerprint([['package-lock.json', 'lock'], ['app/index.tsx', 'one']]));
  assert.notEqual(before, fingerprint([['app/index.tsx', 'two'], ['package-lock.json', 'lock']]));
  assert.equal(canReuse({ version: 1, inputHash: before, apkHash: 'a'.repeat(64) }, before, 'a'.repeat(64)), true);
  assert.equal(canReuse({ version: 1, inputHash: before, apkHash: 'a'.repeat(64) }, before, 'b'.repeat(64)), false);
  assert.equal(canReuse(null, before, 'a'.repeat(64)), false);
});
