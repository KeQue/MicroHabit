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
  return isAndroidAnrFor(result, 'com.android.systemui');
}

function isAndroidAnrFor(result, appId) {
  if (!result || result.error || result.status !== 0 || inspectAndroidWindows(result).diagnostic !== 'android-error-dialog-present') return false;
  const errors = [...result.stdout.matchAll(/^\s*Window #\d+ Window\{[^\r\n]*Application Not Responding:\s*([A-Za-z0-9._]+)(?:[}\s]|$)[^\r\n]*/gm)];
  return errors.length === 1 && errors[0][1] === appId;
}

function dialogButton(xml, size, resourceId, text) {
  if (typeof xml !== 'string') return { button: null, diagnostic: 'hierarchy-unavailable' };
  if (!Number.isInteger(size?.width) || !Number.isInteger(size?.height)) return { button: null, diagnostic: 'display-size-unavailable' };
  const nodes = xml.match(/<node\b[^>]*\/?>/g) || [];
  const systemPackage = /(?:^|\s)package="(?:android|com\.android\.systemui)"/;
  const hasLabel = node => new RegExp(`(?:^|\\s)(?:text|content-desc)="${text}"`).test(node);
  let candidates = nodes.filter(node => new RegExp(`(?:^|\\s)resource-id="android:id/${resourceId}"`).test(node)
    && systemPackage.test(node));
  let selector = 'resource-id';
  if (!candidates.length) {
    candidates = nodes.filter(node => hasLabel(node) && systemPackage.test(node));
    selector = 'system-label';
  }
  if (!candidates.length) return { button: null, diagnostic: 'button-not-found' };
  if (candidates.length !== 1) return { button: null, diagnostic: 'button-ambiguous' };
  const node = candidates[0];
  if (!hasLabel(node) || !/(?:^|\s)clickable="true"/.test(node) || !/(?:^|\s)enabled="true"/.test(node)) {
    return { button: null, diagnostic: 'button-not-actionable', selector };
  }
  const m = node.match(/(?:^|\s)bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  if (!m) return { button: null, diagnostic: 'button-bounds-unavailable', selector };
  const [left, top, right, bottom] = m.slice(1).map(Number);
  if (left >= right || top >= bottom || right > size.width || bottom > size.height) return { button: null, diagnostic: 'button-bounds-invalid', selector };
  return { button: { x: Math.floor((left + right) / 2), y: Math.floor((top + bottom) / 2) }, diagnostic: null, selector };
}

// Return only coordinates, never hierarchy content. Refuse ambiguous or malformed elements.
export function systemWaitButton(xml, size) {
  return dialogButton(xml, size, 'aerr_wait', 'Wait').button;
}

export function systemCloseButton(xml, size) {
  return dialogButton(xml, size, 'aerr_close', 'Close app').button;
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
    const started = Date.now();
    const record = (result, action = null, diagnostic = null, hierarchyReads = null, selector = null) => events.push({
      phase, result, ...(action ? { action } : {}), ...(diagnostic ? { diagnostic } : {}),
      ...(hierarchyReads ? { hierarchyReads } : {}),
      ...(selector ? { selector } : {}),
      durationSeconds: Math.round((Date.now() - started) / 100) / 10,
    });
    const systemUiAnr = isSystemUiAnr(initial);
    if (!systemUiAnr) return { ready: false, diagnostic: 'android-unrecoverable-dialog' };
    if (attempts >= 2) { record('limit-reached'); return { ready: false, diagnostic: 'android-recovery-limit' }; }
    attempts++;
    let hierarchyReads = 0;
    const readButtons = async () => {
      hierarchyReads++;
      const [sizeResult, hierarchy] = await Promise.all([
        adb(['shell', 'wm', 'size']),
        adb(['exec-out', 'uiautomator', 'dump', '/dev/tty']),
      ]);
      if (hierarchy.error || hierarchy.status !== 0) return { selected: null, diagnostic: 'hierarchy-query-failed' };
      const size = displaySize(sizeResult);
      const wait = dialogButton(hierarchy.stdout, size, 'aerr_wait', 'Wait');
      const close = dialogButton(hierarchy.stdout, size, 'aerr_close', 'Close app');
      const selected = wait.button ? { ...wait, action: 'wait' }
        : close.button ? { ...close, action: 'close-app' } : null;
      return { selected, diagnostic: `wait-${wait.diagnostic}; close-${close.diagnostic}` };
    };
    let { selected, diagnostic } = await readButtons();
    if (!selected) {
      if (!isSystemUiAnr(await query())) {
        record('dialog-changed', null, 'android-dialog-changed-before-retry', hierarchyReads);
        return { ready: false, diagnostic: 'android-dialog-changed-before-retry' };
      }
      await sleep(500);
      ({ selected, diagnostic } = await readButtons());
    }
    if (!selected) {
      record('buttons-unverified', null, diagnostic, hierarchyReads);
      return { ready: false, diagnostic: 'android-recovery-buttons-unverified' };
    }
    if (!isSystemUiAnr(await query())) {
      record('dialog-changed', selected.action, 'android-dialog-changed-before-tap', hierarchyReads, selected.selector);
      return { ready: false, diagnostic: 'android-dialog-changed-before-tap' };
    }
    const button = selected.button;
    const tap = await adb(['shell', 'input', 'tap', String(button.x), String(button.y)]);
    if (tap.error || tap.status !== 0) {
      record('tap-failed', selected.action, null, hierarchyReads, selected.selector);
      return { ready: false, diagnostic: `android-${selected.action}-failed` };
    }
    for (let i = 0; i < 5; i++) {
      await sleep(1000);
      const checked = inspectAndroidWindows(await query());
      if (checked.ready) {
        if (selected.action === 'close-app') {
          const systemUi = await adb(['shell', 'pidof', 'com.android.systemui']);
          if (systemUi.error || systemUi.status !== 0 || !systemUi.stdout?.trim()) continue;
        }
        record('recovered', selected.action, null, hierarchyReads, selected.selector);
        return checked;
      }
      if (checked.diagnostic !== 'android-error-dialog-present' || checked.category !== 'system-ui') break;
    }
    record('not-confirmed', selected.action, null, hierarchyReads, selected.selector);
    return { ready: false, diagnostic: selected.action === 'close-app' ? 'android-close-app-unconfirmed' : 'android-recovery-unconfirmed' };
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
    if (status.diagnostic === 'android-error-dialog-present') { interruption = { windows, status }; controller.abort(); break; }
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
    if (status.diagnostic !== 'android-error-dialog-present') {
      return { ...result, systemVerificationUnavailable: true, systemDiagnostic: status.diagnostic };
    }
    const recovered = isSystemUiAnr(final) ? await recovery.recover(final, 'after-test') : status;
    return recovered.ready ? result : { ...result, systemBlocked: true, systemDiagnostic: recovered.diagnostic || 'android-recovery-unconfirmed' };
  }
  return result;
}
