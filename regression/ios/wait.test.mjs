import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchedRunId, waitForRun } from './wait.mjs';

test('only the exact identifier returned by GitHub is used', () => {
  assert.equal(dispatchedRunId({ workflow_run_id: 41078089224 }), '41078089224');
  assert.equal(dispatchedRunId(null), null);
  assert.equal(dispatchedRunId({ workflow_run_id: '../other' }), null);
});
test('waits for completion including a failed run, with bounded polling', async () => {
  let clock = 0, count = 0;
  const request = async path => { assert.equal(path, '/actions/runs/41078089224'); return ++count === 2 ? { status: 'completed', conclusion: 'failure' } : { status: 'queued' }; };
  const options = { now: () => clock, sleep: async ms => { clock += ms; }, timeout: 50000 };
  assert.equal(await waitForRun(request, '41078089224', options), 'failure');
  assert.equal(count, 2);
  clock = 0;
  assert.equal(await waitForRun(async () => ({ status: 'queued' }), '41078089224', options), null);
});
