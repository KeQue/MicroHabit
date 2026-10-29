import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the actual component handlers with deterministic hooks/native elements.
// This checks input and async lifecycle logic, not iPhone layout or delivery.
function harness() {
  let cursor = 0;
  let tree;
  let visible = true;
  let state = { preferences: { enabled: true, hour: 17, minute: 0 }, permission: 'granted', scheduled: true, error: null };
  const slots = [];
  const effects = [];
  const saves = [];
  let dismissed = 0;
  let closed = 0;
  const react = {
    useSyncExternalStore: () => state,
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [slots[i], next => { slots[i] = next; }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!slots[i] || slots[i].deps.some((value, index) => value !== deps[index])) {
        const old = slots[i];
        slots[i] = { deps };
        effects.push(() => { old?.cleanup?.(); slots[i].cleanup = effect(); });
      }
    },
  };
  const native = Object.fromEntries(['KeyboardAvoidingView', 'Modal', 'Pressable', 'ScrollView', 'Switch', 'Text', 'TextInput', 'View'].map(name => [name, name]));
  native.StyleSheet = { create: value => value, hairlineWidth: 1, absoluteFill: {} };
  native.Platform = { OS: 'ios' };
  native.Keyboard = { dismiss() { dismissed++; } };
  native.Linking = { openSettings: async () => undefined };
  const jsx = (type, props) => ({ type, props });
  const dependencies = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': native,
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    '../features/notifications/local': {
      getReminderState: () => state, subscribeReminderState() {},
      refreshGentleDailyReminder: async () => state,
      saveReminderPreferences: preferences => new Promise(resolve => saves.push({ preferences, resolve })),
    },
  };
  const source = ts.transpileModule(readFileSync(new URL('../../components/ReminderSettings.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: name => {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name];
  } });
  const nodes = (node) => !node || typeof node !== 'object' ? [] : [node, ...[].concat(node.props?.children ?? []).flatMap(nodes)];
  const render = () => {
    cursor = 0;
    tree = exports.ReminderSettings({ visible, onClose() { closed++; } });
    while (effects.length) effects.shift()();
    return tree;
  };
  render();
  return {
    saves,
    get dismissed() { return dismissed; },
    get closed() { return closed; },
    escape: () => nodes(tree).find(node => node.props?.onAccessibilityEscape).props.onAccessibilityEscape(),
    node: label => nodes(tree).find(node => node.props?.accessibilityLabel === label),
    save: () => nodes(tree).find(node => node.type === 'Pressable' && node.props?.children?.props?.children === 'Save').props.onPress(),
    text: () => nodes(tree).filter(node => node.type === 'Text').map(node => node.props.children).join(' '),
    async flush() { await new Promise(resolve => setImmediate(resolve)); render(); },
    render,
    close() { visible = false; render(); }, open() { visible = true; render(); },
    setState(next) { state = next; },
  };
}
test('reminder editor validates actual input and exposes keyboard dismissal', async () => {
  const app = harness();
  await app.flush();
  app.node('Reminder hour, 00 to 23').props.onChangeText('24');
  app.render(); app.save(); await app.flush();
  assert.equal(app.saves.length, 0);
  assert.match(app.text(), /00:00 to 23:59/);
  app.node('Done editing reminder time').props.onPress();
  assert.equal(app.dismissed, 1);
});
test('actual editor never claims success when a reminder was not scheduled', async () => {
  const app = harness(); await app.flush();
  app.save();
  app.saves[0].resolve({ preferences: { enabled: true, hour: 17, minute: 0 }, permission: 'granted', scheduled: false, error: null });
  await app.flush();
  assert.match(app.text(), /not scheduled/);
  assert.doesNotMatch(app.text(), /Reminder saved/);
});
test('save completing after closing and reopening cannot inject stale success', async () => {
  const app = harness(); await app.flush();
  app.save(); app.close(); app.open(); await app.flush();
  app.saves[0].resolve({ preferences: { enabled: true, hour: 17, minute: 0 }, permission: 'granted', scheduled: true, error: null });
  await app.flush();
  assert.doesNotMatch(app.text(), /Reminder saved/);
});
test('accessibility escape remains available while reminder save is pending', async () => {
  const app = harness(); await app.flush();
  app.save();
  app.node('Done editing reminder time').props.onPress();
  app.escape();
  assert.equal(app.closed, 1);
  assert.equal(app.dismissed, 1);
});
