import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectAndroidWindows } from './android-readiness.mjs';

const secret = 'SYNTHETIC_PRIVATE_WINDOW_TITLE';
const response = title => ({ status: 0, stdout: `WINDOW MANAGER WINDOWS (dumpsys window windows)\n  Window #0 Window{123abc u0 ${title}}:\n` });

test('current Android system/app error windows block setup without retaining arbitrary titles', () => {
  assert.deepEqual(inspectAndroidWindows(response('Application Not Responding: com.android.systemui')), { ready: false, diagnostic: 'android-error-dialog-present', category: 'system-ui' });
  assert.equal(inspectAndroidWindows(response('Application Error: com.sadik.microhabit')).category, 'commito');
  const unknown = inspectAndroidWindows(response(`Application Not Responding: ${secret}`));
  assert.equal(unknown.category, 'other-process');
  assert.ok(!JSON.stringify(unknown).includes(secret));
});

test('a historical mention is not a current dialog and failed/unknown queries never claim readiness', () => {
  const normal = response(secret); normal.stdout += '\nEarlier diagnostic: Application Not Responding: com.android.systemui\n';
  assert.equal(inspectAndroidWindows(normal).ready, true);
  assert.equal(inspectAndroidWindows({ status: null, error: { code: 'ETIMEDOUT' }, stderr: secret }).diagnostic, 'android-window-query-timeout');
  assert.equal(inspectAndroidWindows({ status: 1, stderr: secret }).diagnostic, 'android-window-query-failed');
  assert.equal(inspectAndroidWindows({ status: 0, stdout: secret }).ready, false);
});
