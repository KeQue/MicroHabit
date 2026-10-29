// A successful process alone is insufficient: require one completed case,
// with no skipped/failed/error result, in a fresh per-attempt JUnit file.
export function completedReport(child, xml) {
  return !child.error && child.status === 0
    && /<testsuites?\b/.test(xml) && /<\/testsuites?>/.test(xml)
    && (xml.match(/<testcase\b/g) || []).length === 1
    && !/<(?:failure|error|skipped)\b/.test(xml)
    && !/\b(?:failures|errors|skipped)=["'][1-9][0-9]*["']/.test(xml)
    && !/\btests=["']0["']/.test(xml);
}

// Keep the functional finding separate, while making missing required visual
// evidence block a successful automation job.
export function resultExitCode(report) {
  if (report.status === 'FAIL') return 1;
  return report.status === 'PASS' && report.evidenceStatus === 'COMPLETE' ? 0 : 2;
}
