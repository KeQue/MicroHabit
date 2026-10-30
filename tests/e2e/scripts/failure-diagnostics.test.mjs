import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeCommands } from './failure-diagnostics.mjs';
import { safeScreenState } from './screenshot.mjs';

const secret = 'SYNTHETIC_SECRET_NEVER_RETAINED';
const checkpoint = (name, status, timestamp) => ({ command: { evalScriptCommand: { scriptString: '${output.e2eCheckpoint = "' + name + '"}' } }, metadata: { status, timestamp } });

test('diagnostics use only completed fixed checkpoints and the deepest failed command, ignoring secret-bearing fields', () => {
  const data = [
    checkpoint('password-entered', 'COMPLETED', 1),
    checkpoint('session-restored', 'PENDING', 5),
    { command: { defineVariablesCommand: { env: { PASSWORD: secret } } }, metadata: { status: 'COMPLETED', timestamp: 2 } },
    { command: { runFlowCommand: { file: secret } }, metadata: { status: 'FAILED', depth: 0, timestamp: 9 } },
    { command: { tapOnElementCommand: { selector: { idRegex: 'e2e-login-submit' }, text: secret } }, metadata: { status: 'FAILED', depth: 1, timestamp: 3, error: { message: secret } } },
  ];
  assert.deepEqual(summarizeCommands(data), { lastCompletedCheckpoint: 'password-entered', failedCommand: 'tap', failedTarget: 'e2e-login-submit' });
  assert.ok(!JSON.stringify(summarizeCommands(data)).includes(secret));
  assert.equal(summarizeCommands([checkpoint(secret, 'COMPLETED', 1)]).lastCompletedCheckpoint, null);
  assert.equal(summarizeCommands([{ command: { tapOnElementCommand: { selector: { idRegex: secret } } }, metadata: { status: 'FAILED' } }]).failedTarget, null);
});

test('safe screen diagnostics classify only designated app errors and never retain their text or input values', () => {
  const appId = 'com.example.app';
  const tree = text => ({ attributes: {}, children: [{ attributes: { 'resource-id': 'e2e-login-email', text: secret }, children: [] }, { attributes: { 'resource-id': 'e2e-auth-error', text }, children: [] }] });
  assert.equal(safeScreenState(tree('Invalid login credentials'), appId).authErrorCategory, 'invalid-credentials');
  const unknown = safeScreenState(tree(secret), appId);
  assert.equal(unknown.authErrorCategory, 'other-auth-error');
  assert.ok(!JSON.stringify(unknown).includes(secret));
  assert.equal(safeScreenState({ attributes: { 'resource-id': 'other.app:id/e2e-auth-error', text: 'Invalid API key' }, children: [] }, appId).authErrorCategory, null);
  const nested = { attributes: {}, children: [
    { attributes: { 'resource-id': 'e2e-auth-error' }, children: [{ attributes: { text: 'Password is required' }, children: [] }] },
    { attributes: { text: 'Invalid login credentials ' + secret }, children: [] },
  ] };
  assert.equal(safeScreenState(nested, appId).authErrorCategory, 'missing-password');
  assert.ok(!JSON.stringify(safeScreenState(nested, appId)).includes(secret));
});
