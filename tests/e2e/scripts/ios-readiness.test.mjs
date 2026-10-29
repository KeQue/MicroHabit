import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectSimulator, mayRetrySimulatorProbe } from './ios-readiness.mjs';

const selected = 'SYNTHETIC-SELECTED';
const secret = 'SYNTHETIC_PRIVATE_VALUE';
const result = (state = 'Booted', extra = {}) => ({ status: 0, stdout: JSON.stringify({ devices: { 'com.apple.CoreSimulator.SimRuntime.iOS-18-5': [{ udid: selected, state, isAvailable: true, name: secret, ...extra }] } }) });

test('simctl timeouts and command errors are not misreported as a stopped Simulator', () => {
  for (const input of [{ status: null, error: { code: 'ETIMEDOUT' }, stderr: secret }, { status: 1, stdout: secret, stderr: secret }]) {
    const check = inspectSimulator(input, selected);
    assert.equal(check.ready, false);
    assert.equal(check.state, null);
    assert.equal(mayRetrySimulatorProbe(check), true);
    assert.ok(!JSON.stringify(check).includes(secret));
  }
  assert.equal(inspectSimulator({ error: { code: 'ETIMEDOUT' } }, selected).diagnostic, 'simulator-list-timeout');
});

test('missing, unavailable, malformed and genuinely stopped devices each block with distinct evidence', () => {
  assert.equal(inspectSimulator({ status: 0, stdout: secret }, selected).diagnostic, 'simulator-list-invalid-json');
  assert.equal(inspectSimulator({ status: 0, stdout: '{"devices":[]}' }, selected).diagnostic, 'simulator-list-invalid-shape');
  assert.equal(inspectSimulator(result(), 'OTHER').diagnostic, 'selected-simulator-not-listed');
  assert.equal(inspectSimulator(result('Booted', { isAvailable: false }), selected).diagnostic, 'selected-simulator-unavailable');
  const stopped = inspectSimulator(result('Shutdown'), selected);
  assert.equal(stopped.diagnostic, 'selected-simulator-not-booted');
  assert.equal(stopped.state, 'Shutdown');
  assert.equal(mayRetrySimulatorProbe(stopped), false);
  assert.equal(inspectSimulator(result(secret), selected).state, 'unknown');
});

test('a bounded read-only retry still requires the exact available, booted device and known runtime', () => {
  assert.equal(mayRetrySimulatorProbe(inspectSimulator(result('Booting'), selected)), true);
  assert.equal(inspectSimulator(result('Booting'), selected).ready, false);
  assert.deepEqual(inspectSimulator(result(), selected), { ready: true, diagnostic: null, state: 'Booted', osVersion: '18.5' });
  const unknown = result(); unknown.stdout = unknown.stdout.replace('iOS-18-5', 'OTHER');
  assert.equal(inspectSimulator(unknown, selected).diagnostic, 'selected-simulator-runtime-unknown');
});
