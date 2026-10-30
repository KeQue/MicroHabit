export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return 'Not available';
  const tenths = Math.round(Math.abs(seconds) * 10);
  const sign = seconds < 0 && tenths ? '-' : '';
  const minutes = Math.floor(tenths / 600);
  const remainder = (tenths % 600) / 10;
  return minutes ? `${sign}${minutes} min ${remainder} sec` : `${sign}${remainder} sec`;
}
