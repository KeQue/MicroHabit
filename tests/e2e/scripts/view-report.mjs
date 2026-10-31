import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export function browserCommand(platform, path, environment = process.env, exists = existsSync, mode = null) {
  const url = pathToFileURL(path).href;
  if (platform === 'win32') {
    const bases = [environment['ProgramFiles(x86)'], environment.ProgramFiles, environment.LOCALAPPDATA].filter(Boolean);
    if (mode === 'android') {
      const executable = bases.map(base => join(base, 'Microsoft/Edge/Application/msedge.exe')).find(exists);
      if (!executable) throw Error('Install Microsoft Edge to view the Android report.');
      return { executable, args: ['--new-window', url] };
    }
    const browsers = ['Microsoft/Edge/Application/msedge.exe', 'Google/Chrome/Application/chrome.exe', 'Mozilla Firefox/firefox.exe'];
    for (const browser of browsers) for (const base of bases) {
      const executable = join(base, browser);
      if (exists(executable)) return { executable, args: ['--new-window', url] };
    }
    throw Error('Install Edge, Chrome or Firefox to view the private report.');
  }
  if (platform === 'darwin') return { executable: '/usr/bin/open', args: ['-a', 'Safari', url] };
  throw Error('Open the private HTML report in a browser on this host.');
}

export function openReport(mode, { launch = spawn, platform = process.platform, environment = process.env, exists = existsSync } = {}) {
  const reports = { android: 'TC-001-latest.html', ios: 'TC-002-latest.html', 'downloaded-ios': 'downloaded-ios-report.html', history: 'history/index.html' };
  if (!reports[mode]) throw Error('Usage: npm run e2e:report -- android|ios|downloaded-ios|history');
  const path = join(root, 'tests/e2e/results', reports[mode]);
  if (!exists(path)) throw Error('No report exists yet for this test.');
  const command = browserCommand(platform, path, environment, exists, mode);
  // Invoke a browser explicitly: Windows may associate .html with VS Code.
  // Arguments are data; no shell, local server, upload or cloud execution.
  return new Promise((resolveOpen, reject) => {
    const child = launch(command.executable, command.args, { detached: true, stdio: 'ignore', windowsHide: false });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolveOpen(path); });
  });
}

// Called once by the Android launcher after the credential runner exits,
// regardless of its result. An old or absent report must never be reopened.
export async function openUpdatedAndroidReport(previousNs, { stat = statSync, open = openReport } = {}) {
  if (typeof previousNs !== 'bigint' || previousNs < -1n) throw Error('Invalid report timestamp.');
  const path = join(root, 'tests/e2e/results/TC-001-latest.html');
  let current;
  try { current = stat(path, { bigint: true }); }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  if (!current.isFile() || current.mtimeNs <= previousNs) return false;
  await open('android');
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const freshAndroid = process.argv[2] === 'android' && process.argv[3] === '--newer-than-ns';
  const action = freshAndroid && /^-?\d+$/.test(process.argv[4] || '')
    ? openUpdatedAndroidReport(BigInt(process.argv[4]))
    : freshAndroid ? Promise.reject(Error('Invalid report timestamp.')) : openReport(process.argv[2]);
  action.then(opened => { if (opened) console.log('Opened the private report in your browser.'); })
    .catch(error => { console.error(error.message); process.exitCode = 2; });
}
