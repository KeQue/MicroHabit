import test from 'node:test';
import assert from 'node:assert/strict';
import { nativePathFailures } from './build-diagnostics.mjs';

test('extracts only safe native path categories and lengths', () => {
  const log = 'ninja: error: Stat(C:/tmp/cm-a/private-token/header.h): Filename longer than 260 characters\n' +
    'ninja: error: Stat(relative/secret.o): Filename longer than 260 characters\n';
  const result = nativePathFailures(log, 'C:\\tmp\\cm-a', 'C:\\project');
  assert.deepEqual(result, [
    { location: 'gradle-cache', length: 'C:/tmp/cm-a/private-token/header.h'.length },
    { location: 'other-or-relative', length: 'relative/secret.o'.length },
  ]);
  assert.equal(JSON.stringify(result).includes('secret'), false);
  assert.deepEqual(nativePathFailures('unrelated secret', 'C:/tmp/cm-a', 'C:/project'), []);
});
