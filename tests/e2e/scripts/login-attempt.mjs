import { completedReport } from './maestro-result.mjs';

// Two phases belong to the same iOS attempt. No login retries, state reset,
// or app relaunch occur between input review and submission.
export async function executeLoginAttempt({ platform, attempt, runFlow, capture, diagnostics, now = Date.now }) {
  let uiMilliseconds = 0;
  const execute = async (phase, reuseDriver) => {
    if (uiMilliseconds >= 360000) return { child: { error: { code: 'ETIMEDOUT' } }, xml: '', completed: false, started: false };
    const started = now();
    const result = await runFlow(phase, { reuseDriver, timeout: Math.max(1, 360000 - uiMilliseconds) });
    uiMilliseconds += now() - started;
    return { ...result, completed: completedReport(result.child, result.xml), started: true };
  };
  let result = await execute(platform === 'ios' ? 'prepare' : 'full', false);
  let inputScreenshot;
  let submitted = platform !== 'ios';
  let inputBlocked = false;
  if (platform === 'ios' && result.completed) {
    inputScreenshot = await capture({ verifyInputs: true, reuseDriver: true });
    inputBlocked = inputScreenshot.status !== 'CAPTURED' || inputScreenshot.inputChecks?.before?.passed !== true || inputScreenshot.inputChecks?.after?.passed !== true;
    if (!inputBlocked) {
      result = await execute('submit', true);
      submitted = result.started;
    }
  }
  const completed = result.completed && !inputBlocked && !result.systemBlocked && !result.systemInterrupted;
  const finding = inputBlocked ? 'Stopped before Sign in: the entered fields or required pre-submission photo could not be verified. No login was submitted.'
    : completed ? 'All real UI assertions completed, including authenticated load after process restart.'
      : result.child.error?.code === 'ETIMEDOUT' ? 'Maestro exceeded the shared six-minute UI budget; no result is accepted.'
        : 'Native UI assertions did not complete. Inspect the fixed diagnostics and private screenshot; raw output is discarded.';
  const outcome = { attempt, status: result.systemBlocked ? 'BLOCKED' : result.systemInterrupted ? 'INTERRUPTED' : completed ? 'PASS' : 'FAIL', durationSeconds: Math.round(uiMilliseconds / 100) / 10, finding: result.systemBlocked ? 'Android system monitoring stopped the flow; recovery was checked before leaving the attempt.' : result.systemInterrupted ? 'System UI recovered after this interrupted attempt. Any restart counts as another login attempt.' : finding };
  if (result.systemBlocked || result.systemInterrupted) outcome.systemDiagnostic = result.systemDiagnostic;
  if (platform === 'ios') outcome.submissionStarted = submitted;
  if (inputScreenshot) outcome.inputScreenshot = inputScreenshot;
  if (!completed) outcome.diagnostics = inputBlocked ? { lastCompletedCheckpoint: 'keyboard-dismissed', failedCommand: 'input-verification', failedTarget: null } : diagnostics();
  // If verification stopped the attempt, its final photo is the same native
  // capture: there has been no further UI action. Do not manufacture another.
  if (inputScreenshot && !submitted) {
    outcome.finalScreenshotIsInput = true;
    outcome.screenshot = inputScreenshot;
  } else outcome.screenshot = await capture({ requireLoaded: completed, reuseDriver: true });
  if (platform === 'android' && result.child.error?.code === 'ETIMEDOUT'
      && outcome.screenshot?.stateBefore?.serverLoaded === true && outcome.screenshot?.stateAfter?.serverLoaded === true) {
    outcome.finding += ' The later screenshot showed loaded leagues, but it does not prove the test completed its restart and session assertions.';
  }
  return outcome;
}
