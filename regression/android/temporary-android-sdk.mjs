import { cpSync, mkdirSync, readdirSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

// Keep the installed SDK untouched; only CMake is copied into this workspace.
export function prepareAndroidSdk(source, destination, ninja) {
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (entry.name === 'cmake') continue;
    const from = join(source, entry.name), to = join(destination, entry.name);
    if (entry.isDirectory()) symlinkSync(from, to, 'junction');
    else if (entry.isFile()) cpSync(from, to);
  }
  const cmake = join(destination, 'cmake', '3.22.1');
  mkdirSync(cmake, { recursive: true });
  cpSync(join(source, 'cmake', '3.22.1'), cmake, { recursive: true });
  cpSync(ninja, join(cmake, 'bin', 'ninja.exe'));
}

export function removeAndroidSdk(destination) {
  for (const entry of readdirSync(destination, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) unlinkSync(join(destination, entry.name));
  }
  rmSync(destination, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
