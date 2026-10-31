// Inspect only current WindowManager windows, not historical ANR/logcat output.
// Raw window titles can contain private data; retain fixed categories only.
export function inspectAndroidWindows(result) {
  const blocked = diagnostic => ({ ready: false, diagnostic, category: null });
  if (result.error?.code === 'ETIMEDOUT') return blocked('android-window-query-timeout');
  if (result.error || result.status !== 0) return blocked('android-window-query-failed');
  if (typeof result.stdout !== 'string' || !result.stdout.includes('WINDOW MANAGER WINDOWS') || !/^\s*Window #\d+ Window\{/m.test(result.stdout)) return blocked('android-window-query-unrecognized');
  const errors = [...result.stdout.matchAll(/^\s*Window #\d+ Window\{[^\r\n]*Application (?:Not Responding|Error):[^\r\n]*/gm)].map(match => match[0]);
  if (!errors.length) return { ready: true, diagnostic: null, category: null };
  const category = errors.some(line => line.includes('com.android.systemui')) ? 'system-ui' : errors.some(line => line.includes('com.sadik.microhabit')) ? 'commito' : 'other-process';
  return { ready: false, diagnostic: 'android-error-dialog-present', category };
}

// Only the System UI ANR is eligible; crashes or other application dialogs are not.
export function isSystemUiAnr(result) {
  if (!result || result.error || result.status !== 0 || !inspectAndroidWindows(result).diagnostic?.includes('android-error-dialog-present')) return false;
  const errors = [...result.stdout.matchAll(/^\s*Window #\d+ Window\{[^\r\n]*Application (?:Not Responding|Error):[^\r\n]*/gm)].map(m => m[0]);
  return errors.length === 1 && /Application Not Responding:\s*com\.android\.systemui(?:[}\s]|$)/.test(errors[0]);
}

// Return only coordinates, never hierarchy content. Refuse ambiguous or malformed elements.
export function systemWaitButton(xml, size) {
  if (typeof xml !== 'string' || !Number.isInteger(size?.width) || !Number.isInteger(size?.height)) return null;
  const nodes = xml.match(/<node\b[^>]*\/>/g) || [];
  const candidates = nodes.filter(node => /\bresource-id="android:id\/aerr_wait"/.test(node)
    && /\bpackage="android"/.test(node) && /\btext="Wait"/.test(node)
    && /\bclickable="true"/.test(node) && /\benabled="true"/.test(node));
  if (candidates.length !== 1) return null;
  const m = candidates[0].match(/\bbounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  if (!m) return null;
  const [left, top, right, bottom] = m.slice(1).map(Number);
  if (left >= right || top >= bottom || right > size.width || bottom > size.height) return null;
  return { x: Math.floor((left + right) / 2), y: Math.floor((top + bottom) / 2) };
}

export function displaySize(result) {
  if (result.error || result.status !== 0 || typeof result.stdout !== 'string') return null;
  const matches = [...result.stdout.matchAll(/^(?:Physical|Override) size: (\d+)x(\d+)\s*$/gm)];
  if (!matches.length) return null;
  const width = Number(matches.at(-1)[1]), height = Number(matches.at(-1)[2]);
  return width > 0 && height > 0 && width <= 16384 && height <= 16384 ? { width, height } : null;
}

export function createSystemUiRecovery(adb, sleep = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  const events = [];
  let attempts = 0;
  const query = () => adb(['shell', 'dumpsys', 'window', 'windows']);
  async function recover(initial, phase) {
    if (!isSystemUiAnr(initial)) return { ready: false, diagnostic: 'android-unrecoverable-dialog' };
    if (attempts >= 2) { events.push({ phase, result: 'limit-reached' }); return { ready: false, diagnostic: 'android-recovery-limit' }; }
    attempts++;
    const size = displaySize(await adb(['shell', 'wm', 'size']));
    const hierarchy = await adb(['exec-out', 'uiautomator', 'dump', '/dev/tty']);
    const button = !hierarchy.error && hierarchy.status === 0 ? systemWaitButton(hierarchy.stdout, size) : null;
    if (!button || !isSystemUiAnr(await query())) { events.push({ phase, result: 'wait-unverified' }); return { ready: false, diagnostic: 'android-wait-unverified' }; }
    const tap = await adb(['shell', 'input', 'tap', String(button.x), String(button.y)]);
    if (tap.error || tap.status !== 0) { events.push({ phase, result: 'tap-failed' }); return { ready: false, diagnostic: 'android-wait-failed' }; }
    for (let i = 0; i < 5; i++) {
      await sleep(1000);
      const checked = inspectAndroidWindows(await query());
      if (checked.ready) { events.push({ phase, result: 'recovered' }); return checked; }
      if (checked.diagnostic !== 'android-error-dialog-present' || checked.category !== 'system-ui') break;
    }
    events.push({ phase, result: 'not-confirmed' });
    return { ready: false, diagnostic: 'android-recovery-unconfirmed' };
  }
  return { events, query, recover };
}

// Stop Maestro before touching the dialog. A recovered interruption can restart
// as a new, counted attempt; it is never resumed midway.
export async function monitorAndroidFlow(recovery, execute, sleep = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  const controller = new AbortController();
  let finished = false, interruption = null;
  const process = execute(controller.signal).finally(() => { finished = true; });
  while (!finished) {
    const windows = await recovery.query();
    if (finished) break;
    const status = inspectAndroidWindows(windows);
    if (!status.ready) { interruption = { windows, status }; controller.abort(); break; }
    await Promise.race([process, sleep(2000)]);
  }
  const result = await process;
  if (interruption) {
    if (result.child?.error?.code !== 'EANDROIDBLOCKED') return { ...result, systemBlocked: true, systemDiagnostic: 'android-flow-stop-unconfirmed' };
    const recovered = isSystemUiAnr(interruption.windows) ? await recovery.recover(interruption.windows, 'during-test') : interruption.status;
    return recovered.ready ? { ...result, systemInterrupted: true, systemDiagnostic: 'android-recovered-restart' }
      : { ...result, systemBlocked: true, systemDiagnostic: recovered.diagnostic || 'android-recovery-unconfirmed' };
  }
  const final = await recovery.query();
  const status = inspectAndroidWindows(final);
  if (!status.ready) {
    const recovered = isSystemUiAnr(final) ? await recovery.recover(final, 'after-test') : status;
    return recovered.ready ? result : { ...result, systemBlocked: true, systemDiagnostic: recovered.diagnostic || 'android-recovery-unconfirmed' };
  }
  return result;
}
