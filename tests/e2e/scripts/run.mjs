// No dependencies, installs, builds, cloud calls, or backend requests in preflight.
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resultExitCode, screenshotEvidenceStatus } from './maestro-result.mjs';
import { authenticatedScreen, inspectLoginInputs, parseHierarchy, redactScreenshot, safeScreenState } from './screenshot.mjs';
import { recordRun, writeReport } from './report.mjs';
import { failureDiagnostics } from './failure-diagnostics.mjs';
import { inspectSimulator, mayRetrySimulatorProbe } from './ios-readiness.mjs';
import { createSystemUiRecovery, inspectAndroidWindows, isSystemUiAnr, monitorAndroidFlow } from './android-readiness.mjs';
import { executeLoginAttempt } from './login-attempt.mjs';
import { runAttempts } from './retry-policy.mjs';
import { matchesIosSource } from './ios-source.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const resultsDir = join(root, 'tests/e2e/results');
const productionHost = 'nzpnfrutomyuvrprkrwi.supabase.co';
const env = process.env;
const mode = process.argv[2];
const windows = process.platform === 'win32';
mkdirSync(resultsDir, { recursive: true, mode: 0o700 });

// Never forward account secrets into probes or build tools.
function toolEnv() {
  const result = { ...env };
  for (const key of Object.keys(result)) {
    if (/SECRET|TOKEN|PASSWORD|ANON_KEY|MAESTRO_E2E_EMAIL|MAESTRO_CLOUD_API_KEY/i.test(key)) delete result[key];
  }
  return result;
}

function executable(name, extra = []) {
  for (const candidate of extra.filter(Boolean)) if (existsSync(candidate)) return resolve(candidate);
  const suffixes = windows ? ['', '.exe', '.cmd', '.bat'] : [''];
  for (const directory of (env.PATH || '').split(delimiter)) {
    for (const suffix of suffixes) {
      const path = join(directory.replace(/^"|"$/g, ''), name + suffix);
      if (existsSync(path)) return resolve(path);
    }
  }
  return null;
}

// A constant PowerShell program invokes Windows .bat/.cmd with argument values
// passed as data, avoiding shell interpolation of paths or device identifiers.
async function call(binary, args, options = {}) {
  if (!binary) return { status: null, stdout: '', stderr: '' };
  const childEnv = options.env || toolEnv();
  let command = binary;
  let commandArgs = args;
  if (windows && ['.bat', '.cmd'].includes(extname(binary).toLowerCase())) {
    command = join(env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
    commandArgs = ['-NoProfile', '-NonInteractive', '-Command',
      '$toolArgs = @(ConvertFrom-Json $env:COMMITO_TOOL_ARGS); & $env:COMMITO_TOOL_EXEC @toolArgs; exit $LASTEXITCODE'];
    childEnv.COMMITO_TOOL_EXEC = binary;
    childEnv.COMMITO_TOOL_ARGS = JSON.stringify(args);
  }
  return await new Promise(resolveCall => {
    const outputFile = options.outputFile ? openSync(options.outputFile, 'wx', 0o600) : null;
    const child = spawn(command, commandArgs, {
      cwd: options.cwd || root, env: childEnv, windowsHide: true,
      detached: !windows, stdio: ['ignore', outputFile ?? 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '', error = null, bytes = 0;
    let termination = Promise.resolve();
    const stop = code => {
      if (error) return;
      error = { code };
      // Kill the complete tool tree while its parent is alive, before cleaning
      // raw artifacts or releasing the run lock. Killing PowerShell alone can
      // leave Java holding credentials and continuing the device run.
      if (windows) {
        const killed = spawnSync(join(env.SystemRoot || 'C:/Windows', 'System32/taskkill.exe'),
          ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 15000 });
        if (code === 'EANDROIDBLOCKED' && (killed.error || killed.status !== 0)) error = { code: 'EANDROIDSTOPFAILED' };
      } else {
        try { process.kill(-child.pid, 'SIGTERM'); } catch { /* Already exited. */ }
        termination = new Promise(done => setTimeout(() => {
          try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Already exited. */ }
          done();
        }, 1000));
      }
    };
    const timer = setTimeout(() => stop('ETIMEDOUT'), options.timeout || 20000);
    const onAbort = () => stop('EANDROIDBLOCKED');
    options.signal?.addEventListener('abort', onAbort, { once: true });
    if (options.signal?.aborted) onAbort();
    const collect = destination => chunk => {
      bytes += chunk.length;
      if (bytes > 8 * 1024 * 1024) { stop('ENOBUFS'); return; }
      if (destination === 'stdout') stdout += chunk.toString('utf8');
      else stderr += chunk.toString('utf8');
    };
    child.stdout?.on('data', collect('stdout'));
    child.stderr.on('data', collect('stderr'));
    child.on('error', caught => { error = { code: caught.code }; });
    child.on('close', async status => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      await termination;
      if (outputFile !== null) closeSync(outputFile);
      resolveCall({ status, stdout, stderr, error });
    });
  });
}

const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT || join(env.LOCALAPPDATA || '', 'Android/Sdk');
function projectJava() {
  const directory = join(root, 'tests/e2e/.tools/jdk');
  if (!existsSync(directory)) return null;
  return readdirSync(directory, { withFileTypes: true }).filter(entry => entry.isDirectory())
    .map(entry => join(directory, entry.name, 'bin', windows ? 'java.exe' : 'java')).find(existsSync) || null;
}
const tools = {
  adb: executable('adb', [env.E2E_ADB_BIN, join(sdk, 'platform-tools', windows ? 'adb.exe' : 'adb')]),
  java: executable('java', [env.JAVA_HOME && join(env.JAVA_HOME, 'bin', windows ? 'java.exe' : 'java'),
    projectJava(),
    windows && join(env.ProgramFiles || 'C:/Program Files', 'Android/Android Studio/jbr/bin/java.exe')]),
  maestro: executable('maestro', [env.E2E_MAESTRO_BIN,
    join(root, 'tests/e2e/.tools/maestro/bin', windows ? 'maestro.bat' : 'maestro'),
    join(root, 'tests/e2e/.tools/maestro/maestro/bin', windows ? 'maestro.bat' : 'maestro'),
    join(env.USERPROFILE || env.HOME || '', '.maestro/bin', windows ? 'maestro.bat' : 'maestro')]),
  git: executable('git'),
  xcrun: process.platform === 'darwin' ? executable('xcrun') : null,
};

function isolatedEnv(privateDir, credentials = false) {
  const result = toolEnv();
  const loggingConfig = join(privateDir, 'logging.properties');
  writeFileSync(loggingConfig, '.level=OFF\nhandlers=\n', { mode: 0o600 });
  // Maestro also uses JUL DebugLogStore in Windows' native application-data
  // folder, which ignores user.home. Disable JUL, and suppress Log4j messages
  // AND automatic exception traces. Friendly step labels alone do not redact.
  result.JAVA_TOOL_OPTIONS = `-Duser.home="${privateDir}" -Djava.util.logging.config.file="${loggingConfig}"`;
  result.MAESTRO_CLI_LOG_PATTERN_FILE = '[message suppressed]%n%ex{0}';
  if (tools.java) result.JAVA_HOME = resolve(dirname(tools.java), '..');
  result.ANDROID_HOME = sdk;
  result.ANDROID_USER_HOME = env.ANDROID_USER_HOME || join(env.USERPROFILE || env.HOME || '', '.android');
  result.MAESTRO_CLI_NO_ANALYTICS = 'true';
  result.MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED = 'true';
  result.MAESTRO_DISABLE_UPDATE_CHECK = 'true';
  if (credentials) {
    result.MAESTRO_E2E_EMAIL = env.MAESTRO_E2E_EMAIL;
    result.MAESTRO_E2E_PASSWORD = env.MAESTRO_E2E_PASSWORD;
  }
  return result;
}

async function doctor() {
  const temporary = mkdtempSync(join(resultsDir, '.private-doctor-'));
  try {
    const java = await call(tools.java, ['-version']);
    const javaMatch = `${java.stdout || ''} ${java.stderr || ''}`.match(/version "(\d+)/);
    const maestro = await call(tools.maestro, ['--version'], { env: isolatedEnv(temporary), cwd: temporary, timeout: 60000 });
    const adb = await call(tools.adb, ['devices']);
    const deviceCount = (adb.stdout || '').split(/\r?\n/).filter(line => /\tdevice\s*$/.test(line)).length;
    const report = {
      kind: 'environment-only', status: 'NOT_RUN', host: process.platform,
      java17OrNewer: java.status === 0 && Number(javaMatch?.[1]) >= 17,
      maestroAvailable: maestro.status === 0,
      adbAvailable: adb.status === 0, readyAndroidDevices: deviceCount,
      iosHostCapable: process.platform === 'darwin' && Boolean(tools.xcrun),
      credentialsRequested: false, backendContacted: false,
    };
    console.log(JSON.stringify(report, null, 2));
    return report.java17OrNewer && report.maestroAvailable ? 0 : 2;
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}

function valid(value, pattern) { return typeof value === 'string' && pattern.test(value); }
async function prepare(platform) {
  const android = platform === 'android';
  const key = platform.toUpperCase();
  const metadata = {
    platform, caseId: android ? 'TC-001' : 'TC-002',
    appId: env[`E2E_${key}_APP_ID`] || 'com.sadik.microhabit',
    device: env[`E2E_${key}_DEVICE`] || null,
    backendEnvironment: env.E2E_BACKEND_ENV || null,
    backendHost: env.E2E_BACKEND_HOST || null,
    backendEvidence: 'Operator-confirmed build configuration; not discovered from installed binary',
    appVersion: null, appBuild: null, osVersion: null,
    sourceRevision: null, maestroVersion: null,
    command: `npm run e2e:${platform}`,
  };
  const blockers = [];
  let recovery = null;
  const block = message => blockers.push(message);
  // Only allow bounded metadata suitable for sanitized reports.
  if (!valid(metadata.appId, /^[A-Za-z][A-Za-z0-9_.]{2,150}$/)) { metadata.appId = null; block('Invalid application identifier.'); }
  if (!valid(metadata.device, /^[A-Za-z0-9_.:-]{1,100}$/)) { metadata.device = null; block(`Set E2E_${key}_DEVICE to one explicit emulator/Simulator identifier.`); }
  if (!['staging', 'production'].includes(metadata.backendEnvironment)) { metadata.backendEnvironment = null; block('Set E2E_BACKEND_ENV to staging or production.'); }
  if (!valid(metadata.backendHost, /^[a-z0-9][a-z0-9.-]{1,250}\.[a-z]{2,20}$/)) { metadata.backendHost = null; block('Set E2E_BACKEND_HOST to the built-in backend hostname only.'); }
  if (metadata.backendHost === productionHost && metadata.backendEnvironment !== 'production') block('The known production host must be labelled production.');
  if (metadata.backendEnvironment === 'production' || metadata.backendHost === productionHost) {
    if (env.E2E_ALLOW_PRODUCTION_LOGIN !== 'yes') block('Production login requires E2E_ALLOW_PRODUCTION_LOGIN=yes; auth metadata and profile writes occur.');
  }
  if (env.E2E_BUILD_BACKEND_CONFIRMED !== 'yes') block('Confirm the installed build backend using E2E_BUILD_BACKEND_CONFIRMED=yes.');
  if (!env.MAESTRO_E2E_EMAIL || !env.MAESTRO_E2E_PASSWORD) block('Supply account email/password securely at runtime.');
  if (env.MAESTRO_E2E_EMAIL && !/^[\x20-\x7e]+$/.test(env.MAESTRO_E2E_EMAIL) || env.MAESTRO_E2E_PASSWORD && !/^[\x20-\x7e]+$/.test(env.MAESTRO_E2E_PASSWORD)) block('These flows require printable ASCII credentials; Maestro Android inputText does not support Unicode.');
  const git = await call(tools.git, ['rev-parse', 'HEAD']);
  const revision = git.stdout?.trim();
  if (git.status === 0 && valid(revision, /^[a-f0-9]{40}$/)) metadata.sourceRevision = revision;
  else block('A Git source revision is required for reproducible evidence.');
  if (!tools.maestro) block('Maestro CLI is not installed; see README.');
  const java = await call(tools.java, ['-version']);
  const javaMatch = `${java.stdout || ''} ${java.stderr || ''}`.match(/version "(\d+)/);
  if (java.status !== 0 || Number(javaMatch?.[1] || 0) < 17) block('Java 17 or newer must be available through JAVA_HOME/PATH.');
  if (tools.maestro && tools.java) {
    const temporary = mkdtempSync(join(resultsDir, '.private-preflight-'));
    try {
      const startup = await call(tools.maestro, ['--version'], { env: isolatedEnv(temporary), cwd: temporary, timeout: 60000 });
      if (startup.error || startup.status !== 0) block('Maestro is present but cannot start; check its local permissions and Java setup. No UI case executed.');
      else if (!/(?:^|\s)2\.12\.0(?:\s|$)/.test(startup.stdout || '')) block('Use the validated Maestro CLI version 2.12.0. No UI case executed.');
      else metadata.maestroVersion = '2.12.0';
    } finally { rmSync(temporary, { recursive: true, force: true }); }
  }
  if (!android && process.platform !== 'darwin') block('iOS native automation requires macOS and Xcode; Windows/iPhone USB is insufficient.');
  if (!android && !matchesIosSource(env.E2E_IOS_SOURCE_SHA, metadata.sourceRevision)) block('E2E_IOS_SOURCE_SHA must match the tested source revision.');
  if (!android && env.E2E_DISPOSABLE_SIMULATOR !== 'yes') block('Confirm E2E_DISPOSABLE_SIMULATOR=yes: the entire Simulator Keychain will be cleared.');

  if (android && !tools.adb) block('Android SDK ADB is unavailable.');
  if (android && tools.adb && metadata.device && metadata.appId) {
    const adb = args => call(tools.adb, ['-s', metadata.device, ...args]);
    if ((await adb(['get-state'])).stdout?.trim() !== 'device') block('The selected Android emulator is not ready/authorized.');
    else {
      const emulator = (await adb(['shell', 'getprop', 'ro.kernel.qemu'])).stdout?.trim() === '1';
      if (!emulator) block('TC-001 requires a dedicated Android emulator.');
      else {
        recovery = createSystemUiRecovery(adb);
        const windows = await recovery.query();
        metadata.androidReadiness = isSystemUiAnr(windows) ? await recovery.recover(windows, 'preflight') : inspectAndroidWindows(windows);
        if (!metadata.androidReadiness.ready) block(`Android readiness blocked: ${metadata.androidReadiness.diagnostic}; category: ${metadata.androidReadiness.category || 'unknown'}. Resolve device setup before login.`);
      }
      const os = (await adb(['shell', 'getprop', 'ro.build.version.release'])).stdout?.trim();
      if (valid(os, /^[0-9.]{1,30}$/)) metadata.osVersion = os;
      const installed = await adb(['shell', 'dumpsys', 'package', metadata.appId]);
      const version = installed.stdout?.match(/\bversionName=([^\s]+)/)?.[1];
      const build = installed.stdout?.match(/\bversionCode=(\d+)/)?.[1];
      if (valid(version, /^[A-Za-z0-9.+_-]{1,50}$/) && build) { metadata.appVersion = version; metadata.appBuild = build; }
      else block('The selected application is not installed or its version/build cannot be read.');
      if (!metadata.osVersion) block('Cannot discover the Android OS version.');
    }
  }
  if (!android && process.platform === 'darwin' && tools.xcrun && metadata.device && metadata.appId) {
    console.log('iOS preflight: checking the selected Simulator; no login attempt has started.');
    const probe = async () => {
      const started = Date.now();
      const checked = inspectSimulator(await call(tools.xcrun, ['simctl', 'list', 'devices', 'available', '--json'], { timeout: 90000 }), metadata.device);
      return { ...checked, durationSeconds: Math.round((Date.now() - started) / 100) / 10 };
    };
    let readiness = await probe();
    const checks = [readiness];
    if (!readiness.ready && mayRetrySimulatorProbe(readiness)) {
      console.log(`iOS preflight: ${readiness.diagnostic}; retrying the read-only readiness check once.`);
      await new Promise(done => setTimeout(done, 5000));
      readiness = await probe(); checks.push(readiness);
    }
    metadata.simulatorReadiness = checks;
    if (!readiness.ready) block(`iOS readiness blocked: ${readiness.diagnostic}; observed state: ${readiness.state || 'not available'}. No login attempt started.`);
    else {
      metadata.osVersion = readiness.osVersion;
      const container = await call(tools.xcrun, ['simctl', 'get_app_container', metadata.device, metadata.appId, 'app'], { timeout: 90000 });
      if (container.error?.code === 'ETIMEDOUT') block('iOS app-container query timed out; installation could not be verified.');
      else if (container.error || container.status !== 0) block('The selected iOS Simulator app container could not be verified.');
      else {
        const plist = join(container.stdout.trim(), 'Info.plist');
        const read = async field => (await call('/usr/libexec/PlistBuddy', ['-c', `Print :${field}`, plist])).stdout?.trim();
        const version = await read('CFBundleShortVersionString');
        const build = await read('CFBundleVersion');
        if (valid(version, /^[A-Za-z0-9.+_-]{1,50}$/) && valid(build, /^[0-9.]{1,50}$/)) { metadata.appVersion = version; metadata.appBuild = build; }
        else block('Cannot discover the installed iOS app version/build.');
      }
      if (!metadata.osVersion) block('Cannot discover the iOS runtime version.');
    }
  }
  if (!android && process.platform === 'darwin' && !tools.xcrun) block('Xcode Command Line Tools are unavailable.');
  for (const [field, suffix] of [['appVersion', 'APP_VERSION'], ['appBuild', 'APP_BUILD']]) {
    if (env[`E2E_${key}_${suffix}`] && env[`E2E_${key}_${suffix}`] !== metadata[field]) block(`Installed ${field} differs from the expected E2E_${key}_${suffix}.`);
  }
  return { metadata, blockers, recovery };
}

async function captureScreenshot(metadata, attempt, output, { requireLoaded = false, verifyInputs = false, reuseDriver = false } = {}) {
  const started = Date.now();
  let phase = 'hierarchy-before';
  let phaseStarted = started;
  const timings = {};
  let inputChecks;
  const nextPhase = next => {
    timings[phase] = Math.round((Date.now() - phaseStarted) / 100) / 10;
    phase = next; phaseStarted = Date.now();
  };
  try {
    const hierarchy = async (reuseDriver = false) => {
      const child = await call(tools.maestro, ['--device', metadata.device, '--platform', metadata.platform, 'hierarchy', ...(reuseDriver ? ['--no-reinstall-driver'] : [])],
        { env: isolatedEnv(output), cwd: output, timeout: 90000 });
      if (child.error?.code === 'ETIMEDOUT') throw Error('Hierarchy timed out');
      if (child.status !== 0 || child.error) throw Error('Hierarchy command failed');
      return parseHierarchy(child.stdout);
    };
    const before = await hierarchy(reuseDriver);
    nextPhase('native-capture');
    const raw = join(output, 'native-screen.png');
    const image = metadata.platform === 'android'
      ? await call(tools.adb, ['-s', metadata.device, 'exec-out', 'screencap', '-p'], { outputFile: raw, timeout: 20000 })
      : await call(tools.xcrun, ['simctl', 'io', metadata.device, 'screenshot', '--type=png', raw], { timeout: 20000 });
    if (image.status !== 0 || image.error) throw Error('Screenshot unavailable');
    const capturedAt = new Date().toISOString();
    nextPhase('hierarchy-after');
    const after = await hierarchy(true);
    if (verifyInputs) inputChecks = {
      before: inspectLoginInputs(before, metadata.appId, env.MAESTRO_E2E_EMAIL, env.MAESTRO_E2E_PASSWORD),
      after: inspectLoginInputs(after, metadata.appId, env.MAESTRO_E2E_EMAIL, env.MAESTRO_E2E_PASSWORD),
    };
    nextPhase('validation-and-redaction');
    if (requireLoaded) {
      if (!authenticatedScreen(before, metadata.appId) || !authenticatedScreen(after, metadata.appId)) throw Error('Authenticated screenshot unavailable');
    }
    const redacted = redactScreenshot(readFileSync(raw), [before, after], [env.MAESTRO_E2E_PASSWORD], { showLoginInputs: true, appId: metadata.appId });
    const file = `${metadata.caseId}-${Date.now()}-attempt-${attempt}.png`;
    writeFileSync(join(resultsDir, file), redacted.png, { mode: 0o600 });
    timings[phase] = Math.round((Date.now() - phaseStarted) / 100) / 10;
    return { status: 'CAPTURED', file, capturedAt, redactions: redacted.redactions, privacyPolicy: 'visible-email-native-password-mask-v1', timings, ...(inputChecks ? { inputChecks } : {}),
      stateBefore: safeScreenState(before, metadata.appId), stateAfter: safeScreenState(after, metadata.appId),
      durationSeconds: Math.round((Date.now() - started) / 100) / 10 };
  } catch (error) {
    timings[phase] = Math.round((Date.now() - phaseStarted) / 100) / 10;
    const categories = { 'Hierarchy timed out': 'hierarchy-timeout', 'Hierarchy command failed': 'hierarchy-command-failed', 'Hierarchy unavailable': 'hierarchy-unavailable', 'Screenshot unavailable': 'native-capture-unavailable', 'Authenticated screenshot unavailable': 'authenticated-screen-not-visible', 'Cannot verify screenshot coordinates': 'unverified-coordinates', 'Cannot safely redact an element': 'unverified-redaction-bounds', 'Unsupported screenshot': 'unsupported-image' };
    return { status: 'UNAVAILABLE', phase, timings, ...(inputChecks ? { inputChecks } : {}), diagnostic: categories[error.message] || 'image-processing-or-output', durationSeconds: Math.round((Date.now() - started) / 100) / 10, finding: 'Native screenshot could not be captured and safely redacted; raw pixels were discarded.' };
  }
}

async function run(platform, prerequisite = null) {
  const started = Date.now();
  const { metadata, blockers, recovery } = await prepare(platform);
  if (prerequisite) blockers.push(prerequisite);
  const report = {
    ...metadata, startedAt: new Date(started).toISOString(), status: 'BLOCKED',
    blockers, attempts: [], requiresInputScreenshot: platform === 'ios', durationSeconds: 0, authenticationEvidence: 'Not executed',
    rawArtifacts: 'Raw logs/reports deleted; only credential-redacted PNG evidence and a private HTML report are retained.',
  };
  if (!blockers.length) {
    const temporary = mkdtempSync(join(resultsDir, '.private-run-'));
    try {
      const childEnv = isolatedEnv(temporary, true);
      childEnv.MAESTRO_E2E_APP_ID = metadata.appId;
      const outcome = await runAttempts(async index => {
        console.log(`${metadata.caseId}: attempt ${index} started; credentials remain private.`);
        const output = join(temporary, `attempt-${index}`);
        mkdirSync(output, { mode: 0o700 });
        const attempt = await executeLoginAttempt({ platform, attempt: index,
          runFlow: async (phase, { reuseDriver, timeout }) => {
            console.log(`${metadata.caseId}: attempt ${index} phase ${phase}.`);
            const phaseOutput = join(output, phase);
            mkdirSync(phaseOutput, { mode: 0o700 });
            const reportPath = join(phaseOutput, 'report.xml');
            const flow = join(root, 'tests/e2e/maestro', phase === 'full' ? `${metadata.caseId}-${platform}-login.yaml` : `ios/${phase}-login.yaml`);
            const args = ['--device', metadata.device, '--platform', platform, 'test', ...(reuseDriver ? ['--no-reinstall-driver'] : []),
              '--format', 'junit', '--output', reportPath, '--debug-output', phaseOutput, '--test-output-dir', phaseOutput, flow];
            const execute = async signal => {
              const child = await call(tools.maestro, args, { env: childEnv, cwd: temporary, timeout, signal });
              return { child, xml: existsSync(reportPath) ? readFileSync(reportPath, 'utf8') : '' };
            };
            return platform === 'android' ? await monitorAndroidFlow(recovery, execute) : await execute();
          },
          capture: options => captureScreenshot(metadata, index, output, options),
          diagnostics: () => failureDiagnostics(output),
        });
        console.log(`${metadata.caseId}: attempt ${index} assertions ${attempt.status}.`);
        console.log(`${metadata.caseId}: attempt ${index} screenshot ${attempt.screenshot.status}.`);
        return attempt;
      });
      Object.assign(report, outcome);
      if (report.status === 'BLOCKED') report.blockers.push('Android system monitoring blocked the test or no counted login attempt remained after recovery.');
      report.authenticationEvidence = report.status === 'PASS' ?
        'The passing attempt reached the conditional server-loaded leagues marker with no auth/load errors, then repeated it after restart without clearing storage.' : 'Assertions did not complete successfully; authentication is not proven.';
    } finally { rmSync(temporary, { recursive: true, force: true }); }
  }
  if (recovery) report.androidRecoveries = recovery.events;
  report.durationSeconds = Math.round((Date.now() - started) / 100) / 10;
  report.evidenceStatus = screenshotEvidenceStatus(report);
  try { recordRun(report); }
  catch {
    report.evidenceStatus = 'INCOMPLETE'; report.historyStatus = 'UNAVAILABLE'; report.evidenceFinding = 'The private HTML report or dated history could not be written.';
    writeFileSync(join(resultsDir, `${metadata.caseId}-latest.json`), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  }
  console.log(JSON.stringify(report, null, 2));
  return report;
}

let lock = false;
try {
  if (mode === 'doctor') process.exitCode = await doctor();
  else if (['android', 'ios', 'all', 'snapshot-android'].includes(mode)) {
    try { writeFileSync(join(resultsDir, '.run.lock'), String(process.pid), { flag: 'wx', mode: 0o600 }); lock = true; }
    catch { throw new Error('Another E2E run holds the local lock. If a previous process was interrupted, verify it has stopped before removing tests/e2e/results/.run.lock.'); }
    if (mode === 'snapshot-android') {
      const path = join(resultsDir, 'TC-001-latest.json');
      const report = JSON.parse(readFileSync(path, 'utf8'));
      if (report.status !== 'PASS' || report.platform !== 'android' || !valid(report.device, /^emulator-\d+$/) || !valid(report.appId, /^[A-Za-z][A-Za-z0-9_.]{2,150}$/)) throw Error('A recorded Android pass is required');
      const installed = await call(tools.adb, ['-s', report.device, 'shell', 'dumpsys', 'package', report.appId]);
      if (installed.status !== 0 || installed.stdout?.match(/\bversionName=([^\s]+)/)?.[1] !== report.appVersion || installed.stdout?.match(/\bversionCode=(\d+)/)?.[1] !== report.appBuild) throw Error('Installed build differs from recorded pass');
      const temporary = mkdtempSync(join(resultsDir, '.private-snapshot-'));
      try {
        const screenshot = await captureScreenshot(report, 1, temporary, { requireLoaded: true });
        report.supplementalScreenshot = { ...screenshot, context: 'Captured after the recorded run, not at assertion time. This is not a new login test.' };
        report.evidenceStatus = 'INCOMPLETE: earlier attempts have no assertion-time screenshots';
        writeReport(report);
        writeFileSync(path, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
        console.log(JSON.stringify({ kind: 'supplemental-android-image', screenshot, testRerun: false }));
        process.exitCode = screenshot.status === 'CAPTURED' ? 0 : 2;
      } finally { rmSync(temporary, { recursive: true, force: true }); }
    } else if (mode === 'all') {
      const android = await run('android');
      const ios = await run('ios');
      process.exitCode = resultExitCode(android) === 0 ? resultExitCode(ios) : resultExitCode(android);
    } else {
      const result = await run(mode);
      process.exitCode = resultExitCode(result);
    }
  } else { console.error('Usage: node tests/e2e/scripts/run.mjs doctor|android|ios|all'); process.exitCode = 2; }
} catch (error) {
  // Never print caught child output, stack traces, input values, or raw reports.
  console.error(error.message?.startsWith('Another E2E run') ? error.message : 'E2E runner could not finish. Check local tool permissions and setup; no PASS is recorded.');
  process.exitCode = 2;
} finally {
  if (lock) rmSync(join(resultsDir, '.run.lock'), { force: true });
}
