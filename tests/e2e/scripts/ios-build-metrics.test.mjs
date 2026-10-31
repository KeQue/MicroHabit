import assert from 'node:assert/strict';
import test from 'node:test';
import { matchingIosBuildMetrics, summarizeIosBuildMetrics } from './ios-build-metrics.mjs';

const sourceRevision = 'a'.repeat(40);

test('iOS build metrics retain only allowlisted phase durations and cache counters', () => {
  const metrics = summarizeIosBuildMetrics(
    'expo-prebuild\t12\nxcode-compilation\t645\nprivate-phase\t30\nxcode-compilation\t3\ncomplete\t0\n',
    'Cacheable calls: 5 / 8 (62.50%)\n  Hits: 3 / 5 (60.00%)\n    Direct: 2 / 3\n    Preprocessed: 1 / 3\n  Misses: 2 / 5 (40.00%)\nLocal storage:\n  Hits: 10\n',
    'reset',
  );
  assert.deepEqual(metrics, {
    phaseTimingsStatus: 'available',
    phaseDurationsSeconds: { 'expo-prebuild': 12, 'xcode-compilation': 645, complete: 0 },
    compilerCache: { status: 'available', cacheableCalls: 5, hits: 3, misses: 2 },
  });
  assert.ok(!JSON.stringify(metrics).includes('private-phase'));
});

test('unavailable or inconsistent ccache stats never become fabricated hit counts', () => {
  assert.deepEqual(summarizeIosBuildMetrics('', 'Hits: 99 / 100\nMisses: 1 / 100\n', 'not-reset').compilerCache, { status: 'unavailable' });
  assert.deepEqual(summarizeIosBuildMetrics('', '  Hits: 3 / 5\n  Misses: 1 / 5\n', 'reset').compilerCache, { status: 'unavailable' });
  assert.deepEqual(summarizeIosBuildMetrics('unknown\t9\n', '', 'reset'), {
    phaseTimingsStatus: 'unavailable', phaseDurationsSeconds: {}, compilerCache: { status: 'unavailable' },
  });
});

test('build metrics are attached only to their exact validated source revision', () => {
  const summary = {
    kind: 'ios-build',
    sourceRevision,
    metrics: summarizeIosBuildMetrics('xcode-compilation\t645\n', '  Hits: 3 / 5\n  Misses: 2 / 5\n', 'reset'),
  };
  assert.deepEqual(matchingIosBuildMetrics(summary, sourceRevision), summary.metrics);
  assert.equal(matchingIosBuildMetrics(summary, 'b'.repeat(40)), null);
  assert.equal(matchingIosBuildMetrics({ ...summary, metrics: { ...summary.metrics, phaseDurationsSeconds: { private: 1 } } }, sourceRevision).phaseDurationsSeconds.private, undefined);
});
