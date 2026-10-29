// Infrastructure checks only; these do not add a third mobile test case.
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { PNG } from 'pngjs';
import { decryptReport, encryptReport, writeReport } from './report.mjs';
import { authenticatedScreen, parseHierarchy, redactScreenshot } from './screenshot.mjs';

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
