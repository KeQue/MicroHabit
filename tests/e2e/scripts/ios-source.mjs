// iOS results identify the actual source under test independently of Android.
export function matchesIosSource(requested, actual) {
  return /^[a-f0-9]{40}$/.test(requested || '') && requested === actual;
}
