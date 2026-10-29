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
