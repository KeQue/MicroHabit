import { Buffer } from 'node:buffer';
import { constants, createCipheriv, createDecipheriv, createHash, createPrivateKey, createPublicKey, generateKeyPairSync, privateDecrypt, publicEncrypt, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { archiveReport, comparePreviousRun, timingTotals } from './history.mjs';
import { formatDuration } from './duration.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const results = join(root, 'tests/e2e/results');
const keys = join(root, 'tests/e2e/.tools/report-keys');
const escape = value => String(value ?? 'Not available').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function suggestedImprovements(report) {
  const suggestions = [];
  const attempts = report.attempts || [];
  if (attempts.some(attempt => attempt.screenshot?.status !== 'CAPTURED')) {
    suggestions.push('Workflow: isolate the recorded capture phase and diagnostic. Verify repeated capture on the existing device before requesting another login run.');
  }
  if (report.status === 'FAIL') {
    suggestions.push('Debugging: compare the failed attempt with its screenshot and sanitized finding before changing the app. Preserve the failed result and existing assertions.');
  } else if (report.status === 'BLOCKED') {
    suggestions.push('Workflow: resolve the recorded setup/build blocker before another login attempt. For iOS, inspect the phase diagnostics; obtain approval before another cloud run.');
  } else if (report.status === 'PASS' && report.evidenceStatus === 'COMPLETE') {
    suggestions.push('System: keep this run as a baseline. Compare later durations and screenshots before expanding test coverage or changing time limits.');
  }
  if (attempts.some(attempt => attempt.screenshot?.durationSeconds > 30)) {
    suggestions.push('Performance: screenshot inspection exceeded 30 seconds. Measure native tool startup and the test machine\'s resource use before adding more parallel work.');
  }
  suggestions.push('Agents: the Runner/Debugger should review an image for every attempt and report missing evidence separately from the functional result. Change reusable skills only when an observed issue supports it.');
  return suggestions;
}

export function writeReport(report, directory = results) {
  if (!/^TC-00[12]$/.test(report.caseId)) throw Error('Invalid report case');
  const name = report.caseId === 'TC-001' ? 'Login on Android' : 'Login on iOS';
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const result = report.flaky ? 'PASS (after retry; flaky)' : report.status;
  const rows = [['Result', result], ['Duration', formatDuration(report.durationSeconds)], ['App version / build', `${report.appVersion ?? '?'} / ${report.appBuild ?? '?'}`], ['Screenshot evidence', report.evidenceStatus ?? 'Unavailable for this earlier run'], ['Case ID', report.caseId], ['Platform', report.platform], ['Device', report.device], ['OS', report.osVersion], ['Backend', `${report.backendEnvironment ?? '?'} / ${report.backendHost ?? '?'}`], ['Source revision', report.sourceRevision], ['Started (UTC)', report.startedAt], ['Command', report.command]];
  if (report.simulatorReadiness) rows.push(['Simulator checks', report.simulatorReadiness.map(check => `${check.diagnostic || 'ready'}; state ${check.state || 'unknown'}; ${formatDuration(check.durationSeconds)}`).join(' / ')]);
  if (report.androidReadiness) rows.push(['Android system check', `${report.androidReadiness.diagnostic || 'ready'}; category ${report.androidReadiness.category || 'none'}`]);
  const pictureFor = screenshot => {
    let picture = '<p>Screenshot unavailable: this earlier run did not retain visual evidence.</p>';
    if (screenshot?.status === 'CAPTURED' && /^TC-00[12]-[0-9]+-attempt-[1-5]\.png$/.test(screenshot.file || '')) {
      const png = readFileSync(join(directory, screenshot.file));
      picture = `<p>Native device screenshot captured ${escape(screenshot.capturedAt)}. Opaque credential/keyboard masks: ${escape(screenshot.redactions)}.</p><img alt="Native app state after this attempt" src="data:image/png;base64,${png.toString('base64')}">`;
      if (screenshot.privacyPolicy === 'visible-email-native-password-mask-v1') picture += '<p>The login email may be visible. Native password dots remain visible only when both screen inspections confirm masking; otherwise the field is covered. No password text or replacement dots are added to the image.</p>';
    } else if (screenshot) picture = `<p>Screenshot unavailable: ${escape(screenshot.finding)}</p><p>Capture phase: ${escape(screenshot.phase)}. Diagnostic: ${escape(screenshot.diagnostic)}.</p>`;
    const timings = screenshot?.timings ? `<p>Capture phase times: ${Object.entries(screenshot.timings).map(([phase, seconds]) => `${escape(phase)}: ${escape(formatDuration(seconds))}`).join('; ')}.</p>` : '';
    const state = screenshot?.stateAfter ? `<p>Safe screen checks: ${escape(JSON.stringify(screenshot.stateAfter))}. These checks retain no field values or error text.</p>` : '';
    const inputs = screenshot?.inputChecks ? `<p>Private input verification: ${escape(JSON.stringify(screenshot.inputChecks))}. A nonempty native password mask verifies populated input, not the hidden password's exact value.</p>` : '';
    return picture + timings + state + inputs;
  };
  const attempts = (report.attempts || []).map(attempt => {
    const diagnostic = attempt.diagnostics ? `<p>Last completed checkpoint: ${escape(attempt.diagnostics.lastCompletedCheckpoint)}. Failed command: ${escape(attempt.diagnostics.failedCommand)}. Target: ${escape(attempt.diagnostics.failedTarget)}.</p>` : '';
    const before = attempt.inputScreenshot && !attempt.finalScreenshotIsInput && attempt.inputScreenshot !== attempt.screenshot && (!attempt.inputScreenshot.file || attempt.inputScreenshot.file !== attempt.screenshot?.file) ? `<h3>Before Sign in</h3>${pictureFor(attempt.inputScreenshot)}<h3>After attempt</h3>` : '';
    return `<section><h2>Attempt ${escape(attempt.attempt)}: ${escape(attempt.status)}</h2><p>${escape(attempt.finding)} (${escape(formatDuration(attempt.durationSeconds))})</p>${diagnostic}${before}${pictureFor(attempt.screenshot)}</section>`;
  }).join('');
  const improvements = `<aside><h2>Suggested improvements after this run</h2><ul>${suggestedImprovements(report).map(item => `<li>${escape(item)}</li>`).join('')}</ul></aside>`;
  const totals = timingTotals(report);
  const timing = `<aside><h2>Timing</h2><p>UI assertions: ${escape(formatDuration(totals.uiSeconds))}. Screenshot capture and inspection: ${escape(formatDuration(totals.captureSeconds))}. Total including setup: ${escape(formatDuration(totals.runSeconds))}.</p>${report.timingComparison ? `<p>Compared with the passing run started ${escape(report.timingComparison.startedAt)}: total change ${escape(formatDuration(report.timingComparison.deltaSeconds.runSeconds))}; screenshot-time change ${escape(formatDuration(report.timingComparison.deltaSeconds.captureSeconds))}. Negative values mean less time.</p><p>${escape(report.timingComparison.finding)}</p>` : '<p>No earlier comparable complete passing run is available.</p>'}</aside>`;
  const supplemental = report.supplementalScreenshot ? `<section><h2>Supplemental screenshot</h2><p>${escape(report.supplementalScreenshot.context)}</p>${pictureFor(report.supplementalScreenshot)}</section>` : '';
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>${escape(name)} | Commito report</title><style>body{font:16px system-ui;margin:32px auto;padding:0 20px;max-width:900px;color:#222}table{border-collapse:collapse;width:100%}td,th{padding:9px;border:1px solid #ddd;text-align:left;overflow-wrap:anywhere}img{display:block;max-width:390px;width:100%;height:auto;border:1px solid #ddd}section{margin-top:32px}h1{font-size:25px}</style><h1>${escape(name)}</h1><p>Checks that an existing account can sign in and load its leagues. It also checks that the session works after the app restarts.</p><table>${rows.map(([label, value]) => `<tr><th>${escape(label)}</th><td>${escape(value)}</td></tr>`).join('')}</table><p>${escape(report.authenticationEvidence)}</p>${(report.blockers || []).map(blocker => `<p>BLOCKED: ${escape(blocker)}</p>`).join('')}${attempts || '<p>No native attempt or app screenshot was available.</p>'}<p>Keep this report private. Redaction preserves the remaining native screenshot pixels; it does not recreate the app.</p></html>`;
  const path = join(directory, `${report.caseId}-latest.html`);
  writeFileSync(path, html.replace('</html>', `${supplemental}${timing}${improvements}</html>`), { mode: 0o600 });
  return path;
}

export function recordRun(report, directory = results, { cloud = process.env.GITHUB_ACTIONS === 'true' } = {}) {
  report.timingComparison = cloud ? null : comparePreviousRun(report, directory);
  report.historyStatus = cloud ? 'LOCAL_DOWNLOAD_ONLY' : 'RETAINED';
  const path = writeReport(report, directory);
  if (!cloud) report.historyFile = archiveReport(report, readFileSync(path, 'utf8'), directory);
  writeFileSync(join(directory, `${report.caseId}-latest.json`), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  return path;
}

export function encryptReport(html, publicKey) {
  if (!/^-----BEGIN PUBLIC KEY-----/.test(publicKey)) throw Error('Use a public report key');
  const recipient = createPublicKey(publicKey);
  if (recipient.asymmetricKeyType !== 'rsa' || recipient.asymmetricKeyDetails.modulusLength < 2048) throw Error('Unsupported report key');
  const key = randomBytes(32), iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(html, 'utf8'), cipher.final()]);
  const wrappedKey = publicEncrypt({ key: recipient, oaepHash: 'sha256', padding: constants.RSA_PKCS1_OAEP_PADDING }, key);
  key.fill(0);
  return JSON.stringify({ version: 1, algorithm: 'RSA-OAEP-SHA256+AES-256-GCM', key: wrappedKey.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') });
}

export function decryptReport(envelope, privateKey) {
  const document = JSON.parse(envelope);
  if (document.version !== 1 || document.algorithm !== 'RSA-OAEP-SHA256+AES-256-GCM') throw Error('Unsupported encrypted report');
  const key = privateDecrypt({ key: privateKey, oaepHash: 'sha256', padding: constants.RSA_PKCS1_OAEP_PADDING }, Buffer.from(document.key, 'base64'));
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(document.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(document.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(document.ciphertext, 'base64')), decipher.final()]).toString('utf8');
  } finally { key.fill(0); }
}

async function cli() {
  const mode = process.argv[2];
  mkdirSync(results, { recursive: true, mode: 0o700 });
  if (mode === 'keys') {
    mkdirSync(keys, { recursive: true, mode: 0o700 });
    const privatePath = join(keys, 'private.pem'), publicPath = join(keys, 'public.pem');
    if (!existsSync(privatePath) && !existsSync(publicPath)) {
      const pair = generateKeyPairSync('rsa', { modulusLength: 3072, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
      writeFileSync(privatePath, pair.privateKey, { mode: 0o600, flag: 'wx' });
      writeFileSync(publicPath, pair.publicKey, { mode: 0o600, flag: 'wx' });
    }
    const privateKey = createPrivateKey(readFileSync(privatePath));
    const derived = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' });
    if (derived !== readFileSync(publicPath, 'utf8')) throw Error('Report keys do not match');
    console.log(`Report key ready. Public fingerprint: ${createHash('sha256').update(derived).digest('hex')}. Keep the ignored private.pem on this laptop.`);
  } else if (mode === 'encrypt-ios') {
    const path = join(results, 'TC-002-latest.html');
    if (!existsSync(path)) {
      const result = { caseId: 'TC-002', platform: 'ios', status: 'BLOCKED', attempts: [], blockers: ['No native result/report exists; inspect the sanitized build diagnostics.'], authenticationEvidence: 'No completed native report is available; authentication is not proven.' };
      const buildPath = join(results, 'ios-build-summary.json');
      if (existsSync(buildPath)) {
        const build = JSON.parse(readFileSync(buildPath, 'utf8'));
        const phases = ['not-started', 'configuration', 'expo-prebuild', 'cocoapods-install', 'simulator-startup', 'simulator-configuration', 'simulator-readiness', 'xcode-compilation', 'app-installation', 'complete', 'unknown'];
        if (phases.includes(build.phase)) result.blockers.push(`Build phase: ${build.phase}. Exit code: ${Number.isInteger(build.exitCode) ? build.exitCode : 'unavailable / interrupted'}.`);
        const categories = (build.diagnostics || []).filter(value => typeof value === 'string' && /^[a-z-]{1,60}$/.test(value));
        if (categories.length) result.blockers.push(`Sanitized build diagnostics: ${categories.join(', ')}.`);
      }
      recordRun(result);
    }
    if (!process.env.E2E_REPORT_PUBLIC_KEY) throw Error('Configure E2E_REPORT_PUBLIC_KEY before uploading a report');
    const encrypted = encryptReport(readFileSync(path, 'utf8'), process.env.E2E_REPORT_PUBLIC_KEY);
    writeFileSync(join(results, 'TC-002-report.encrypted.json'), encrypted, { mode: 0o600 });
    if (process.env.E2E_CI_REMOVE_PLAINTEXT === 'yes') {
      for (const name of readdirSync(results)) if (/^TC-002-(?:latest\.html|[0-9]+-attempt-[1-5]\.png)$/.test(name)) rmSync(join(results, name));
    }
    console.log('Encrypted iOS report ready. No plaintext report or screenshot may be uploaded.');
  } else if (mode === 'decrypt') {
    if (!process.argv[3]) throw Error('Supply the downloaded encrypted report path');
    const html = decryptReport(readFileSync(process.argv[3], 'utf8'), readFileSync(join(keys, 'private.pem')));
    const path = join(results, 'downloaded-ios-report.html');
    writeFileSync(path, html, { mode: 0o600 });
    archiveReport({ caseId: 'TC-002', status: 'DOWNLOADED — open report for result', evidenceStatus: 'See report', startedAt: new Date().toISOString(), kind: 'downloaded-report' }, html, results);
    console.log(`Private report: ${path}`);
  } else throw Error('Usage: node tests/e2e/scripts/report.mjs keys|encrypt-ios|decrypt <encrypted-file>');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli().catch(() => { console.error('Report operation failed. Check the mode, local keys and report configuration; no private content was printed.'); process.exitCode = 2; });
}
