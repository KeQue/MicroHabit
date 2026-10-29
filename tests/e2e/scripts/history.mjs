import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const escape = value => String(value ?? 'Unavailable').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const validFolder = value => /^TC-00[12]-[0-9TZ-]+-[a-f0-9]{8}$/.test(value);
const round = value => Math.round(value * 10) / 10;

function entries(directory) {
  const history = join(directory, 'history');
  if (!existsSync(history)) return [];
  return readdirSync(history, { withFileTypes: true }).filter(entry => entry.isDirectory() && validFolder(entry.name)).flatMap(entry => {
    try {
      const report = JSON.parse(readFileSync(join(history, entry.name, 'result.json'), 'utf8'));
      return [{ folder: entry.name, report }];
    } catch { return []; } // Preserve damaged entries; do not present them as valid.
  }).sort((a, b) => String(b.report.startedAt).localeCompare(String(a.report.startedAt)) || b.folder.localeCompare(a.folder));
}

export function timingTotals(report) {
  const attempts = report.attempts || [];
  const sum = getter => attempts.every(attempt => Number.isFinite(getter(attempt))) ? round(attempts.reduce((total, attempt) => total + getter(attempt), 0)) : null;
  return { runSeconds: Number.isFinite(report.durationSeconds) ? report.durationSeconds : null, uiSeconds: sum(attempt => attempt.durationSeconds), captureSeconds: sum(attempt => attempt.screenshot?.durationSeconds) };
}

export function comparePreviousRun(report, directory) {
  if (report.status !== 'PASS' || report.evidenceStatus !== 'COMPLETE') return null;
  const fields = ['caseId', 'platform', 'appId', 'device', 'osVersion', 'appVersion', 'appBuild', 'backendEnvironment', 'backendHost', 'maestroVersion'];
  const previous = entries(directory).map(entry => entry.report).find(candidate => candidate.status === 'PASS' && candidate.evidenceStatus === 'COMPLETE'
    && candidate.startedAt < report.startedAt && fields.every(field => report[field] != null && candidate[field] === report[field])
    && candidate.attempts?.length === report.attempts?.length);
  if (!previous) return null;
  const current = timingTotals(report), baseline = timingTotals(previous);
  const delta = Object.fromEntries(Object.keys(current).map(key => [key, current[key] !== null && baseline[key] !== null ? round(current[key] - baseline[key]) : null]));
  return { startedAt: previous.startedAt, sourceRevision: previous.sourceRevision, baseline, deltaSeconds: delta, finding: 'Same device, OS, installed build, backend, tool version and attempt count. Timing differences are observations; they do not prove a cause.' };
}

export function archiveReport(report, html, directory) {
  if (!/^TC-00[12]$/.test(report.caseId)) throw Error('Invalid archive case');
  const date = new Date(report.startedAt || Date.now());
  if (!Number.isFinite(date.getTime())) throw Error('Invalid archive date');
  const folder = `${report.caseId}-${date.toISOString().replace(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}`;
  const target = join(directory, 'history', folder);
  mkdirSync(target, { recursive: true, mode: 0o700 });
  // Self-contained HTML includes its own redacted pixels. Later runs cannot
  // overwrite it, even if they have an identical start time.
  writeFileSync(join(target, 'report.html'), html, { mode: 0o600, flag: 'wx' });
  writeFileSync(join(target, 'result.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  writeHistoryIndex(directory);
  return `history/${folder}/report.html`;
}

export function writeHistoryIndex(directory) {
  const history = join(directory, 'history');
  mkdirSync(history, { recursive: true, mode: 0o700 });
  const rows = entries(directory).map(({ folder, report }) => {
    const name = report.caseId === 'TC-001' ? 'Login on Android' : 'Login on iOS';
    return `<tr><td><a href="${folder}/report.html">${name}</a></td><td>${escape(report.startedAt)}</td><td>${escape(report.status)}</td><td>${escape(report.evidenceStatus)}</td><td>${escape(report.durationSeconds)}</td></tr>`;
  }).join('');
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Commito private test history</title><style>body{font:16px system-ui;margin:32px auto;padding:0 20px;max-width:1000px}table{border-collapse:collapse;width:100%}td,th{padding:10px;border:1px solid #ddd;text-align:left;overflow-wrap:anywhere}</style><h1>Private test history</h1><p>Each report retains its own screenshots. Times below are UTC. Downloaded iOS reports show their actual result inside the report.</p><table><tr><th>Test</th><th>Started / downloaded</th><th>Result</th><th>Images</th><th>Seconds</th></tr>${rows}</table></html>`;
  writeFileSync(join(history, 'index.html'), html, { mode: 0o600 });
}
