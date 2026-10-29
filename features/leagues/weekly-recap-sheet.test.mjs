import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { weeklyRecapRangeLabel } from './weekly-recap.ts';

// Actual component handlers with native animation/layout ports replaced.
// These tests do not prove native touch hit-testing or iPhone rendering.
function harness() {
  let cursor = 0, visible = true, closed = 0, retried = 0, tree;
  const slots = [], effects = [];
  let animation;
  const members = [{ user_id: 'peer', display_name: 'Sadu', active_days: 7 },
    { user_id: 'me', display_name: 'Sadu', active_days: 1 },
    { user_id: 'other', display_name: 'Other', active_days: 0 }];
  let recap = { loading: false, error: false, data: {
    week_start: '2026-10-19', week_end: '2026-10-25', provisional: false,
    total_member_days: 8, group_active_days: 7, members,
  }, retry() { retried++; } };
  const react = {
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useMemo(callback, deps) {
      const i = cursor++;
      if (!slots[i] || slots[i].deps.some((v, j) => v !== deps[j])) slots[i] = { value: callback(), deps };
      return slots[i].value;
    },
    useEffect(callback, deps) {
      const i = cursor++;
      if (!slots[i] || slots[i].deps.some((v, j) => v !== deps[j])) {
        const old = slots[i], slot = { deps }; slots[i] = slot;
        effects.push(() => { old?.cleanup?.(); slot.cleanup = callback(); });
      }
    },
  };
  class Value {
    constructor(value) { this.value = value; }
    setValue(value) { this.value = value; }
    stopAnimation() { const old = animation; animation = null; old?.callback({ finished: false }); }
  }
  const native = Object.fromEntries(['ActivityIndicator', 'Modal', 'Pressable', 'ScrollView', 'Text', 'View'].map(n => [n, n]));
  native.StyleSheet = { create: v => v, absoluteFill: {}, hairlineWidth: 1 };
  native.useWindowDimensions = () => ({ height: 640, width: 320 });
  native.Platform = { OS: 'ios' };
  native.PanResponder = { create: handlers => ({ panHandlers: handlers }) };
  native.Animated = { View: 'AnimatedView', Value,
    spring: (value, config) => ({ start() { value.setValue(config.toValue); } }),
    timing: (value, config) => ({ start(callback) { animation = { callback, value, config }; } }),
  };
  const jsx = (type, props, key) => ({ type, props, key });
  const dependencies = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': native,
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/features/auth/useAuth': { useAuth: () => ({ user: { id: 'me' } }) },
    '@/features/leagues/use-weekly-recap': { useWeeklyRecap: () => recap },
    '@/features/leagues/weekly-recap': { weeklyRecapRangeLabel },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) },
  };
  const source = ts.transpileModule(readFileSync(new URL('../../components/WeeklyRecap.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require(name) { assert.ok(name in dependencies, name); return dependencies[name]; } });
  const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...[].concat(node.props?.children ?? []).flatMap(nodes)];
  const render = () => {
    cursor = 0; tree = exports.WeeklyRecap({ visible, leagueId: 'league', onClose() { closed++; } });
    while (effects.length) effects.shift()();
  };
  render();
  return {
    get closed() { return closed; }, get retried() { return retried; }, members,
    nodes: () => nodes(tree),
    node: testID => nodes(tree).find(n => n.props?.testID === testID),
    header: () => nodes(tree).find(n => n.props?.testID === 'recap-drag-header').props,
    finish() { const pending = animation; animation = null; pending?.callback({ finished: true }); },
    setVisible(value) { visible = value; render(); },
    state(next) { recap = { ...recap, ...next }; render(); },
  };
}

test('outside, X, system back and accessibility escape all dismiss the recap', () => {
  const h = harness();
  h.node('recap-backdrop').props.onPress();
  h.nodes().find(n => n.props?.accessibilityLabel === 'Close weekly recap').props.onPress();
  h.nodes().find(n => n.type === 'Modal').props.onRequestClose();
  h.nodes().find(n => n.props?.accessibilityViewIsModal).props.onAccessibilityEscape();
  assert.equal(h.closed, 4);
  const overlay = h.nodes().find(n => n.type === 'View');
  assert.equal(overlay.props.children[0].props.testID, 'recap-backdrop');
  assert.equal(overlay.props.children[1].type, 'AnimatedView');
  assert.equal(overlay.props.children[1].props.onPress, undefined);
});

test('only downward header drags dismiss; short drags reset and body scrolling stays independent', () => {
  const h = harness(), header = h.header();
  assert.equal(header.onMoveShouldSetPanResponder(null, { dy: -20, dx: 0 }), false);
  assert.equal(header.onMoveShouldSetPanResponder(null, { dy: 20, dx: 60 }), false);
  assert.equal(header.onMoveShouldSetPanResponder(null, { dy: 30, dx: 0 }), true);
  header.onPanResponderRelease(null, { dy: 20, vy: 0.1 }); h.finish();
  assert.equal(h.closed, 0);
  const scroll = h.nodes().find(n => n.type === 'ScrollView');
  assert.equal(scroll.props.onMoveShouldSetPanResponder, undefined);
  header.onPanResponderRelease(null, { dy: 90, vy: 0.1 });
  assert.equal(h.closed, 0); h.finish(); assert.equal(h.closed, 1);
  const fast = harness(); fast.header().onPanResponderRelease(null, { dy: 30, vy: 1 }); fast.finish();
  assert.equal(fast.closed, 1);
});

test('closing and reopening cancels pending dismissal and resets header gestures', () => {
  const h = harness(); h.header().onPanResponderRelease(null, { dy: 90, vy: 0.1 });
  h.setVisible(false); h.setVisible(true); h.finish();
  assert.equal(h.closed, 0);
  assert.equal(h.header().onMoveShouldSetPanResponder(null, { dy: 30, dx: 0 }), true);
});

test('You appears first without merging equal names or changing scores and peer order', () => {
  const h = harness();
  const rows = h.nodes().filter(n => n.props?.accessibilityLabel?.includes('active days out of seven'));
  assert.deepEqual(rows.map(n => n.key), ['me', 'peer', 'other']);
  assert.match(rows[0].props.accessibilityLabel, /You. 1 active/);
  assert.match(rows[1].props.accessibilityLabel, /Sadu. 7 active/);
  assert.deepEqual(h.members.map(m => m.user_id), ['peer', 'me', 'other']);
  const widths = h.nodes().filter(n => n.type === 'View').flatMap(n => Array.isArray(n.props?.style) ? n.props.style : [])
    .filter(style => typeof style?.width === 'string' && style.width.endsWith('%')).map(style => style.width);
  assert.deepEqual(widths, [`${1 / 7 * 100}%`, '100%', '0%']);
});

test('recap retains loading and retry states rather than inventing zero scores', () => {
  const h = harness();
  h.state({ data: null, error: true });
  const retry = h.nodes().find(n => n.type === 'Pressable' && n.props?.children?.props?.children === 'Try again');
  retry.props.onPress(); assert.equal(h.retried, 1);
  assert.equal(h.nodes().filter(n => n.props?.accessibilityLabel?.includes('active days out of seven')).length, 0);
  h.state({ error: false, loading: true });
  assert.ok(h.nodes().some(n => n.props?.accessibilityLabel === 'Loading weekly recap'));
});
