import test from 'node:test';
import assert from 'node:assert/strict';
import { runAttempts } from './retry-policy.mjs';
import { formatDuration } from './duration.mjs';

test('a passing attempt stops immediately and retains its screenshot', async () => {
  const calls = [];
  const result = await runAttempts(async index => { calls.push(index); return { status: 'PASS', screenshot: { status: 'CAPTURED' } }; });
  assert.deepEqual(calls, [1]);
  assert.equal(result.flaky, false);
  assert.equal(result.attempts[0].screenshot.status, 'CAPTURED');
});

test('a failed attempt is retained before one retry, including its screenshot', async () => {
  const result = await runAttempts(async index => ({ status: index === 1 ? 'FAIL' : 'PASS', screenshot: { status: 'CAPTURED', file: String(index) } }));
  assert.equal(result.status, 'PASS');
  assert.equal(result.flaky, true);
  assert.deepEqual(result.attempts.map(a => a.screenshot.file), ['1', '2']);
});

test('two failures stop and remain failed', async () => {
  const result = await runAttempts(async () => ({ status: 'FAIL' }));
  assert.equal(result.status, 'FAIL');
  assert.equal(result.attempts.length, 2);
  assert.equal(result.flaky, false);
});

test('durations show minutes after one minute and preserve signed comparisons', () => {
  for (const [seconds, expected] of [[59.9, '59.9 sec'], [60, '1 min 0 sec'], [65.2, '1 min 5.2 sec'], [125.5, '2 min 5.5 sec'], [-61, '-1 min 1 sec'], [null, 'Not available']]) assert.equal(formatDuration(seconds), expected);
});
