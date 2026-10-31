// Extract only fixed classifications and lengths; native output can contain secrets.
export function nativePathFailures(log, cache, project) {
  const normalized = value => value.replaceAll('\\', '/').toLowerCase().replace(/\/+$/, '');
  const roots = [['gradle-cache', normalized(cache)], ['project', normalized(project)]];
  const findings = [];
  for (const match of log.matchAll(/ninja:\s*error:\s*Stat\(([^\r\n]*?)\):\s*Filename longer than 260 characters/gi)) {
    const name = normalized(match[1]);
    const location = roots.find(([, root]) => root && (name === root || name.startsWith(root + '/')))?.[0] || 'other-or-relative';
    findings.push({ location, length: match[1].length });
  }
  return findings;
}
