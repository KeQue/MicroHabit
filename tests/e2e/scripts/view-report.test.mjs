import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { openReport, openUpdatedAndroidReport, browserCommand } from './view-report.mjs';

test('each Android result opens one fresh report and never opens an old or missing report', async () => {
  for (const result of ['PASS', 'FAIL', 'BLOCKED']) {
    let launches = 0;
    const open = async mode => { assert.equal(mode, 'android'); launches++; };
    const fresh = { mtimeNs: 101n, isFile: () => true };
    assert.equal(await openUpdatedAndroidReport(100n, { stat: () => fresh, open }), true, result);
    assert.equal(launches, 1, result);
    assert.equal(await openUpdatedAndroidReport(101n, { stat: () => fresh, open }), false, result);
    assert.equal(await openUpdatedAndroidReport(-1n, { stat: () => { throw Object.assign(Error(), { code: 'ENOENT' }); }, open }), false, result);
    assert.equal(launches, 1, result);
  }
});

test('Android opens one visible Edge browser window; iOS keeps its existing browser arguments', async () => {
  const calls = [];
  const launch = (executable, args, options) => {
    calls.push({ executable, args, options });
    const child = new EventEmitter(); child.unref = () => {};
    queueMicrotask(() => child.emit('spawn'));
    return child;
  };
  const options = { platform: 'win32', environment: { ProgramFiles: 'C:/Program Files' }, exists: () => true, launch };
  await openReport('android', options);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args.slice(0, 1), ['--new-window']);
  assert.ok(calls[0].args[1].startsWith('file:'));
  assert.throws(() => browserCommand('win32', 'C:/private/report.html', options.environment, () => false, 'android'), /Microsoft Edge/);
  const ios = browserCommand('win32', 'C:/private/report.html', options.environment, options.exists, 'downloaded-ios');
  assert.equal(ios.args[0], '--new-window');
});

test('the Android runner owns one report launch, and the suite does not launch it again', () => {
  const android = readFileSync('regression/android/run.ps1', 'utf8');
  const suite = readFileSync('regression/run.ps1', 'utf8');
  assert.equal((android.match(/view-report\.mjs android --newer-than-ns/g) || []).length, 1);
  assert.doesNotMatch(suite, /view-report\.mjs android/);
});
