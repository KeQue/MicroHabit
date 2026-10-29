// Fixed diagnostics only. Never retain simctl output, stderr or arbitrary names.
export function inspectSimulator(result, selectedDevice) {
  const blocked = (diagnostic, state = null) => ({ ready: false, diagnostic, state, osVersion: null });
  if (result.error?.code === 'ETIMEDOUT') return blocked('simulator-list-timeout');
  if (result.error || result.status !== 0) return blocked('simulator-list-command-failed');
  let data;
  try { data = JSON.parse(result.stdout); } catch { return blocked('simulator-list-invalid-json'); }
  if (!data?.devices || typeof data.devices !== 'object' || Array.isArray(data.devices) || Object.values(data.devices).some(devices => !Array.isArray(devices))) return blocked('simulator-list-invalid-shape');
  const entries = Object.entries(data.devices).flatMap(([runtime, devices]) => devices.map(device => ({ ...device, runtime })));
  const entry = entries.find(device => device.udid === selectedDevice);
  if (!entry) return blocked('selected-simulator-not-listed');
  if (entry.isAvailable !== true) return blocked('selected-simulator-unavailable');
  const states = ['Booted', 'Shutdown', 'Booting', 'Shutting Down', 'Creating'];
  const state = states.includes(entry.state) ? entry.state : 'unknown';
  if (state !== 'Booted') return blocked('selected-simulator-not-booted', state);
  const osVersion = entry.runtime.match(/^com\.apple\.CoreSimulator\.SimRuntime\.iOS-([0-9]+(?:-[0-9]+)*)$/)?.[1]?.replaceAll('-', '.');
  if (!osVersion || osVersion.length > 30) return blocked('selected-simulator-runtime-unknown', state);
  return { ready: true, diagnostic: null, state, osVersion };
}

export function mayRetrySimulatorProbe(result) {
  return ['simulator-list-timeout', 'simulator-list-command-failed'].includes(result.diagnostic) || result.state === 'Booting';
}
