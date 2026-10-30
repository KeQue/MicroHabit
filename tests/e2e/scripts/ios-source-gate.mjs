import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The exception is limited to the Android evidence recorded for this baseline.
const baseline = 'a9ac59a4dc76d9e0781d265f334d9161aa6b3755';
const allowed = new Set([
  '.github/workflows/e2e-ios-login.yml',
  'docs/work-quality-lessons.md',
  'tests/e2e/agents/runner-debugger.md',
  'tests/e2e/execution-status.md',
  'tests/e2e/scripts/ios-autofill.mjs',
  'tests/e2e/scripts/ios-source-gate.mjs',
  'tests/e2e/scripts/ios-source-gate.test.mjs',
  'tests/e2e/scripts/login-attempt.test.mjs',
  'tests/e2e/scripts/run.mjs',
]);
const oldGuard = "  if (!android && env.E2E_ANDROID_PASS_SHA !== metadata.sourceRevision) block('Run Android first; E2E_ANDROID_PASS_SHA must attest its PASS for this revision, backend and same account.');";
const newGuard = "  if (!android && env.E2E_ANDROID_PASS_SHA !== metadata.sourceRevision && !(env.GITHUB_ACTIONS === 'true' && env.E2E_IOS_VERIFIED_BASELINE === `${env.E2E_ANDROID_PASS_SHA}:${metadata.sourceRevision}`)) block('Run Android first; E2E_ANDROID_PASS_SHA must attest its PASS for this revision, backend and same account.');";
const testAdds = [
  "  for (const call of [calls[1], calls[3]]) assert.deepEqual(call.args.slice(0, 5), ['-extract', 'restrictedBool.allowPasswordAutoFill.value', 'raw', '-expect', 'bool']);\n",
  "  let readCalls = 0;\n  assert.equal(configurePasswordAutofill(device, '/synthetic-home', { ...options, run: () => ({ status: ++readCalls === 2 ? 1 : 0, stdout: 'false' }) }).diagnostic, 'autofill-readback-failed');\n",
];

export function verifySource(base, source, run = spawnSync) {
  const git = args => {
    const result = run('git', args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 20000 });
    if (result.error || result.status !== 0 || typeof result.stdout !== 'string') throw new Error('git-check-failed');
    return result.stdout;
  };
  try {
    if (!/^[a-f0-9]{40}$/.test(base || '') || !/^[a-f0-9]{40}$/.test(source || '')) throw new Error('invalid-revision');
    if (git(['rev-parse', 'HEAD']).trim() !== source) throw new Error('source-mismatch');
    if (base === source) return { ok: true, exception: false };
    if (base !== baseline) throw new Error('unverified-baseline');
    git(['merge-base', '--is-ancestor', base, source]);
    const fields = git(['diff', '--name-status', '-z', '--no-renames', base, source, '--']).split('\0');
    if (fields.pop() !== '' || fields.length % 2) throw new Error('invalid-diff');
    for (let i = 0; i < fields.length; i += 2) {
      const [status, path] = fields.slice(i, i + 2);
      if (!allowed.has(path) || !['M', 'A'].includes(status)) throw new Error('disallowed-change');
      if (git(['ls-tree', source, '--', path]).split(' ')[0] !== '100644') throw new Error('invalid-file-mode');
      if (status === 'A' && !['tests/e2e/scripts/ios-source-gate.mjs', 'tests/e2e/scripts/ios-source-gate.test.mjs'].includes(path)) throw new Error('unexpected-addition');
    }
    const content = (rev, path) => git(['show', `${rev}:${path}`]).replaceAll('\r\n', '\n');
    const beforeRunner = content(base, 'tests/e2e/scripts/run.mjs');
    const afterRunner = content(source, 'tests/e2e/scripts/run.mjs');
    if (beforeRunner.split(oldGuard).length !== 2 || beforeRunner.replace(oldGuard, newGuard) !== afterRunner) throw new Error('shared-runner-changed');
    const beforeTests = content(base, 'tests/e2e/scripts/login-attempt.test.mjs');
    let afterTests = content(source, 'tests/e2e/scripts/login-attempt.test.mjs');
    for (const addition of testAdds) {
      if (afterTests.split(addition).length !== 2) throw new Error('shared-tests-changed');
      afterTests = afterTests.replace(addition, '');
    }
    if (afterTests !== beforeTests) throw new Error('shared-tests-changed');
    return { ok: true, exception: true };
  } catch (error) { return { ok: false, reason: error.message }; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifySource(process.argv[2], process.argv[3]);
  console.log(result.ok ? `Android baseline verified; iOS-only exception: ${result.exception}.` : `BLOCKED: source verification failed (${result.reason}).`);
  if (!result.ok) process.exitCode = 2;
}
