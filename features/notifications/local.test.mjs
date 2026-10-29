import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as controller from './reminder-controller.ts';

function adapter(os, initialPermission = false) {
  const native = { scheduled: [], channels: [], requests: 0, checks: 0, permitted: initialPermission, canAskAgain: true, sequence: 0 };
  const notifications = {
    SchedulableTriggerInputTypes: { CALENDAR: 'calendar', DAILY: 'daily', TIME_INTERVAL: 'timeInterval' },
    AndroidImportance: { DEFAULT: 3 },
    setNotificationHandler() {},
    async setNotificationChannelAsync(id, settings) { native.channels.push([id, settings]); },
    async getPermissionsAsync() { native.checks++; return { granted: native.permitted, canAskAgain: native.canAskAgain }; },
    async requestPermissionsAsync() { native.requests++; return { granted: native.permitted }; },
    async getAllScheduledNotificationsAsync() { return [...native.scheduled]; },
    async cancelScheduledNotificationAsync(id) { native.scheduled = native.scheduled.filter(item => item.identifier !== id); },
    async scheduleNotificationAsync(request) {
      const identifier = String(++native.sequence);
      native.scheduled.push({ ...request, identifier }); return identifier;
    },
  };
  let value = null;
  const dependencies = {
    '@react-native-async-storage/async-storage': { getItem: async () => value, setItem: async (_key, next) => { value = next; } },
    'expo-notifications': notifications,
    'react-native': { Platform: { OS: os } },
    './copy': { getGentleNotificationCopy: () => 'Synthetic reminder text' },
    './reminder-controller': controller,
  };
  const source = readFileSync(new URL('./local.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`); return dependencies[name];
  }, Intl, Date });
  return { native, api: exports };
}
test('actual iOS adapter schedules a repeating local calendar and no foreground prompt', async () => {
  const { native, api } = adapter('ios', true);
  await api.setReminderAccount('A');
  await api.saveReminderPreferences({ enabled: true, hour: 7, minute: 35 });
  assert.deepEqual(JSON.parse(JSON.stringify(native.scheduled[0].trigger)), { type: 'calendar', hour: 7, minute: 35, repeats: true });
  assert.equal(native.scheduled.length, 1);
  assert.equal(native.requests, 0);
  await api.refreshGentleDailyReminder();
  assert.equal(native.scheduled.length, 1);
});
test('actual Android adapter uses DAILY with a configured channel', async () => {
  const { native, api } = adapter('android', true);
  await api.setReminderAccount('A');
  assert.equal(native.scheduled[0].trigger.type, 'daily');
  assert.equal(native.scheduled[0].trigger.channelId, 'gentle-reminders');
  assert.equal(native.channels[0][0], 'gentle-reminders');
});
test('native permission request is explicit and respects canAskAgain false', async () => {
  const { native, api } = adapter('ios');
  await api.setReminderAccount('A');
  await api.refreshGentleDailyReminder();
  assert.equal(native.requests, 0);
  await api.saveReminderPreferences({ enabled: true, hour: 17, minute: 0 });
  assert.equal(native.requests, 1);
  native.canAskAgain = false;
  await api.saveReminderPreferences({ enabled: true, hour: 17, minute: 0 });
  assert.equal(native.requests, 1);
  assert.equal(native.scheduled.length, 0);
});
test('web adapter never accesses native permissions or schedules', async () => {
  const { native, api } = adapter('web');
  await api.setReminderAccount('A');
  await api.refreshGentleDailyReminder();
  assert.equal(await api.scheduleGentleTestNotification(), false);
  assert.equal(native.checks, 0);
  assert.equal(native.scheduled.length, 0);
});
