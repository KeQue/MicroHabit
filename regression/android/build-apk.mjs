import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { canReuse, fingerprint, isAppInput } from './apk-fingerprint.mjs';

const apk = 'android/app/build/outputs/apk/release/app-release.apk';
const manifestPath = 'tests/e2e/.tools/android-apk-provenance.json';
const results = 'tests/e2e/results';
const hashFile = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const git = args => {
  const result = spawnSync('git', args, { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  if (result.error || result.status !== 0) throw Error('Cannot inspect app source.');
  return result.stdout;
};
function inputs() {
  if (git(['status', '--porcelain', '--untracked-files=no']).trim()) throw Error('Commit tracked changes before building the app.');
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean).filter(isAppInput);
  if (untracked.length) throw Error('Untracked application files found; commit or remove them before building.');
  const tracked = git(['ls-files', '-z']).split('\0').filter(Boolean).filter(isAppInput);
  const entries = tracked.map(path => [path, readFileSync(path)]);
  for (const path of readdirSync('.').filter(name => /^\.env(?:\.[a-zA-Z0-9_-]+)*$/.test(name))) entries.push([path, readFileSync(path)]);
  const publicEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => name.startsWith('EXPO_PUBLIC_')).sort(([a], [b]) => a.localeCompare(b)));
  entries.push(['runtime-public-env', JSON.stringify(publicEnv)]);
  const installedLock = 'node_modules/.package-lock.json';
  if (!existsSync(installedLock)) throw Error('Installed dependencies cannot be verified.');
  const wanted = JSON.parse(readFileSync('package-lock.json', 'utf8')).packages || {};
  const installed = JSON.parse(readFileSync(installedLock, 'utf8')).packages || {};
  if (!Object.keys(installed).length || Object.entries(installed).some(([path, entry]) => !wanted[path] || wanted[path].version !== entry.version)) throw Error('Installed dependencies do not match the project lockfile.');
  entries.push(['installed-package-lock', readFileSync(installedLock)]);
  return fingerprint(entries);
}
try {
  const cleanEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !/MAESTRO_E2E_|E2E_LOGIN_|PASSWORD|TOKEN|SECRET/i.test(name))), NODE_ENV: 'production', CI: '1' };
  const config = spawnSync(process.execPath, ['node_modules/expo/bin/cli', 'config', '--type', 'public', '--json'], { env: cleanEnv, encoding: 'utf8', timeout: 60000, windowsHide: true });
  if (config.error || config.status !== 0) throw Error('Cannot resolve the app build configuration.');
  const resolved = JSON.parse(config.stdout);
  if (resolved.extra?.supabaseUrl !== 'https://nzpnfrutomyuvrprkrwi.supabase.co' || !resolved.extra?.supabaseAnon) throw Error('The Android build is not configured for the approved production backend.');
  const inputHash = inputs();
  let manifest;
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch { manifest = null; }
  if (existsSync(apk) && canReuse(manifest, inputHash, hashFile(apk))) {
    console.log('Android APK matches the recorded app inputs; reusing it.');
  } else {
    const jdk = JSON.parse(readFileSync('tests/e2e/.tools/jdk/installation.json', 'utf8')).home;
    if (!existsSync(join(jdk, 'bin/java.exe'))) throw Error('The existing Android build JDK is unavailable.');
    const buildEnv = { ...cleanEnv, JAVA_HOME: jdk, ANDROID_HOME: join(process.env.LOCALAPPDATA, 'Android/Sdk'), GRADLE_USER_HOME: join(process.cwd(), 'tests/e2e/.tools/gradle-cache'), NODE_ENV: 'production', CI: '1' };
    mkdirSync(results, { recursive: true, mode: 0o700 });
    const temporary = mkdtempSync(join(results, '.private-build-'));
    const log = openSync(join(temporary, 'build.log'), 'w', 0o600);
    try {
      console.log('Building a fresh Android Release APK; this may take several minutes.');
      const run = (command, args) => spawnSync(command, args, { env: buildEnv, stdio: ['ignore', log, log], windowsHide: true, timeout: 3600000 });
      const prebuild = run(process.execPath, ['node_modules/expo/bin/cli', 'prebuild', '--platform', 'android', '--no-install', '--skip-dependency-update', 'react,react-native']);
      if (prebuild.error || prebuild.status !== 0) throw Error('Android Expo prebuild failed; private build output was discarded.');
      const gradle = run(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'android\\gradlew.bat', '-p', 'android', ':app:assembleRelease', '--no-daemon', '--max-workers=2', '-Dorg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m', '-PreactNativeArchitectures=x86_64']);
      if (gradle.error || gradle.status !== 0 || !existsSync(apk)) throw Error('Android Release build failed; private build output was discarded.');
      if (inputs() !== inputHash) throw Error('App inputs changed during the build; the APK was not accepted.');
      writeFileSync(manifestPath, JSON.stringify({ version: 1, inputHash, apkHash: hashFile(apk) }) + '\n', { mode: 0o600 });
      console.log('Fresh Android APK built and recorded.');
    } finally { closeSync(log); rmSync(temporary, { recursive: true, force: true }); }
  }
} catch (error) { console.error(error.message); process.exitCode = 2; }
