import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesIosSource } from './ios-source.mjs';

test('iOS requires its own full, matching source revision', () => {
  const sha = 'a'.repeat(40);
  assert.equal(matchesIosSource(sha, sha), true);
  assert.equal(matchesIosSource(sha, 'b'.repeat(40)), false);
  assert.equal(matchesIosSource('', ''), false);
  assert.equal(matchesIosSource('abc', 'abc'), false);
});
