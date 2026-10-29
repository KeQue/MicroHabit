import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export function browserCommand(platform, path, environment = process.env, exists = existsSync) {
  const url = pathToFileURL(path).href;
  if (platform === 'win32') {
    const bases = [environment['ProgramFiles(x86)'], environment.ProgramFiles, environment.LOCALAPPDATA].filter(Boolean);
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

export function openReport(mode) {
  const reports = { android: 'TC-001-latest.html', ios: 'TC-002-latest.html', 'downloaded-ios': 'downloaded-ios-report.html', history: 'history/index.html' };
  if (!reports[mode]) throw Error('Usage: npm run e2e:report -- android|ios|downloaded-ios|history');
  const path = join(root, 'tests/e2e/results', reports[mode]);
  if (!existsSync(path)) throw Error('No report exists yet for this test.');
  const command = browserCommand(process.platform, path);
  // Invoke a browser explicitly: Windows may associate .html with VS Code.
  // Arguments are data; no shell, local server, upload or cloud execution.
  return new Promise((resolveOpen, reject) => {
    const child = spawn(command.executable, command.args, { detached: true, stdio: 'ignore', windowsHide: false });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolveOpen(path); });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  openReport(process.argv[2]).then(() => console.log('Opened the private report in your browser.'))
    .catch(error => { console.error(error.message); process.exitCode = 2; });
}
