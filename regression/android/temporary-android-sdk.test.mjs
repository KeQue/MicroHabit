import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareAndroidSdk, removeAndroidSdk } from './temporary-android-sdk.mjs';

test('uses a private CMake copy and leaves installed SDK files untouched', () => {
  const root = mkdtempSync(join(tmpdir(), 'sdk-test-'));
  try {
    const source = join(root, 'source'), destination = join(root, 'destination');
    mkdirSync(join(source, 'cmake/3.22.1/bin'), { recursive: true });
    mkdirSync(join(source, 'platforms'), { recursive: true });
    mkdirSync(destination);
    writeFileSync(join(source, 'cmake/3.22.1/bin/ninja.exe'), 'old');
    writeFileSync(join(source, 'platforms/marker'), 'platform');
    const ninja = join(root, 'ninja.exe'); writeFileSync(ninja, 'new');
    prepareAndroidSdk(source, destination, ninja);
    assert.equal(readFileSync(join(destination, 'cmake/3.22.1/bin/ninja.exe'), 'utf8'), 'new');
    assert.equal(readFileSync(join(destination, 'platforms/marker'), 'utf8'), 'platform');
    removeAndroidSdk(destination);
    assert.equal(readFileSync(join(source, 'cmake/3.22.1/bin/ninja.exe'), 'utf8'), 'old');
    assert.equal(readFileSync(join(source, 'platforms/marker'), 'utf8'), 'platform');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
