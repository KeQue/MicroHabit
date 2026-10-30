import assert from 'node:assert/strict';
import test from 'node:test';
import { executeLoginAttempt } from './login-attempt.mjs';
import { inspectLoginInputs } from './screenshot.mjs';
import { configurePasswordAutofill } from './ios-autofill.mjs';

const success = { child: { status: 0 }, xml: '<testsuite tests="1"><testcase name="fixture"/></testsuite>' };
const failure = { child: { status: 1 }, xml: '<testsuite tests="1"><testcase><failure/></testcase></testsuite>' };
const verified = { status: 'CAPTURED', file: 'TC-002-123-attempt-1.png', inputChecks: { before: { passed: true }, after: { passed: true } } };

test('iOS submits only after both private field checks and the required photo, without retry/reset', async () => {
  const events = [];
  let clock = 0;
  const result = await executeLoginAttempt({ platform: 'ios', attempt: 1, now: () => clock,
    runFlow: async (phase, options) => { events.push({ phase, ...options }); clock += 1000; return success; },
    capture: async options => { events.push(options.verifyInputs ? 'input-photo' : 'final-photo'); return options.verifyInputs ? verified : { status: 'CAPTURED', file: 'TC-002-456-attempt-1.png' }; },
    diagnostics: () => assert.fail('Successful case must not request failure diagnostics'),
  });
  assert.equal(result.status, 'PASS');
  assert.equal(result.submissionStarted, true);
  assert.equal(result.durationSeconds, 2);
  assert.deepEqual(events, [{ phase: 'prepare', reuseDriver: false, timeout: 360000 }, 'input-photo', { phase: 'submit', reuseDriver: true, timeout: 359000 }, 'final-photo']);
});

test('missing/mismatched fields and unavailable pre-submit photos stop without sending a login', async () => {
  for (const screenshot of [{ status: 'UNAVAILABLE' }, { ...verified, inputChecks: { before: { passed: true }, after: { passed: false } } }, { ...verified, inputChecks: undefined }]) {
    const phases = [];
    const result = await executeLoginAttempt({ platform: 'ios', attempt: 1,
      runFlow: async phase => { phases.push(phase); return success; }, capture: async () => screenshot, diagnostics: () => ({}),
    });
    assert.deepEqual(phases, ['prepare']);
    assert.equal(result.status, 'FAIL');
    assert.equal(result.submissionStarted, false);
    assert.equal(result.screenshot, screenshot);
    assert.equal(result.diagnostics.failedCommand, 'input-verification');
  }
});

test('a preparation failure is preserved, a submission failure is not retried, and Android remains one full flow', async () => {
  for (const failPhase of ['prepare', 'submit']) {
    const phases = [];
    const result = await executeLoginAttempt({ platform: 'ios', attempt: 1,
      runFlow: async phase => { phases.push(phase); return phase === failPhase ? failure : success; }, capture: async () => verified,
      diagnostics: () => ({ failedCommand: 'fixture-assertion' }),
    });
    assert.deepEqual(phases, failPhase === 'prepare' ? ['prepare'] : ['prepare', 'submit']);
    assert.equal(result.status, 'FAIL');
    assert.equal(result.diagnostics.failedCommand, 'fixture-assertion');
  }
  const phases = [];
  const result = await executeLoginAttempt({ platform: 'android', attempt: 1,
    runFlow: async phase => { phases.push(phase); return success; }, capture: async () => ({ status: 'CAPTURED' }), diagnostics: () => ({}),
  });
  assert.deepEqual(phases, ['full']);
  assert.equal(result.status, 'PASS');
  assert.equal(result.inputScreenshot, undefined);
  let clock = 0;
  const limited = [];
  const exhausted = await executeLoginAttempt({ platform: 'ios', attempt: 1, now: () => clock,
    runFlow: async phase => { limited.push(phase); clock = 360001; return success; },
    capture: async () => verified, diagnostics: () => ({}),
  });
  assert.deepEqual(limited, ['prepare']);
  assert.equal(exhausted.status, 'FAIL');
  assert.equal(exhausted.submissionStarted, false);
});

test('input inspection keeps only booleans/categories and distinguishes masking from exact password verification', () => {
  const email = 'fixture@example.test', password = 'SYNTHETIC_PASSWORD';
  const tree = (emailValue, passwordValue) => ({ attributes: {}, children: [
    { attributes: { 'resource-id': 'e2e-login-email', text: emailValue }, children: [] },
    { attributes: { 'resource-id': 'e2e-login-password', value: passwordValue }, children: [] },
  ] });
  const masked = inspectLoginInputs(tree(email, '\u2022\u2022\u2022'), 'example.app', email, password);
  assert.deepEqual(masked, { emailMatches: true, passwordPresent: true, passwordEvidence: 'native-mask-nonempty', passed: true });
  const exact = inspectLoginInputs(tree(email, password), 'example.app', email, password);
  assert.equal(exact.passwordEvidence, 'private-exact-match');
  assert.equal(exact.passed, true);
  for (const values of [[email, ''], [email, 'Password'], [email, '\u2022x'], ['wrong@example.test', '****']]) assert.equal(inspectLoginInputs(tree(...values), 'example.app', email, password).passed, false);
  const duplicate = tree(email, '****'); duplicate.children.push(duplicate.children[0]);
  assert.equal(inspectLoginInputs(duplicate, 'example.app', email, password).passed, false);
  assert.ok(!JSON.stringify([masked, exact]).includes(email));
  assert.ok(!JSON.stringify([masked, exact]).includes(password));
});

test('Simulator-only AutoFill configuration requires both files and confirmed false readbacks', () => {
  const device = '12345678-1234-1234-1234-123456789abc';
  const calls = [];
  const options = { exists: () => true, isLink: () => false, run: (tool, args) => { calls.push({ tool, args }); return { status: 0, stdout: 'false\n' }; } };
  assert.equal(configurePasswordAutofill(device, '/synthetic-home', options).configured, true);
  assert.equal(calls.length, 4);
  assert.ok(calls.every(call => call.tool === '/usr/bin/plutil' && call.args.at(-1).replaceAll('\\', '/').includes(`/Devices/${device}/data/`)));
  assert.equal(configurePasswordAutofill('../other-device', '/synthetic-home', options).configured, false);
  assert.equal(calls.length, 4);
  assert.equal(configurePasswordAutofill(device, '/synthetic-home', { ...options, exists: () => false }).diagnostic, 'autofill-settings-unavailable');
  assert.equal(configurePasswordAutofill(device, '/synthetic-home', { ...options, run: () => ({ status: 0, stdout: 'true' }) }).diagnostic, 'autofill-readback-failed');
  assert.equal(configurePasswordAutofill(device, '/synthetic-home', { ...options, run: () => ({ status: 1, stderr: 'SYNTHETIC_SECRET' }) }).diagnostic, 'autofill-setting-failed');
});
