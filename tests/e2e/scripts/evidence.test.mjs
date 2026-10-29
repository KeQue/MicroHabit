// Infrastructure checks only; these do not add a third mobile test case.
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { PNG } from 'pngjs';
import { decryptReport, encryptReport, recordRun, suggestedImprovements, writeReport } from './report.mjs';
import { authenticatedScreen, parseHierarchy, redactScreenshot } from './screenshot.mjs';
import { browserCommand } from './view-report.mjs';
import { resultExitCode } from './maestro-result.mjs';

const secret = 'SYNTHETIC_PRIVATE_VALUE';
const tree = children => ({ attributes: { bounds: '[0,0][100,200]' }, children });
const image = new PNG({ width: 200, height: 400 });
image.data.fill(255);
const raw = PNG.sync.write(image);

test('PASS image validation requires an identifier from this app, never static text or login fields', () => {
  const appId = 'com.sadik.microhabit';
  const marker = id => ({ attributes: { 'resource-id': id }, children: [] });
  assert.equal(authenticatedScreen(tree([marker('e2e-leagues-loaded')]), appId), true);
  assert.equal(authenticatedScreen(tree([marker(`${appId}:id/e2e-leagues-loaded`)]), appId), true);
  assert.equal(authenticatedScreen(tree([{ attributes: { text: 'e2e-leagues-loaded' }, children: [] }]), appId), false);
  assert.equal(authenticatedScreen(tree([marker('com.other:id/e2e-leagues-loaded')]), appId), false);
  assert.equal(authenticatedScreen(tree([marker('e2e-leagues-loaded'), marker('e2e-login-email')]), appId), false);
  assert.equal(authenticatedScreen(tree([marker('e2e-leagues-loaded'), marker(`${appId}:id/e2e-login-password`)]), appId), false);
});

test('redacts credential fields in both positions and the keyboard, preserving other pixels', () => {
  const email = { attributes: { 'resource-id': 'e2e-login-email', bounds: '[10,20][60,40]', text: 'synthetic@example.test' }, children: [] };
  const password = { attributes: { class: 'XCUIElementTypeSecureTextField', bounds: '[10,50][60,65]', value: secret }, children: [] };
  const moved = { ...email, attributes: { ...email.attributes, bounds: '[20,70][70,90]' } };
  const redacted = redactScreenshot(raw, [tree([email, password]), tree([moved])], [secret]);
  const pixels = PNG.sync.read(redacted.png);
  const at = (x, y) => Array.from(pixels.data.subarray((y * 200 + x) * 4, (y * 200 + x) * 4 + 4));
  for (const [x, y] of [[30, 50], [50, 150], [10, 300]]) assert.deepEqual(at(x, y), [0, 0, 0, 255]);
  assert.deepEqual(at(0, 0), [255, 255, 255, 255]);
  const untouched = redactScreenshot(raw, [tree([]), tree([])], [secret]);
  assert.deepEqual(PNG.sync.read(untouched.png).data, image.data);
  assert.equal(untouched.redactions, 0);
});

test('rejects screenshots when coordinates, sensitive bounds or PNG data are unavailable', () => {
  assert.throws(() => redactScreenshot(raw, [{ attributes: { bounds: '[0,0][0,0]' }, children: [] }], [secret]));
  assert.throws(() => redactScreenshot(raw, [{ attributes: { bounds: '[0,0][98,196]' }, children: [] }], [secret]));
  assert.throws(() => redactScreenshot(raw, [tree([{ attributes: { text: secret }, children: [] }])], [secret]));
  assert.throws(() => redactScreenshot(Buffer.from('bad'), [tree([])], [secret]));
});

test('reads real hierarchy JSON between Windows batch output and handles quoted braces', () => {
  const expected = tree([{ attributes: { text: 'quoted { brace } and " quote' }, children: [] }]);
  assert.deepEqual(parseHierarchy(`batch prefix\n${JSON.stringify(expected)}\nbatch suffix`), expected);
  assert.throws(() => parseHierarchy('{"text":"not a hierarchy"}'));
});

test('encrypted evidence roundtrips and rejects tampering, wrong recipients and private-key input', () => {
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  const payload = `<html>${secret}</html>`;
  const encrypted = encryptReport(payload, pair.publicKey);
  assert.equal(decryptReport(encrypted, pair.privateKey), payload);
  assert.ok(!encrypted.includes(secret));
  const tampered = JSON.parse(encrypted);
  tampered.tag = Buffer.alloc(16).toString('base64');
  assert.throws(() => decryptReport(JSON.stringify(tampered), pair.privateKey));
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
  assert.throws(() => decryptReport(encrypted, other.privateKey));
  assert.throws(() => encryptReport(payload, pair.privateKey));
});

test('private HTML escapes content and explicitly reports missing screenshot evidence', () => {
  const base = resolve('tests/e2e/.tools/report-checks');
  mkdirSync(base, { recursive: true });
  const fixture = mkdtempSync(join(base, 'report-'));
  try {
    const report = { caseId: 'TC-001', platform: 'android', status: 'FAIL', evidenceStatus: 'INCOMPLETE', blockers: ['<script>external()</script>'], attempts: [{ attempt: 1, status: 'FAIL', finding: 'Fixture only', durationSeconds: 1, screenshot: { status: 'UNAVAILABLE', finding: 'Fixture only' } }] };
    const html = readFileSync(writeReport(report, fixture), 'utf8');
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('Screenshot unavailable'));
    assert.ok(html.includes("default-src 'none'"));
    assert.throws(() => writeReport({ ...report, caseId: '../escape' }, fixture));
  } finally {
    assert.equal(dirname(fixture), base);
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('each attempt embeds its own native image directly below its result, with a readable test name', () => {
  const base = resolve('tests/e2e/.tools/report-checks');
  mkdirSync(base, { recursive: true });
  const fixture = mkdtempSync(join(base, 'photos-'));
  try {
    const attempts = [1, 2].map(attempt => {
      const pixels = new PNG({ width: 2, height: 2 });
      pixels.data.fill(attempt * 50);
      const png = PNG.sync.write(pixels);
      const file = `TC-001-123-attempt-${attempt}.png`;
      writeFileSync(join(fixture, file), png);
      return { attempt, status: attempt === 1 ? 'PASS' : 'FAIL', finding: 'Synthetic fixture only', screenshot: { status: 'CAPTURED', file }, png };
    });
    const html = readFileSync(writeReport({ caseId: 'TC-001', status: 'FAIL', attempts }, fixture), 'utf8');
    assert.ok(html.includes('<h1>Login on Android: FAIL</h1>'));
    const sections = html.match(/<section>.*?<\/section>/g);
    assert.equal(sections.length, 2);
    for (let index = 0; index < 2; index++) {
      assert.ok(sections[index].includes(`Attempt ${index + 1}:`));
      assert.ok(sections[index].includes(attempts[index].png.toString('base64')));
      assert.ok(!sections[index].includes(attempts[1 - index].png.toString('base64')));
    }
    const ios = readFileSync(writeReport({ caseId: 'TC-002', status: 'BLOCKED', attempts: [] }, fixture), 'utf8');
    assert.ok(ios.includes('<h1>Login on iOS: BLOCKED</h1>'));
    assert.ok(!ios.includes('<img'));
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

test('Windows reports use an explicit browser, including paths with spaces and URL characters', () => {
  const path = resolve('tests/e2e/results/private report #1.html');
  const command = browserCommand('win32', path, { ProgramFiles: 'C:/Program Files' }, candidate => candidate.endsWith('msedge.exe'));
  assert.ok(command.executable.endsWith('msedge.exe'));
  assert.equal(command.args[0], '--new-window');
  assert.ok(command.args[1].startsWith('file:'));
  assert.ok(command.args[1].includes('%20'));
  assert.ok(command.args[1].includes('%23'));
  assert.throws(() => browserCommand('win32', path, {}, () => false));
});

test('a functional pass with a missing required screenshot blocks automation without rewriting the test result', () => {
  const report = { status: 'PASS', evidenceStatus: 'INCOMPLETE' };
  assert.equal(resultExitCode(report), 2);
  assert.equal(report.status, 'PASS');
  assert.equal(resultExitCode({ ...report, evidenceStatus: 'COMPLETE' }), 0);
  assert.equal(resultExitCode({ status: 'FAIL', evidenceStatus: 'COMPLETE' }), 1);
  assert.equal(resultExitCode({ status: 'BLOCKED', evidenceStatus: 'NOT_AVAILABLE' }), 2);
});

test('post-run suggestions follow observed evidence without inventing a root cause or launching work', () => {
  const pass = suggestedImprovements({ status: 'PASS', evidenceStatus: 'COMPLETE', attempts: [{ screenshot: { status: 'CAPTURED', durationSeconds: 40 } }] });
  assert.ok(pass.some(item => item.includes('baseline')));
  assert.ok(pass.some(item => item.includes('startup')));
  assert.ok(!pass.some(item => item.includes('resolve the recorded')));
  const blocked = suggestedImprovements({ status: 'BLOCKED', attempts: [] });
  assert.ok(blocked.some(item => item.includes('approval before another cloud run')));
  const incomplete = suggestedImprovements({ status: 'PASS', evidenceStatus: 'INCOMPLETE', attempts: [{ screenshot: { status: 'UNAVAILABLE' } }] });
  assert.ok(incomplete.some(item => item.includes('capture phase')));
  assert.ok(!incomplete.some(item => item.includes('baseline')));
});

test('cloud reporting writes no plaintext archive, while a local blocked run retains an honest dated report', () => {
  const base = resolve('tests/e2e/.tools/report-checks');
  mkdirSync(base, { recursive: true });
  const fixture = mkdtempSync(join(base, 'cloud-'));
  try {
    const report = { caseId: 'TC-002', status: 'BLOCKED', evidenceStatus: 'NOT_AVAILABLE', attempts: [], startedAt: '2026-10-29T12:00:00.000Z' };
    recordRun({ ...report }, fixture, { cloud: true });
    const metadata = JSON.parse(readFileSync(join(fixture, 'TC-002-latest.json')));
    assert.equal(metadata.historyStatus, 'LOCAL_DOWNLOAD_ONLY');
    assert.equal(metadata.historyFile, undefined);
    assert.equal(existsSync(join(fixture, 'history')), false);
    const local = { ...report };
    recordRun(local, fixture, { cloud: false });
    assert.ok(existsSync(join(fixture, local.historyFile)));
    const html = readFileSync(join(fixture, local.historyFile), 'utf8');
    assert.ok(html.includes('Login on iOS: BLOCKED'));
    assert.ok(!html.includes('<img'));
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});
