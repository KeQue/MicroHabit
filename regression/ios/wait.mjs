export function dispatchedRunId(result) {
  const id = String(result?.workflow_run_id || '');
  return /^\d{8,15}$/.test(id) ? id : null;
}

export async function waitForRun(request, runId, { now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), timeout = 125 * 60 * 1000 } = {}) {
  const deadline = now() + timeout;
  while (now() < deadline) {
    const run = await request(`/actions/runs/${runId}`);
    if (run.status === 'completed') return { conclusion: run.conclusion, attempt: run.run_attempt };
    await sleep(20000);
  }
  return null;
}
