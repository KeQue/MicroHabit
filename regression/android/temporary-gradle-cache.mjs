import { cpSync, existsSync, lstatSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// Reuse downloaded artifacts, but regenerate transforms so they contain paths
// into the physical temporary cache rather than paths from the previous build.
export function seedGradleCache(source, destination) {
  for (const relative of ['caches/modules-2', 'wrapper/dists']) {
    const from = join(source, relative);
    if (!existsSync(from)) continue;
    const to = join(destination, relative);
    mkdirSync(to, { recursive: true });
    cpSync(from, to, {
      recursive: true,
      filter: path => !/\.lock$/i.test(path) && !lstatSync(path).isSymbolicLink(),
    });
  }
}
