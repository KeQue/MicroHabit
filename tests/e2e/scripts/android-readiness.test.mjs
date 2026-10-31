import assert from 'node:assert/strict';
import test from 'node:test';
import { createSystemUiRecovery, inspectAndroidWindows, isSystemUiAnr, monitorAndroidFlow, systemCloseButton, systemWaitButton } from './android-readiness.mjs';

const secret = 'SYNTHETIC_PRIVATE_WINDOW_TITLE';
const response = title => ({ status: 0, stdout: `WINDOW MANAGER WINDOWS (dumpsys window windows)\n  Window #0 Window{123abc u0 ${title}}:\n` });

test('current Android system/app error windows block setup without retaining arbitrary titles', () => {
  assert.deepEqual(inspectAndroidWindows(response('Application Not Responding: com.android.systemui')), { ready: false, diagnostic: 'android-error-dialog-present', category: 'system-ui' });
  assert.equal(inspectAndroidWindows(response('Application Error: com.sadik.microhabit')).category, 'commito');
  const unknown = inspectAndroidWindows(response(`Application Not Responding: ${secret}`));
  assert.equal(unknown.category, 'other-process');
  assert.ok(!JSON.stringify(unknown).includes(secret));
});

const waitNode = '<node text="Wait" resource-id="android:id/aerr_wait" package="android" clickable="true" enabled="true" bounds="[10,20][110,80]" />';
const closeNode = '<node text="Close app" resource-id="android:id/aerr_close" package="android" clickable="true" enabled="true" bounds="[120,20][190,80]" />';
test('only a verified system Wait element inside the display is eligible', () => {
  assert.deepEqual(systemWaitButton(waitNode, { width: 200, height: 200 }), { x: 60, y: 50 });
  assert.deepEqual(systemCloseButton(closeNode, { width: 200, height: 200 }), { x: 155, y: 50 });
  assert.equal(systemWaitButton(waitNode + waitNode, { width: 200, height: 200 }), null);
  assert.equal(systemCloseButton(closeNode + closeNode, { width: 200, height: 200 }), null);
  assert.equal(systemCloseButton(closeNode.replace('text="Close app"', 'text="Wait"'), { width: 200, height: 200 }), null);
  assert.equal(systemWaitButton(waitNode.replace('package="android"', 'package="evil"'), { width: 200, height: 200 }), null);
  assert.equal(systemWaitButton(waitNode, { width: 100, height: 200 }), null);
  assert.equal(isSystemUiAnr(response('Application Error: com.android.systemui')), false);
});

test('recovery confirms the dialog cleared and stops after two attempts', async () => {
  const anr = response('Application Not Responding: com.android.systemui');
  const ready = response('com.example.app');
  let checks = 0, taps = 0;
  const adb = async args => {
    if (args.includes('dumpsys')) return ++checks % 2 ? anr : ready;
    if (args.includes('size')) return { status: 0, stdout: 'Physical size: 200x200\n' };
    if (args.includes('uiautomator')) return { status: 0, stdout: waitNode };
    if (args.includes('tap')) { taps++; return { status: 0 }; }
    throw Error('unexpected command');
  };
  const recovery = createSystemUiRecovery(adb, async () => {});
  assert.equal((await recovery.recover(anr, 'preflight')).ready, true);
  assert.equal((await recovery.recover(anr, 'preflight')).ready, true);
  assert.equal((await recovery.recover(anr, 'preflight')).diagnostic, 'android-recovery-limit');
  assert.equal(taps, 2);
  assert.deepEqual(recovery.events.map(x => x.result), ['recovered', 'recovered', 'limit-reached']);
  assert.ok(recovery.events.every(x => Number.isFinite(x.durationSeconds) && x.durationSeconds >= 0));
});

test('failed verification never taps and active flow is stopped before recovery', async () => {
  const anr = response('Application Not Responding: com.android.systemui');
  let taps = 0;
  const recovery = createSystemUiRecovery(async args => {
    if (args.includes('dumpsys')) return anr;
    if (args.includes('size')) return { status: 0, stdout: 'Physical size: 200x200\n' };
    if (args.includes('uiautomator')) return { status: 0, stdout: '<node />' };
    if (args.includes('tap')) taps++;
    return { status: 0 };
  }, async () => {});
  let stopped = false;
  const result = await monitorAndroidFlow(recovery, signal => new Promise(resolve => signal.addEventListener('abort', () => { stopped = true; resolve({ child: { status: 1, error: { code: 'EANDROIDBLOCKED' } } }); })));
  assert.equal(stopped, true);
  assert.equal(result.systemBlocked, true);
  assert.equal(result.systemDiagnostic, 'android-recovery-buttons-unverified');
  assert.equal(taps, 0);
});

test('a verified Close app fallback is used only when Wait is unavailable and System UI returns', async () => {
  const anr = response('Application Not Responding: com.android.systemui');
  const ready = response('com.example.app');
  let windowChecks = 0, taps = 0;
  const adb = async args => {
    if (args.includes('dumpsys')) return ++windowChecks <= 2 ? anr : ready;
    if (args.includes('size')) return { status: 0, stdout: 'Physical size: 200x200\n' };
    if (args.includes('uiautomator')) return { status: 0, stdout: closeNode };
    if (args.includes('tap')) { taps++; return { status: 0 }; }
    if (args.includes('pidof')) return { status: 0, stdout: '1234\n' };
    throw Error('unexpected command');
  };
  const recovery = createSystemUiRecovery(adb, async () => {});
  assert.equal((await recovery.recover(anr, 'preflight')).ready, true);
  assert.equal(taps, 1);
  assert.deepEqual(recovery.events.map(({ result, action }) => ({ result, action })), [{ result: 'recovered', action: 'close-app' }]);
});

test('Wait is preferred when both verified System UI buttons are available', async () => {
  const anr = response('Application Not Responding: com.android.systemui');
  const ready = response('com.example.app');
  let checks = 0, tapped = null;
  const adb = async args => {
    if (args.includes('dumpsys')) return ++checks % 2 ? anr : ready;
    if (args.includes('size')) return { status: 0, stdout: 'Physical size: 200x200\n' };
    if (args.includes('uiautomator')) return { status: 0, stdout: `${waitNode}${closeNode}` };
    if (args.includes('tap')) { tapped = args.slice(-2); return { status: 0 }; }
    throw Error('unexpected command');
  };
  const recovery = createSystemUiRecovery(adb, async () => {});
  assert.equal((await recovery.recover(anr, 'preflight')).ready, true);
  assert.deepEqual(tapped, ['60', '50']);
  assert.equal(recovery.events[0].action, 'wait');
});

test('unverified recovery records fixed reasons and never taps', async () => {
  const anr = response('Application Not Responding: com.android.systemui');
  const recovery = createSystemUiRecovery(async args => {
    if (args.includes('dumpsys')) return anr;
    if (args.includes('size')) return { status: 0, stdout: 'Physical size: 200x200\n' };
    if (args.includes('uiautomator')) return { status: 0, stdout: '<node text="private title" />' };
    if (args.includes('tap')) assert.fail('must not tap an unverified button');
    throw Error('unexpected command');
  }, async () => {});
  const result = await recovery.recover(anr, 'preflight');
  assert.equal(result.diagnostic, 'android-recovery-buttons-unverified');
  assert.equal(recovery.events[0].phase, 'preflight');
  assert.equal(recovery.events[0].result, 'buttons-unverified');
  assert.equal(recovery.events[0].diagnostic, 'wait-button-not-found; close-button-not-found');
  assert.ok(!JSON.stringify(recovery.events).includes('private title'));
});

test('Close app does not count as recovery until System UI is responsive again', async () => {
  const anr = response('Application Not Responding: com.android.systemui');
  const ready = response('com.example.app');
  let windowChecks = 0, taps = 0;
  const adb = async args => {
    if (args.includes('dumpsys')) return ++windowChecks <= 2 ? anr : ready;
    if (args.includes('size')) return { status: 0, stdout: 'Physical size: 200x200\n' };
    if (args.includes('uiautomator')) return { status: 0, stdout: closeNode };
    if (args.includes('tap')) { taps++; return { status: 0 }; }
    if (args.includes('pidof')) return { status: 0, stdout: '' };
    throw Error('unexpected command');
  };
  const recovery = createSystemUiRecovery(adb, async () => {});
  assert.equal((await recovery.recover(anr, 'preflight')).diagnostic, 'android-close-app-unconfirmed');
  assert.equal(taps, 1);
  assert.equal(recovery.events[0].result, 'not-confirmed');
  assert.equal(recovery.events[0].action, 'close-app');
});

test('a tapped dialog that does not clear is not considered recovered', async () => {
  const anr = response('Application Not Responding: com.android.systemui');
  const recovery = createSystemUiRecovery(async args => {
    if (args.includes('dumpsys')) return anr;
    if (args.includes('size')) return { status: 0, stdout: 'Physical size: 200x200\n' };
    if (args.includes('uiautomator')) return { status: 0, stdout: waitNode };
    return { status: 0 };
  }, async () => {});
  assert.equal((await recovery.recover(anr, 'preflight')).diagnostic, 'android-recovery-unconfirmed');
  assert.deepEqual(recovery.events.map(({ phase, result }) => ({ phase, result })), [{ phase: 'preflight', result: 'not-confirmed' }]);
});

test('dialog geometry and accessibility can be read concurrently', async () => {
  const anr = response('Application Not Responding: com.android.systemui');
  const ready = response('com.example.app');
  let pendingReads = 0, concurrentReads = false, windowChecks = 0;
  const adb = async args => {
    if (args.includes('dumpsys')) return ++windowChecks === 1 ? anr : ready;
    if (args.includes('size') || args.includes('uiautomator')) {
      pendingReads++;
      if (pendingReads === 2) concurrentReads = true;
      await new Promise(resolve => setImmediate(resolve));
      return args.includes('size') ? { status: 0, stdout: 'Physical size: 200x200\n' } : { status: 0, stdout: waitNode };
    }
    if (args.includes('tap')) return { status: 0 };
    throw Error('unexpected command');
  };
  const recovery = createSystemUiRecovery(adb, async () => {});
  assert.equal((await recovery.recover(anr, 'preflight')).ready, true);
  assert.equal(concurrentReads, true);
});

test('a recovered dialog during a flow permits a counted restart after stopping', async () => {
  const anr = response('Application Not Responding: com.android.systemui');
  let stopped = false;
  const recovery = {
    query: async () => anr,
    recover: async () => { assert.equal(stopped, true); return { ready: true }; },
  };
  const result = await monitorAndroidFlow(recovery, signal => new Promise(resolve => signal.addEventListener('abort', () => { stopped = true; resolve({ child: { status: 1, error: { code: 'EANDROIDBLOCKED' } } }); })));
  assert.equal(result.systemInterrupted, true);
  assert.equal(result.systemDiagnostic, 'android-recovered-restart');
});

test('an unconfirmed process stop cannot trigger a system tap or retry', async () => {
  let recoveries = 0;
  const recovery = { query: async () => response('Application Not Responding: com.android.systemui'), recover: async () => { recoveries++; } };
  const result = await monitorAndroidFlow(recovery, signal => new Promise(resolve => signal.addEventListener('abort', () => resolve({ child: { error: { code: 'EANDROIDSTOPFAILED' } } }))));
  assert.equal(result.systemDiagnostic, 'android-flow-stop-unconfirmed');
  assert.equal(result.systemBlocked, true);
  assert.equal(recoveries, 0);
});

test('an unrecognized final window query preserves the underlying Maestro failure', async () => {
  let queries = 0;
  const recovery = {
    query: async () => ++queries === 1 ? response('com.example.app') : { status: 0, stdout: 'unexpected WindowManager output' },
    recover: async () => assert.fail('must not treat an unrecognized query as a dialog'),
  };
  const result = await monitorAndroidFlow(recovery, async () => ({ child: { status: 1 }, xml: '<testsuite/>' }));
  assert.equal(result.child.status, 1);
  assert.equal(result.systemVerificationUnavailable, true);
  assert.equal(result.systemBlocked, undefined);
  assert.equal(result.systemDiagnostic, 'android-window-query-unrecognized');
});

test('an unknown window query during the flow is retried rather than aborting the test', async () => {
  let queries = 0, finished = false, aborted = false;
  const recovery = {
    query: async () => {
      queries++;
      return queries === 1 ? { status: 0, stdout: 'unexpected WindowManager output' } : response('com.example.app');
    },
    recover: async () => assert.fail('must not recover an unrecognized query'),
  };
  const result = await monitorAndroidFlow(recovery, async signal => {
    signal.addEventListener('abort', () => { aborted = true; });
    await new Promise(resolve => setImmediate(resolve));
    finished = true;
    return { child: { status: 1 }, xml: '' };
  }, () => new Promise(resolve => setImmediate(resolve)));
  assert.equal(aborted, false);
  assert.equal(finished, true);
  assert.equal(result.systemVerificationUnavailable, undefined);
});

test('a historical mention is not a current dialog and failed/unknown queries never claim readiness', () => {
  const normal = response(secret); normal.stdout += '\nEarlier diagnostic: Application Not Responding: com.android.systemui\n';
  assert.equal(inspectAndroidWindows(normal).ready, true);
  assert.equal(inspectAndroidWindows({ status: null, error: { code: 'ETIMEDOUT' }, stderr: secret }).diagnostic, 'android-window-query-timeout');
  assert.equal(inspectAndroidWindows({ status: 1, stderr: secret }).diagnostic, 'android-window-query-failed');
  assert.equal(inspectAndroidWindows({ status: 0, stdout: secret }).ready, false);
});
