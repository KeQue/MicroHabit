import test from 'node:test';
import assert from 'node:assert/strict';
import { createReminderController, REMINDER_KIND, TEST_KIND } from './reminder-controller.ts';

function fixture() {
  const native = { schedules: [], prompts: [], timezone: 'Europe/Berlin', permitted: true, stored: null, calls: 0, fail: null, hold: null };
  const ports = {
    read: async () => { if (native.fail === 'read') throw Error('storage'); return native.stored; },
    write: async (value) => { if (native.fail === 'write') throw Error('storage'); native.stored = value; },
    permission: async (request) => { native.prompts.push(request); if (native.fail === 'permission') throw Error('permission'); return native.permitted; },
    list: async () => [...native.schedules],
    cancel: async (id) => { if (native.fail === 'cancel') throw Error('cancel'); native.schedules = native.schedules.filter(item => item.identifier !== id); },
    schedule: async (prefs, tz) => {
      native.calls++;
      if (native.hold) await native.hold;
      if (native.fail === 'schedule') throw Error('schedule');
      const identifier = `daily-${native.calls}`;
      native.schedules.push({ identifier, content: { data: { kind: REMINDER_KIND, signature: `${prefs.hour}:${prefs.minute}:${tz}` } } });
      return identifier;
    },
    test: async () => { native.schedules.push({ identifier: 'test', content: { data: { kind: TEST_KIND } } }); },
    timezone: () => native.timezone,
  };
  return { native, controller: createReminderController(ports) };
}
test('concurrent foreground refreshes leave one daily schedule and never prompt', async () => {
  const { native, controller } = fixture();
  await controller.setAccount('A');
  await Promise.all(Array.from({ length: 8 }, () => controller.refresh()));
  assert.equal(native.schedules.length, 1);
  assert.equal(native.calls, 1);
  assert.ok(native.prompts.every(value => value === false));
});
test('legacy duplicates are replaced, unrelated notifications are preserved', async () => {
  const { native, controller } = fixture();
  native.schedules.push(...['legacy-1', 'legacy-2'].map(identifier => ({ identifier, content: { data: { kind: REMINDER_KIND } } })), { identifier: 'unrelated', content: { data: {} } });
  await controller.setAccount('A');
  assert.equal(native.schedules.length, 2);
  assert.equal(native.schedules[0].identifier, 'unrelated');
});
test('time and timezone changes replace the schedule; disabled preference survives accounts', async () => {
  const { native, controller } = fixture();
  await controller.setAccount('A');
  await controller.save({ enabled: true, hour: 8, minute: 45 });
  assert.equal(native.schedules[0].content.data.signature, '8:45:Europe/Berlin');
  native.timezone = 'America/New_York';
  await controller.refresh();
  assert.equal(native.schedules[0].content.data.signature, '8:45:America/New_York');
  await controller.save({ enabled: false, hour: 8, minute: 45 });
  await controller.setAccount(null);
  await controller.setAccount('B');
  assert.equal(native.schedules.length, 0);
  assert.equal(controller.getState().preferences.enabled, false);
});
test('permission denial never prompts on launch; explicit save may request permission', async () => {
  const { native, controller } = fixture();
  native.permitted = false;
  await controller.setAccount('A');
  await controller.refresh();
  assert.deepEqual(native.prompts, [false, false]);
  assert.equal(native.schedules.length, 0);
  await controller.save({ enabled: true, hour: 9, minute: 0 });
  assert.equal(native.prompts.at(-1), true);
  assert.equal(controller.getState().permission, 'denied');
});
test('native scheduling failures resolve safely and retry on foreground', async () => {
  const { native, controller } = fixture();
  native.fail = 'schedule';
  await controller.setAccount('A');
  assert.ok(controller.getState().error);
  assert.equal(controller.getState().scheduled, false);
  native.fail = null;
  await controller.refresh();
  assert.equal(native.schedules.length, 1);
  assert.equal(controller.getState().error, null);
});
test('failed preference persistence leaves the existing preference and schedule intact', async () => {
  const { native, controller } = fixture();
  await controller.setAccount('A');
  native.fail = 'write';
  await controller.save({ enabled: false, hour: 9, minute: 0 });
  assert.equal(controller.getState().preferences.enabled, true);
  assert.equal(native.schedules.length, 1);
  assert.ok(controller.getState().error);
});
test('sign-out wins an in-flight native schedule and clears test schedules', async () => {
  const { native, controller } = fixture();
  let release;
  native.hold = new Promise(resolve => { release = resolve; });
  const signin = controller.setAccount('A');
  while (native.calls === 0) await new Promise(resolve => setImmediate(resolve));
  const signout = controller.setAccount(null);
  release();
  await Promise.all([signin, signout]);
  assert.equal(native.schedules.length, 0);
  assert.equal(controller.getState().scheduled, false);
  assert.equal(await controller.test(), false);
});
test('account switching invalidates queued saves from previous account', async () => {
  const { native, controller } = fixture();
  await controller.setAccount('A');
  const staleSave = controller.save({ enabled: false, hour: 1, minute: 0 });
  const switchAccount = controller.setAccount('B');
  await Promise.all([staleSave, switchAccount]);
  assert.equal(controller.getState().preferences.hour, 17);
  assert.equal(native.schedules.length, 1);
});
test('corrupt/read-failing storage and permission errors fail closed without rejection', async () => {
  for (const fail of ['read', 'permission', 'corrupt']) {
    const { native, controller } = fixture();
    if (fail === 'corrupt') native.stored = '{ broken'; else native.fail = fail;
    await controller.setAccount('A');
    assert.ok(controller.getState().error);
    assert.equal(native.schedules.length, 0);
    await controller.setAccount(null);
    assert.equal(native.schedules.length, 0);
  }
});
test('cancel failure does not schedule a second reminder and can be retried', async () => {
  const { native, controller } = fixture();
  await controller.setAccount('A');
  native.fail = 'cancel';
  await controller.save({ enabled: true, hour: 11, minute: 0 });
  assert.equal(native.schedules.length, 1);
  assert.equal(native.calls, 1);
  assert.ok(controller.getState().error);
  native.fail = null;
  await controller.refresh();
  assert.equal(native.schedules.length, 1);
  assert.equal(native.schedules[0].content.data.signature, '11:0:Europe/Berlin');
});
test('test requests are deduplicated and sign-out removes pending tests', async () => {
  const { native, controller } = fixture();
  await controller.setAccount('A');
  assert.equal(await controller.test(), true);
  assert.equal(await controller.test(), true);
  assert.equal(native.schedules.filter(item => item.content.data.kind === TEST_KIND).length, 1);
  await controller.setAccount(null);
  assert.equal(native.schedules.length, 0);
});
test('invalid hours and minutes never persist or alter the schedule', async () => {
  const { native, controller } = fixture();
  await controller.setAccount('A');
  for (const [hour, minute] of [[24, 0], [-1, 0], [8, 60], [8, -1], [1.5, 2]]) {
    await controller.save({ enabled: true, hour, minute });
    assert.equal(native.stored, null);
    assert.equal(native.calls, 1);
    assert.ok(controller.getState().error);
  }
});
test('explicit valid save can recover corrupted local preferences', async () => {
  const { native, controller } = fixture();
  native.stored = '{ broken';
  await controller.setAccount('A');
  assert.ok(controller.getState().error);
  await controller.save({ enabled: false, hour: 9, minute: 0 });
  assert.equal(controller.getState().error, null);
  assert.equal(JSON.parse(native.stored).hour, 9);
  assert.equal(native.schedules.length, 0);
});
test('same-account token refreshes do not churn schedules; initial signout cancels old installation reminders', async () => {
  const { native, controller } = fixture();
  native.schedules.push({ identifier: 'old-install', content: { data: { kind: REMINDER_KIND } } });
  await controller.setAccount(null);
  assert.equal(native.schedules.length, 0);
  await controller.setAccount('A');
  const calls = native.calls;
  await controller.setAccount('A');
  await controller.setAccount('A');
  assert.equal(native.calls, calls);
  assert.equal(native.schedules.length, 1);
});
