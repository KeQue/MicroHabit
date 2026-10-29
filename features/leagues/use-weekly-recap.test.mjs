import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import * as recap from './weekly-recap.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = ts.transpileModule(readFileSync(new URL('./use-weekly-recap.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const fixture = { week_start: '2026-10-19', week_end: '2026-10-25', provisional: false,
  finalizes_at: '2026-10-27T00:00:00Z', generated_at: '2026-10-29T10:00:00Z',
  total_member_days: 0, group_active_days: 0, members: [] };

function harness(initial = [true, 'league-a', 'user-a']) {
  let props = initial, cursor = 0, dirty = false, output, sessionOverride;
  const slots = [], effects = [], sessions = [], requests = [], timers = new Map();
  const authListeners = new Set(), foregroundListeners = new Set();
  const changed = (a, b) => !a || a.some((v, i) => !Object.is(v, b[i]));
  const react = {
    useState(initialValue) {
      const i = cursor++;
      slots[i] ??= { value: typeof initialValue === 'function' ? initialValue() : initialValue };
      return [slots[i].value, (next) => { slots[i].value = next; dirty = true; }];
    },
    useRef(value) { const i = cursor++; slots[i] ??= { current: value }; return slots[i]; },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!slots[i] || changed(slots[i].deps, deps)) {
        const previous = slots[i], slot = { deps };
        slots[i] = slot;
        effects.push(() => { previous?.cleanup?.(); slot.cleanup = effect(); });
      }
    },
  };
  const exports = {};
  vm.runInNewContext(source, {
    exports, setTimeout(fn) { const key = {}; timers.set(key, fn); return key; },
    clearTimeout(key) { timers.delete(key); },
    require(name) {
      if (name === 'react') return react;
      if (name === './weekly-recap') return recap;
      if (name === './utc-calendar') return { millisecondsUntilNextUtcDay: () => 100 };
      if (name === 'react-native') return { AppState: { addEventListener(_, listener) {
        foregroundListeners.add(listener); return { remove: () => foregroundListeners.delete(listener) };
      } } };
      if (name === '../../lib/supabase') return { supabase: {
        auth: {
          getSession: () => sessionOverride ?? new Promise(resolve => sessions.push(resolve)),
          onAuthStateChange(listener) { authListeners.add(listener); return { data: { subscription: {
            unsubscribe: () => authListeners.delete(listener),
          } } }; },
        },
        rpc(name, args) {
          const call = { name, args, headers: {} }; requests.push(call);
          return { setHeader(key, value) {
            call.headers[key] = value;
            return new Promise((resolve, reject) => { call.resolve = resolve; call.reject = reject; });
          } };
        },
      } };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  function render(next = props) {
    props = next;
    do {
      dirty = false; cursor = 0; output = exports.useWeeklyRecap(...props);
      while (effects.length) effects.shift()();
    } while (dirty);
    return output;
  }
  render();
  return {
    sessions, requests, render,
    get state() { if (dirty) render(); return output; },
    async flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); if (dirty) render(); },
    resolveSession(index, id = 'user-a') { sessions[index]({ data: { session: { user: { id }, access_token: `token-${id}` } }, error: null }); },
    auth(event, id = null) { for (const cb of [...authListeners]) cb(event, id ? { user: { id } } : null); },
    foreground() { for (const cb of [...foregroundListeners]) cb('active'); },
    midnight() { const fn = timers.values().next().value; fn(); },
    setSession(value) { sessionOverride = value; },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
    counts: () => [authListeners.size, foregroundListeners.size, timers.size],
  };
}

test('recap is lazy, pins the initiating token, hides old scope and cleans up listeners', async () => {
  const h = harness([false, 'league-a', 'user-a']);
  assert.equal(h.sessions.length, 0);
  h.render([true, 'league-a', 'user-a']);
  h.resolveSession(0); await h.flush();
  assert.equal(h.requests[0].headers.Authorization, 'Bearer token-user-a');
  h.requests[0].resolve({ data: fixture, error: null }); await h.flush();
  assert.equal(h.state.data.week_start, fixture.week_start);
  h.render([true, 'league-b', 'user-a']);
  assert.equal(h.state.data, null);
  h.resolveSession(1); await h.flush();
  h.render([false, 'league-b', 'user-a']);
  h.requests[1].resolve({ data: fixture, error: null }); await h.flush();
  assert.equal(h.state.data, null);
  h.unmount(); assert.deepEqual(h.counts(), [0, 0, 0]);
});

test('sign-out or replacement while session is pending sends no recap request', async () => {
  for (const event of ['SIGNED_OUT', 'SIGNED_IN']) {
    const h = harness();
    h.auth(event, event === 'SIGNED_IN' ? 'user-b' : null);
    h.resolveSession(0); await h.flush();
    assert.equal(h.requests.length, 0);
    assert.equal(h.state.data, null);
    h.state.retry(); h.foreground();
    assert.equal(h.sessions.length, 1);
    h.unmount();
  }
});

test('replacement session is rejected; backend failures clear data and permit retry', async () => {
  const h = harness();
  h.resolveSession(0, 'user-b'); await h.flush();
  assert.equal(h.requests.length, 0); assert.equal(h.state.error, true);
  h.state.retry(); h.resolveSession(1); await h.flush();
  h.requests[0].resolve({ error: { message: 'private server detail' }, data: null }); await h.flush();
  assert.equal(h.state.error, true); assert.equal(h.state.data, null);
  h.state.retry(); h.resolveSession(2); await h.flush();
  h.requests[1].resolve({ data: fixture, error: null }); await h.flush();
  assert.equal(h.state.error, false); assert.ok(h.state.data);
  h.unmount();
});

test('foreground and UTC rollover replace old requests; auth event hides published data', async () => {
  const h = harness(); h.resolveSession(0); await h.flush();
  h.foreground(); h.resolveSession(1); await h.flush();
  h.requests[1].resolve({ data: fixture, error: null }); await h.flush();
  h.requests[0].reject(new Error('old failure')); await h.flush();
  assert.ok(h.state.data); assert.equal(h.state.error, false);
  h.midnight(); assert.equal(h.state.data, null);
  h.resolveSession(2); await h.flush();
  h.auth('SIGNED_OUT'); h.requests[2].resolve({ data: fixture, error: null }); await h.flush();
  assert.equal(h.state.data, null);
  h.unmount();
});
