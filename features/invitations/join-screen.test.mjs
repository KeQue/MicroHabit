import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { normalizeInviteCode } from './invite.ts';
import { runFreeJoin, StaleJoinAttempt } from './join-attempt.ts';

const source = ts.transpileModule(fs.readFileSync('app/(app)/league/join.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }

// Runs the actual screen handlers with deterministic hooks and synthetic API
// responses. This does not emulate Expo navigation or a native touch screen.
function harness() {
  let cursor = 0, dirty = false, tree;
  const slots = [], effects = [], calls = [], joins = [], clears = [], navigation = [];
  const state = { user: { id: 'user-a' }, params: { code: 'ABC123', inviteNonce: 'intent-a' },
    pending: { code: 'ABC123', nonce: 'intent-a', userId: 'user-a' } };
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(Infinity).filter(Boolean) }),
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useState(value) { const i = cursor++; slots[i] ??= { value }; return [slots[i].value, next => { slots[i].value = next; dirty = true; }]; },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((v, j) => !Object.is(v, slots[i].deps[j]))) {
        const old = slots[i]; slots[i] = { deps };
        effects.push(() => { old?.cleanup?.(); slots[i].cleanup = effect(); });
      }
    },
  };
  function query(kind, result) {
    const call = { kind, headers: {} }; calls.push(call);
    const builder = { select() { return builder; }, eq() { return builder; }, single() { return builder; }, upsert() { return builder; },
      setHeader(key, value) { call.headers[key] = value; return builder; },
      then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); } };
    return builder;
  }
  const supabase = {
    auth: { getSession: async () => ({ data: { session: state.user ? { user: state.user, access_token: `synthetic-${state.user.id}` } : null } }) },
    from: name => query(name, name === 'profiles' ? { error: null } : { data: { id: 'league-a', name: 'Friends', activity: 'Walk', is_free: true }, error: null }),
    rpc: (_name, args) => { const d = deferred(); joins.push({ ...d, args }); return query('join', d.promise); },
  };
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require(name) {
    if (name === 'react') return react;
    if (name === 'react-native') return Object.fromEntries(['ActivityIndicator', 'Pressable', 'Text', 'TextInput', 'View'].map(n => [n, n]));
    if (name === 'expo-router') return { useLocalSearchParams: () => state.params, useRouter: () => ({ canGoBack: () => false, back: () => navigation.push('back'), replace: path => navigation.push(path) }) };
    if (name.endsWith('/supabase')) return { supabase };
    if (name.endsWith('/useAuth')) return { useAuth: () => ({ user: state.user }) };
    if (name.endsWith('/invite')) return { normalizeInviteCode };
    if (name.endsWith('/join-attempt')) return { runFreeJoin, StaleJoinAttempt };
    if (name.endsWith('/pending-invite')) return { usePendingInvite: () => ({ pending: state.pending, clear: async nonce => {
      clears.push(nonce); if (state.pending?.nonce === nonce) state.pending = null; dirty = true;
    } }) };
    throw new Error(`Unexpected import ${name}`);
  } });
  function render() { do { dirty = false; cursor = 0; tree = module.exports.default(); while (effects.length) effects.shift()(); } while (dirty); }
  function nodes(node = tree) { return typeof node === 'object' ? [node, ...node.children.flatMap(n => nodes(n))] : []; }
  render();
  return { state, calls, joins, clears, navigation, render,
    button: label => nodes().find(n => n.props.accessibilityLabel === label),
    input: () => nodes().find(n => n.type === 'TextInput'),
    text: () => nodes().filter(n => n.type === 'Text').flatMap(n => n.children).join(' '),
    async flush() { for (let i = 0; i < 15; i++) { await Promise.resolve(); if (dirty) render(); } },
    unmount() { slots.forEach(s => s.cleanup?.()); },
  };
}

test('screen prefills without joining, guards duplicate taps, binds requests, then clears its own intent', async () => {
  const h = harness();
  assert.equal(h.input().props.value, 'ABC123'); assert.equal(h.joins.length, 0);
  const join = h.button('Join league').props.onPress;
  const first = join(); const duplicate = join(); await h.flush();
  assert.equal(h.joins.length, 1);
  h.joins[0].resolve({ data: 'league-a', error: null }); await Promise.all([first, duplicate]); await h.flush();
  assert.deepEqual(h.clears, ['intent-a']);
  assert.ok(h.calls.every(c => c.headers.Authorization === 'Bearer synthetic-user-a'));
  assert.ok(h.button('Continue to league')); h.button('Continue to league').props.onPress();
  assert.deepEqual(h.navigation, ['/league/league-a']); h.unmount();
});
test('changed account or invitation rejects late preview and never clears the new intent', async () => {
  for (const change of ['account', 'invite']) {
    const h = harness(); const request = h.button('Join league').props.onPress(); await h.flush();
    if (change === 'account') h.state.user = { id: 'user-b' };
    else { h.state.params = { code: 'DEF456', inviteNonce: 'intent-b' }; h.state.pending = { code: 'DEF456', nonce: 'intent-b', userId: 'user-a' }; }
    h.render(); h.joins[0].resolve({ data: 'league-a', error: null }); await request; await h.flush();
    assert.equal(h.button('Continue to league'), undefined); assert.deepEqual(h.clears, []);
    assert.deepEqual(h.navigation, []); h.unmount();
  }
});
test('invalid invite remains retryable, input changes are respected, and cancelled intent clears', async () => {
  const h = harness(); const first = h.button('Join league').props.onPress(); await h.flush();
  h.joins[0].resolve({ data: null, error: { message: 'invalid_invite_code' } }); await first; await h.flush();
  assert.match(h.text(), /Invalid invite code/); assert.equal(h.button('Join league').props.disabled, false);
  h.input().props.onChangeText('def456'); h.render();
  const retry = h.button('Join league').props.onPress(); await h.flush();
  assert.equal(h.joins[1].args.p_code, 'DEF456');
  h.joins[1].resolve({ data: null, error: { message: 'network failure' } }); await retry; await h.flush();
  assert.equal(h.button('Continue to league'), undefined); assert.deepEqual(h.clears, []);
  h.input().props.onChangeText('ABC123'); h.render(); await h.button('Go back').props.onPress();
  assert.deepEqual(h.clears, ['intent-a']); assert.deepEqual(h.navigation, ['/(app)']); h.unmount();
});

test('editing an invite code does not detach Back or a successful join from the original intent', async () => {
  for (const action of ['back', 'join']) {
    const h = harness();
    h.input().props.onChangeText('DEF456'); h.render();
    if (action === 'back') await h.button('Go back').props.onPress();
    else {
      const request = h.button('Join league').props.onPress(); await h.flush();
      h.joins[0].resolve({ data: 'league-a', error: null }); await request; await h.flush();
    }
    assert.deepEqual(h.clears, ['intent-a']);
    assert.equal(h.state.pending, null);
    h.unmount();
  }
});

test('cancelling an old screen after editing never clears a newer invitation', async () => {
  const h = harness();
  h.input().props.onChangeText('DEF456'); h.render();
  h.state.pending = { code: 'NEW789', nonce: 'intent-b', userId: 'user-a' };
  h.render();
  await h.button('Go back').props.onPress();
  assert.deepEqual(h.clears, []);
  assert.equal(h.state.pending.nonce, 'intent-b');
  h.unmount();
});
