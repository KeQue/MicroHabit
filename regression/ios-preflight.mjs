// Validate the saved Android evidence before attesting it to the iOS workflow.
export function validateAndroidReport(report, revision) {
  if (!/^[a-f0-9]{40}$/.test(revision || '') || report.sourceRevision !== revision) return 'Android must pass on the current committed revision.';
  if (report.platform !== 'android' || report.backendEnvironment !== 'production' || report.backendHost !== 'nzpnfrutomyuvrprkrwi.supabase.co') return 'Android evidence is for a different platform or backend.';
  if (report.status !== 'PASS' || report.evidenceStatus !== 'COMPLETE' || !Array.isArray(report.attempts) || !report.attempts.length) return 'Android needs a pass with complete screenshots.';
  if (report.attempts.at(-1).status !== 'PASS' || report.attempts.some(a => !['PASS', 'FAIL'].includes(a.status) || a.screenshot?.status !== 'CAPTURED')) return 'Android attempt evidence is incomplete.';
  const image = report.attempts.at(-1).screenshot;
  if (!image.stateBefore?.serverLoaded || !image.stateAfter?.serverLoaded) return 'Android authenticated screenshot checks are incomplete.';
  return null;
}
