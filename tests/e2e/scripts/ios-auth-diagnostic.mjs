import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Applied only inside the disposable GitHub iOS build checkout. All edits are
// validated before writing; the application source in Git is not modified.
const moduleText = `type Operation = "storage-get" | "storage-set" | "storage-remove" | "auth-call" | "auth-response" | "auth-listener" | "profile-upsert";
let failure: Operation | "unknown" = "unknown";
export function resetAuthDiagnostic() { failure = "unknown"; }
export function authDiagnostic() { return failure; }
export function markAuthFailure(op: Operation) { if (failure === "unknown") failure = op; }
export async function traceAuth<T>(op: Operation, run: () => Promise<T>): Promise<T> {
  try { return await run(); } catch (error) { markAuthFailure(op); throw error; }
}
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> };
export function diagnosticStorage(storage: Storage): Storage {
  return { ...storage,
    getItem: (key: string) => traceAuth("storage-get", () => storage.getItem(key)),
    setItem: (key: string, value: string) => traceAuth("storage-set", () => storage.setItem(key, value)),
    removeItem: (key: string) => traceAuth("storage-remove", () => storage.removeItem(key)),
  };
}
`;
function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw Error('Diagnostic source does not match reviewed code');
  return source.replace(before, after);
}
export function patchIosDiagnostic(root, { fullScreenshot = false } = {}) {
  const files = ['lib/supabase.ts', 'features/auth/useAuth.tsx', 'app/(auth)/sign-in.tsx', ...(fullScreenshot ? ['tests/e2e/scripts/run.mjs', 'tests/e2e/scripts/report.mjs'] : [])];
  const output = new Map(files.map(path => [path, readFileSync(join(root, path), 'utf8').replaceAll('\r\n', '\n')]));
  if (existsSync(join(root, 'lib/ios-diagnostic.ts'))) throw Error('Diagnostic module already exists');
  const change = (path, before, after) => output.set(path, replaceOnce(output.get(path), before, after));
  change(files[0], 'import { createSessionStorage } from "./session-storage";', 'import { createSessionStorage } from "./session-storage";\nimport { diagnosticStorage } from "./ios-diagnostic";');
  change(files[0], '    storage: authStorage,', '    storage: diagnosticStorage(authStorage),');
  change(files[1], 'import { supabase } from "../../lib/supabase";', 'import { supabase } from "../../lib/supabase";\nimport { markAuthFailure, resetAuthDiagnostic, traceAuth } from "../../lib/ios-diagnostic";');
  change(files[1], '    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {', '    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {\n      try {');
  change(files[1], '      setInitializing(false);\n    });', '      setInitializing(false);\n      } catch (error) { markAuthFailure("auth-listener"); throw error; }\n    });');
  const oldSignIn = `  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(normalizeAuthErrorMessage(error.message));
    if (data.user) {
      await ensureProfileForUser(data.user);
    }
  }`;
  const newSignIn = `  async function signIn(email: string, password: string) {
    resetAuthDiagnostic();
    const { data, error } = await traceAuth("auth-call", () => supabase.auth.signInWithPassword({ email, password }));
    if (error) { markAuthFailure("auth-response"); throw new Error(normalizeAuthErrorMessage(error.message)); }
    if (data.user) {
      await traceAuth("profile-upsert", () => ensureProfileForUser(data.user));
    }
  }`;
  change(files[1], oldSignIn, newSignIn);
  change(files[2], 'import { useAuth } from "../../features/auth/useAuth";', 'import { useAuth } from "../../features/auth/useAuth";\nimport { authDiagnostic } from "../../lib/ios-diagnostic";');
  change(files[2], '  const [error, setError] = useState<string | null>(null);', '  const [error, setError] = useState<string | null>(null);\n  const [diagnostic, setDiagnostic] = useState("unknown");');
  change(files[2], '{error ? <Text testID="e2e-auth-error" style={styles.error}>{error}</Text> : null}', '{error ? <Text testID="e2e-auth-error" accessibilityLabel={`commito-diagnostic:${diagnostic}`} style={styles.error}>{error}</Text> : null}');
  change(files[2], '                  setError(e?.message ?? "Sign-in failed");', '                  setDiagnostic(authDiagnostic());\n                  setError(e?.message ?? "Sign-in failed");');
  if (fullScreenshot) {
    change(files[3], '    const redacted = redactScreenshot(readFileSync(raw), [before, after], [env.MAESTRO_E2E_PASSWORD], { showLoginInputs: true, appId: metadata.appId });', '    const redacted = { png: readFileSync(raw), redactions: 0 };');
    change(files[3], "privacyPolicy: 'visible-email-native-password-mask-v1'", "privacyPolicy: 'private-full-screen-v1'");
    change(files[4], "      if (screenshot.privacyPolicy === 'visible-email-native-password-mask-v1')", "      if (screenshot.privacyPolicy === 'private-full-screen-v1') picture += '<p>This is the full native screenshot without masks. Keep it private; any keyboard or account details visible on the device are included.</p>';\n      if (screenshot.privacyPolicy === 'visible-email-native-password-mask-v1')");
    change(files[4], 'Keep this report private. Redaction preserves the remaining native screenshot pixels; it does not recreate the app.', 'Keep this report private. Native screenshots are not redacted in this explicitly approved run.');
  }
  for (const [path, source] of output) writeFileSync(join(root, path), source);
  writeFileSync(join(root, 'lib/ios-diagnostic.ts'), moduleText, { flag: 'wx' });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { patchIosDiagnostic(process.cwd(), { fullScreenshot: process.env.E2E_IOS_FULL_SCREENSHOT === 'yes' }); console.log('iOS-only fixed-category login diagnostics enabled.'); }
  catch { console.error('BLOCKED: reviewed iOS diagnostic patch did not apply.'); process.exitCode = 2; }
}
