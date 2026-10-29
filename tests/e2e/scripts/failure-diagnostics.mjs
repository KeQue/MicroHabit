import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const checkpoints = new Set(['app-launched', 'login-controls-ready', 'email-entered', 'password-entered', 'keyboard-dismissed', 'login-submitted', 'authenticated-loaded', 'process-restarted', 'session-restored']);
const targets = new Set(['e2e-login-email', 'e2e-login-password', 'e2e-login-submit', 'e2e-auth-error', 'e2e-leagues-loaded', 'e2e-leagues-error']);
const kinds = { launchAppCommand: 'launch', inputTextCommand: 'text-entry', tapOnElementCommand: 'tap', assertConditionCommand: 'assertion', hideKeyboardCommand: 'keyboard-dismissal', runFlowCommand: 'subflow', stopAppCommand: 'stop-app', evalScriptCommand: 'checkpoint' };

export function summarizeCommands(records) {
  const complete = records.filter(record => record?.metadata?.status === 'COMPLETED').sort((a, b) => Number(b.metadata.timestamp || 0) - Number(a.metadata.timestamp || 0));
  let lastCompletedCheckpoint = null;
  for (const record of complete) {
    const script = record.command?.evalScriptCommand?.scriptString;
    // Pinned Maestro 2.12 retains the ${...} delimiters in command reports.
    const checkpoint = typeof script === 'string' ? /^\$\{output\.e2eCheckpoint = "([a-z-]+)"\}$/.exec(script.trim())?.[1] : null;
    if (checkpoints.has(checkpoint)) { lastCompletedCheckpoint = checkpoint; break; }
  }
  const failed = records.filter(record => record?.metadata?.status === 'FAILED')
    .sort((a, b) => Number(b.metadata.depth || 0) - Number(a.metadata.depth || 0) || Number(b.metadata.timestamp || 0) - Number(a.metadata.timestamp || 0))[0];
  const command = failed?.command || {};
  const kind = Object.keys(command).find(key => kinds[key]);
  const selector = command.tapOnElementCommand?.selector || command.assertConditionCommand?.condition?.visible || command.assertConditionCommand?.condition?.notVisible;
  const id = selector?.idRegex;
  // Never return raw messages, command values, environment variables or trees.
  return { lastCompletedCheckpoint, failedCommand: kinds[kind] || 'unknown', failedTarget: targets.has(id) ? id : null };
}

export function failureDiagnostics(directory) {
  const records = [];
  const inspect = (path, depth = 0) => {
    if (depth > 5) return;
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) inspect(file, depth + 1);
      else if (entry.isFile() && /^commands.*\.json$/.test(entry.name) && statSync(file).size <= 16 * 1024 * 1024) {
        try { const data = JSON.parse(readFileSync(file, 'utf8')); if (Array.isArray(data)) records.push(...data); } catch { /* Report unavailable, never print raw data. */ }
      }
    }
  };
  try { inspect(directory); return summarizeCommands(records); }
  catch { return { lastCompletedCheckpoint: null, failedCommand: 'unavailable', failedTarget: null }; }
}
