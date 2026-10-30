import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import ts from 'typescript';
import { patchIosDiagnostic } from './ios-auth-diagnostic.mjs';

const files = ['lib/supabase.ts', 'features/auth/useAuth.tsx', 'app/(auth)/sign-in.tsx'];
const reportFiles = ['tests/e2e/scripts/run.mjs', 'tests/e2e/scripts/report.mjs'];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'commito-ios-diag-'));
  for (const path of [...files, ...reportFiles]) { const target = join(root, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, readFileSync(path)); }
  return root;
}
test('iOS-only diagnostic build patch applies fixed stages, preserves login assertions and refuses mismatched source', async () => {
  const root = fixture();
  try {
    patchIosDiagnostic(root);
    assert.match(readFileSync(join(root, reportFiles[0]), 'utf8'), /redactScreenshot\(readFileSync\(raw\)/);
    const auth = readFileSync(join(root, files[1]), 'utf8');
    const screen = readFileSync(join(root, files[2]), 'utf8');
    assert.match(auth, /traceAuth\("auth-call"/);
    assert.match(auth, /markAuthFailure\("auth-listener"/);
    assert.match(auth, /traceAuth\("profile-upsert"/);
    assert.match(screen, /testID="e2e-auth-error"/);
    assert.match(screen, /commito-diagnostic:\$\{diagnostic\}/);
    const module = readFileSync(join(root, 'lib/ios-diagnostic.ts'), 'utf8');
    assert.match(module, /throw error/);
    assert.doesNotMatch(module, /console\.|password|access_token/);
    const compiled = ts.transpileModule(module, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    const diag = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
    const error = new Error('SYNTHETIC_SECRET');
    const storage = diag.diagnosticStorage({ getItem: async () => null, setItem: async () => { throw error; }, removeItem: async () => {} });
    diag.resetAuthDiagnostic();
    await assert.rejects(diag.traceAuth('auth-call', () => storage.setItem('synthetic', 'synthetic')), actual => actual === error);
    assert.equal(diag.authDiagnostic(), 'storage-set');
    diag.resetAuthDiagnostic();
    await assert.rejects(diag.traceAuth('profile-upsert', async () => { throw error; }), actual => actual === error);
    assert.equal(diag.authDiagnostic(), 'profile-upsert');
    for (const path of [...files, 'lib/ios-diagnostic.ts']) {
      const source = readFileSync(join(root, path), 'utf8');
      const result = ts.transpileModule(source, { fileName: path, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
      assert.equal(result.diagnostics.length, 0, `syntax: ${path}`);
    }
    assert.throws(() => patchIosDiagnostic(root));
  } finally { rmSync(root, { recursive: true, force: true }); }
  const changed = fixture();
  try {
    writeFileSync(join(changed, files[2]), 'unreviewed');
    const before = readFileSync(join(changed, files[0]), 'utf8');
    assert.throws(() => patchIosDiagnostic(changed));
    assert.equal(readFileSync(join(changed, files[0]), 'utf8'), before);
  } finally { rmSync(changed, { recursive: true, force: true }); }
  const full = fixture();
  try {
    patchIosDiagnostic(full, { fullScreenshot: true });
    const runner = readFileSync(join(full, reportFiles[0]), 'utf8');
    const report = readFileSync(join(full, reportFiles[1]), 'utf8');
    assert.match(runner, /png: readFileSync\(raw\), redactions: 0/);
    assert.match(runner, /private-full-screen-v1/);
    assert.match(report, /full native screenshot without masks/);
    assert.doesNotMatch(report, /Redaction preserves the remaining native screenshot pixels/);
  } finally { rmSync(full, { recursive: true, force: true }); }
});
