const phases = new Set([
  'configuration', 'expo-prebuild', 'cocoapods-install', 'xcode-compilation',
  'simulator-startup', 'simulator-configuration', 'app-installation',
  'simulator-readiness', 'complete',
]);

export function summarizeIosBuildMetrics(phaseText, cacheText, cacheReset) {
  const phaseDurationsSeconds = {};
  if (typeof phaseText === 'string') {
    for (const line of phaseText.split(/\r?\n/)) {
      const match = /^([a-z-]+)\t(\d{1,5})$/.exec(line);
      if (!match || !phases.has(match[1])) continue;
      const seconds = Number(match[2]);
      if (seconds <= 7200 && phaseDurationsSeconds[match[1]] === undefined) phaseDurationsSeconds[match[1]] = seconds;
    }
  }
  const phaseTimingsStatus = Object.keys(phaseDurationsSeconds).length ? 'available' : 'unavailable';
  let compilerCache = { status: 'unavailable' };
  if (cacheReset === 'reset' && typeof cacheText === 'string') {
    const hits = /^  Hits:\s*(\d+)\s*\/\s*(\d+)\b/m.exec(cacheText);
    const misses = /^  Misses:\s*(\d+)\s*\/\s*(\d+)\b/m.exec(cacheText);
    if (hits && misses) {
      const hitCount = Number(hits[1]), cacheableCalls = Number(hits[2]), missCount = Number(misses[1]);
      const missCalls = Number(misses[2]);
      if (hitCount + missCount === cacheableCalls && missCalls === cacheableCalls
          && [hitCount, missCount, cacheableCalls].every(value => Number.isSafeInteger(value) && value <= 100000000)) {
        compilerCache = { status: 'available', cacheableCalls, hits: hitCount, misses: missCount };
      }
    }
  }
  return { phaseTimingsStatus, phaseDurationsSeconds, compilerCache };
}

export function matchingIosBuildMetrics(summary, sourceRevision) {
  if (!summary || summary.kind !== 'ios-build' || !/^[a-f0-9]{40}$/.test(sourceRevision || '')
      || summary.sourceRevision !== sourceRevision || !summary.metrics
      || !['available', 'unavailable'].includes(summary.metrics.phaseTimingsStatus)
      || !summary.metrics.phaseDurationsSeconds || typeof summary.metrics.phaseDurationsSeconds !== 'object'
      || Array.isArray(summary.metrics.phaseDurationsSeconds)) return null;
  const phaseDurationsSeconds = {};
  for (const [phase, seconds] of Object.entries(summary.metrics.phaseDurationsSeconds)) {
    if (phases.has(phase) && Number.isInteger(seconds) && seconds >= 0 && seconds <= 7200) phaseDurationsSeconds[phase] = seconds;
  }
  const rawCache = summary.metrics.compilerCache;
  const compilerCache = rawCache?.status === 'available'
    && Number.isSafeInteger(rawCache.cacheableCalls) && rawCache.cacheableCalls >= 0 && rawCache.cacheableCalls <= 100000000
    && Number.isSafeInteger(rawCache.hits) && rawCache.hits >= 0
    && Number.isSafeInteger(rawCache.misses) && rawCache.misses >= 0
    && rawCache.hits + rawCache.misses === rawCache.cacheableCalls
    ? { status: 'available', cacheableCalls: rawCache.cacheableCalls, hits: rawCache.hits, misses: rawCache.misses }
    : { status: 'unavailable' };
  return {
    phaseTimingsStatus: summary.metrics.phaseTimingsStatus,
    phaseDurationsSeconds,
    compilerCache,
  };
}
