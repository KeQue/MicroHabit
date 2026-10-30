import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { verifySource } from './ios-source-gate.mjs';

const base = 'a9ac59a4dc76d9e0781d265f334d9161aa6b3755';
const source = '1'.repeat(40);
function fixture({ changed = ['M', 'tests/e2e/scripts/run.mjs'], runnerEdit = '', testEdit = '', diagnosticEdit = '', ancestor = true } = {}) {
  return (command, args) => {
    assert.equal(command, 'git');
    if (args[0] === 'rev-parse') return { status: 0, stdout: `${source}\n` };
    if (args[0] === 'merge-base') return { status: ancestor ? 0 : 1, stdout: '' };
    if (args[0] === 'diff') return { status: 0, stdout: `${changed.join('\0')}\0` };
    if (args[0] === 'ls-tree') return { status: 0, stdout: '100644 blob 012345\tpath\n' };
    if (args[0] === 'show') {
      const [rev, path] = args[1].split(':');
      const text = rev === base ? execFileSync('git', ['show', `${base}:${path}`], { encoding: 'utf8' }) : readFileSync(path, 'utf8');
      return { status: 0, stdout: text + (path.endsWith('/run.mjs') && rev === source ? runnerEdit : '') + (path.endsWith('/login-attempt.test.mjs') && rev === source ? testEdit : '') + (path.endsWith('/screenshot.mjs') && rev === source ? diagnosticEdit : '') };
    }
    throw new Error('unexpected command');
  };
}
test('source gate accepts the reviewed iOS-only change and rejects shared changes', () => {
  assert.deepEqual(verifySource(base, source, fixture()), { ok: true, exception: true });
  assert.equal(verifySource(base, source, fixture({ changed: ['M', 'app/index.tsx'] })).reason, 'disallowed-change');
  assert.equal(verifySource(base, source, fixture({ runnerEdit: '\n// unexpected' })).reason, 'shared-runner-changed');
  assert.equal(verifySource(base, source, fixture({ testEdit: '\n// unexpected' })).reason, 'shared-tests-changed');
  assert.equal(verifySource(base, source, fixture({ changed: ['M', 'tests/e2e/scripts/screenshot.mjs'] })).ok, true);
  assert.equal(verifySource(base, source, fixture({ changed: ['M', 'tests/e2e/scripts/failure-diagnostics.test.mjs'] })).ok, true);
  assert.equal(verifySource(base, source, fixture({ changed: ['M', 'tests/e2e/README.md'] })).ok, true);
  assert.equal(verifySource(base, source, fixture({ changed: ['A', 'tests/e2e/scripts/ios-auth-diagnostic.mjs'] })).ok, true);
  assert.equal(verifySource(base, source, fixture({ changed: ['M', 'tests/e2e/scripts/screenshot.mjs'], diagnosticEdit: '\n// unexpected' })).reason, 'shared-diagnostics-changed');
  assert.equal(verifySource(base, source, fixture({ ancestor: false })).ok, false);
  assert.equal(verifySource('2'.repeat(40), source, fixture()).reason, 'unverified-baseline');
  assert.equal(verifySource(base, 'invalid', fixture()).reason, 'invalid-revision');
});
test('exact Android revision still needs no exception', () => {
  assert.deepEqual(verifySource(base, base, () => ({ status: 0, stdout: `${base}\n` })), { ok: true, exception: false });
});
