import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseBuildDrive, parseMappings } from './short-path.mjs';

test('chooses only an unused drive and parses mappings without changing them', () => {
  assert.equal(chooseBuildDrive(new Set(['X:', 'Y:'])), 'Z:');
  assert.equal(chooseBuildDrive(new Set(['X:', 'Y:', 'Z:', 'R:', 'Q:'])), null);
  const used = new Set(['X:', 'Y:', 'Z:']);
  const cacheDrive = chooseBuildDrive(used);
  used.add(cacheDrive);
  assert.equal(chooseBuildDrive(used), 'Q:');
  used.add('Q:');
  assert.equal(chooseBuildDrive(used), null);
  assert.equal(parseMappings('X:\\: => C:\\Example\\Cache\r\n').get('X:'), 'c:\\example\\cache');
});
