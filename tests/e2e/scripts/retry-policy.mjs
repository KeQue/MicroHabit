// Each attempt captures its own evidence before returning.
export async function runAttempts(execute) {
  const attempts = [];
  for (let index = 1; index <= 2; index++) {
    const attempt = await execute(index);
    if (!['PASS', 'FAIL', 'BLOCKED', 'INTERRUPTED'].includes(attempt.status)) throw Error('Invalid attempt result');
    attempts.push(attempt);
    if (attempt.status === 'PASS' || attempt.status === 'BLOCKED') break;
  }
  const status = attempts.at(-1).status === 'INTERRUPTED' ? 'BLOCKED' : attempts.at(-1).status;
  return { attempts, status, flaky: attempts.length === 2 && status === 'PASS' };
}
