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
