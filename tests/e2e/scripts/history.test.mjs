import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { archiveReport, comparePreviousRun, timingTotals } from './history.mjs';

const base = resolve('tests/e2e/.tools/report-checks');
const report = { caseId: 'TC-001', platform: 'android', appId: 'example.app', device: 'emulator-5554', osVersion: '14', appVersion: '1.0.2', appBuild: '1', backendEnvironment: 'staging', backendHost: 'synthetic.example.test', maestroVersion: '2.12.0', status: 'PASS', evidenceStatus: 'COMPLETE', startedAt: '2026-10-29T10:00:00.000Z', sourceRevision: 'a'.repeat(40), durationSeconds: 120, attempts: [1, 2].map(attempt => ({ attempt, durationSeconds: 30, screenshot: { status: 'CAPTURED', durationSeconds: 20 } })) };

test('dated history preserves two reports with the same timestamp and builds an escaped local index', () => {
  mkdirSync(base, { recursive: true });
  const fixture = mkdtempSync(join(base, 'history-'));
  try {
    const first = archiveReport(report, '<html>first native evidence fixture</html>', fixture);
    const second = archiveReport({ ...report, status: '<script>bad</script>' }, '<html>second native evidence fixture</html>', fixture);
    assert.notEqual(first, second);
    assert.equal(readFileSync(join(fixture, first), 'utf8'), '<html>first native evidence fixture</html>');
    const index = readFileSync(join(fixture, 'history/index.html'), 'utf8');
    assert.ok(index.includes('&lt;script&gt;'));
    assert.ok(!index.includes('<script>'));
    assert.ok(index.includes('Login on Android'));
    assert.throws(() => archiveReport({ ...report, caseId: '../escape' }, '', fixture));
    assert.throws(() => archiveReport({ ...report, startedAt: 'invalid' }, '', fixture));
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

test('timing compares only complete passing runs with matching device/build/backend and repetition count', () => {
  mkdirSync(base, { recursive: true });
  const fixture = mkdtempSync(join(base, 'comparison-'));
  try {
    archiveReport(report, '<html>fixture</html>', fixture);
    const current = { ...report, startedAt: '2026-10-29T11:00:00.000Z', durationSeconds: 110 };
    assert.equal(comparePreviousRun(current, fixture).deltaSeconds.runSeconds, -10);
    for (const change of [{ backendHost: 'other.example.test' }, { appBuild: '2' }, { status: 'FAIL' }, { evidenceStatus: 'INCOMPLETE' }, { attempts: report.attempts.slice(0, 1) }]) {
      assert.equal(comparePreviousRun({ ...current, ...change }, fixture), null);
    }
    assert.deepEqual(timingTotals(report), { runSeconds: 120, uiSeconds: 60, captureSeconds: 40 });
    assert.equal(timingTotals({ ...report, attempts: [{ durationSeconds: 1 }] }).captureSeconds, null);
    const photo = { file: 'TC-002-1-attempt-1.png', durationSeconds: 20 };
    assert.equal(timingTotals({ attempts: [{ screenshot: photo, inputScreenshot: photo }] }).captureSeconds, 20);
    assert.equal(timingTotals({ attempts: [{ finalScreenshotIsInput: true, screenshot: { durationSeconds: 15 }, inputScreenshot: { durationSeconds: 15 } }] }).captureSeconds, 15);
    assert.equal(timingTotals({ attempts: [{ screenshot: photo, inputScreenshot: { file: 'TC-002-2-attempt-1.png', durationSeconds: 30 } }] }).captureSeconds, 50);
    assert.equal(comparePreviousRun({ ...current, requiresInputScreenshot: true }, fixture), null);
    assert.ok(existsSync(join(fixture, 'history/index.html')));
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});
