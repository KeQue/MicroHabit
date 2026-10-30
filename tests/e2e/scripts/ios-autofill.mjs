import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function configurePasswordAutofill(device, home, { run = spawnSync, exists = existsSync, isLink = path => lstatSync(path).isSymbolicLink() } = {}) {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(device || '') || !home) return { configured: false, diagnostic: 'autofill-invalid-device' };
  const data = join(home, 'Library/Developer/CoreSimulator/Devices', device, 'data');
  const paths = [
    join(data, 'Library/UserConfigurationProfiles/EffectiveUserSettings.plist'),
    join(data, 'Containers/Shared/SystemGroup/systemgroup.com.apple.configurationprofiles/Library/ConfigurationProfiles/UserSettings.plist'),
  ];
  try {
    if (!paths.every(path => exists(path) && !isLink(path))) return { configured: false, diagnostic: 'autofill-settings-unavailable' };
    for (const path of paths) {
      const changed = run('/usr/bin/plutil', ['-replace', 'restrictedBool.allowPasswordAutoFill.value', '-bool', 'NO', path], { encoding: 'utf8', timeout: 20000 });
      if (changed.error || changed.status !== 0) return { configured: false, diagnostic: 'autofill-setting-failed' };
      const readback = run('/usr/bin/plutil', ['-extract', 'restrictedBool.allowPasswordAutoFill.value', 'raw', '-expect', 'bool', path], { encoding: 'utf8', timeout: 20000 });
      if (readback.error || readback.status !== 0 || readback.stdout?.trim() !== 'false') return { configured: false, diagnostic: 'autofill-readback-failed' };
    }
    return { configured: true, diagnostic: null };
  } catch { return { configured: false, diagnostic: 'autofill-settings-unavailable' }; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.platform !== 'darwin') { console.error('Simulator settings require macOS.'); process.exitCode = 2; }
  else {
    const result = configurePasswordAutofill(process.argv[2], process.env.HOME);
    console.log(JSON.stringify(result));
    process.exitCode = result.configured ? 0 : 2;
  }
}
