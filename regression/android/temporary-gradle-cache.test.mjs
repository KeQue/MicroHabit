import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedGradleCache } from './temporary-gradle-cache.mjs';

test('seeds downloads without copying locks or stale transforms', () => {
  const root = mkdtempSync(join(tmpdir(), 'gradle-seed-test-'));
  try {
    const source = join(root, 'source'), destination = join(root, 'destination');
    for (const dir of ['caches/modules-2/files', 'caches/8.14/transforms', 'wrapper/dists']) mkdirSync(join(source, dir), { recursive: true });
    writeFileSync(join(source, 'caches/modules-2/files/dependency'), 'artifact');
    writeFileSync(join(source, 'caches/modules-2/cache.lock'), 'lock');
    writeFileSync(join(source, 'caches/8.14/transforms/stale'), 'old path');
    writeFileSync(join(source, 'wrapper/dists/gradle'), 'wrapper');
    seedGradleCache(source, destination);
    assert.equal(readFileSync(join(destination, 'caches/modules-2/files/dependency'), 'utf8'), 'artifact');
    assert.equal(readFileSync(join(destination, 'wrapper/dists/gradle'), 'utf8'), 'wrapper');
    assert.equal(existsSync(join(destination, 'caches/modules-2/cache.lock')), false);
    assert.equal(existsSync(join(destination, 'caches/8.14/transforms/stale')), false);
    assert.equal(readFileSync(join(source, 'caches/8.14/transforms/stale'), 'utf8'), 'old path');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
