import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

// QA reports, workflows and instructions do not contribute to the app build.
export function isAppInput(path) {
  return !/^(?:regression\/|tests\/e2e\/|docs\/|\.github\/|AGENTS\.md$)/.test(path);
}
export function fingerprint(entries) {
  const hash = createHash('sha256');
  for (const [name, contents] of [...entries].sort(([a], [b]) => a.localeCompare(b))) {
    const bytes = Buffer.from(contents);
    hash.update(`${Buffer.byteLength(name)}:${name}:${bytes.length}:`);
    hash.update(bytes);
  }
  return hash.digest('hex');
}
export function canReuse(manifest, inputHash, apkHash) {
  return manifest?.version === 1 && /^[a-f0-9]{64}$/.test(inputHash || '') && /^[a-f0-9]{64}$/.test(apkHash || '')
    && manifest.inputHash === inputHash && manifest.apkHash === apkHash;
}
