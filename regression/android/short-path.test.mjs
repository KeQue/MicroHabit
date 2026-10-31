import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseBuildDrive, parseMappings } from './short-path.mjs';

test('chooses only an unused drive and parses mappings without changing them', () => {
  assert.equal(chooseBuildDrive(new Set(['X:', 'Y:'])), 'Z:');
  assert.equal(chooseBuildDrive(new Set(['X:', 'Y:', 'Z:', 'R:', 'Q:'])), null);
  assert.equal(parseMappings('X:\\: => C:\\Example\\Cache\r\n').get('X:'), 'c:\\example\\cache');
});
