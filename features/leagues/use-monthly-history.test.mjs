import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = ts.transpileModule(readFileSync(new URL('./use-monthly-history.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

// Minimal deterministic hook scheduler. No network, native modules or accounts are used.
function harness(initial = ['league-a', 'user-a', '2026-11-01']) {
  let props = initial;
  let cursor = 0;
  let dirty = false;
  let output;
  let writes = 0;
  const slots = [];
  const effects = [];
  const requests = [];
  const authListeners = new Set();
  const foregroundListeners = new Set();
  const changed = (a, b) => !a || a.length !== b.length || a.some((value, i) => !Object.is(value, b[i]));
  const react = {
    useState(initialValue) {
      const i = cursor++;
      slots[i] ??= { value: typeof initialValue === 'function' ? initialValue() : initialValue };
      return [slots[i].value, (next) => {
        slots[i].value = typeof next === 'function' ? next(slots[i].value) : next;
        writes++;
        dirty = true;
      }];
    },
    useRef(value) {
      const i = cursor++;
      slots[i] ??= { current: value };
      return slots[i];
    },
    useCallback(callback, deps) {
      const i = cursor++;
      if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = { value: callback, deps };
      return slots[i].value;
    },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!slots[i] || changed(slots[i].deps, deps)) {
        const previous = slots[i];
        const slot = { deps, cleanup: undefined };
        slots[i] = slot;
        effects.push(() => { previous?.cleanup?.(); slot.cleanup = effect(); });
      }
    },
  };
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require(name) {
      if (name === 'react') return react;
      if (name === 'react-native') return { AppState: { addEventListener(_, listener) {
        foregroundListeners.add(listener);
        return { remove: () => foregroundListeners.delete(listener) };
      } } };
      if (name === '../../lib/supabase') return { supabase: { auth: { onAuthStateChange(listener) {
        authListeners.add(listener);
        return { data: { subscription: { unsubscribe: () => authListeners.delete(listener) } } };
      } } } };
      if (name === './api') return { getFreeLeagueHistory(...args) {
        return new Promise((resolve, reject) => requests.push({ args, resolve, reject }));
      } };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  function render(next = props) {
    props = next;
    do {
      dirty = false;
      cursor = 0;
      output = exports.useMonthlyHistory(...props);
      while (effects.length) effects.shift()();
    } while (dirty);
    return output;
  }
  render();
  return {
    requests,
    get state() { if (dirty) render(); return output; },
    get writes() { return writes; },
    render,
    async flush() { await Promise.resolve(); await Promise.resolve(); if (dirty) render(); },
    auth(event, id = null) { for (const listener of [...authListeners]) listener(event, id ? { user: { id } } : null); if (dirty) render(); },
    foreground() { for (const listener of [...foregroundListeners]) listener('active'); if (dirty) render(); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
    listenerCounts() { return [authListeners.size, foregroundListeners.size]; },
  };
}

function cycle(month_start, days = 3) {
  return { month_start, status: 'final', finalizes_at: '2026-11-02T00:00:00Z', results: [{ user_id: 'user-a', display_name: 'A', days_completed: days, longest_streak: 2, position: 9 }] };
}
const page = Array.from({ length: 12 }, (_, i) => cycle(`2026-${String(12 - i).padStart(2, '0')}-01`));

test('history loads lazily, preserves authoritative data, and paginates without duplicate months', async () => {
  const h = harness();
  h.foreground(); h.state.refresh();
  assert.equal(h.requests.length, 0);
  h.state.open(); h.state.open();
  assert.equal(h.requests.length, 1);
  assert.deepEqual(h.requests[0].args, ['league-a', null, 12]);
  assert.equal(h.state.loading, true);
  h.requests[0].resolve(page); await h.flush();
  assert.equal(h.state.cycles[0].results[0].position, 9);
  assert.equal(h.state.hasMore, true);
  void h.state.loadMore(); void h.state.loadMore();
  assert.equal(h.requests.length, 2);
  assert.deepEqual(h.requests[1].args, ['league-a', '2026-01-01', 12]);
  h.requests[1].resolve([page[11], cycle('2025-12-01')]); await h.flush();
  assert.equal(h.state.cycles.length, 13);
  assert.equal(h.state.cycles.at(-1).month_start, '2025-12-01');
  assert.equal(h.state.hasMore, false);
  void h.state.loadMore(); assert.equal(h.requests.length, 2);
  h.unmount();
});

test('first-load and pagination failures remain errors rather than fabricated results', async () => {
  const h = harness(); h.state.open();
  h.requests[0].reject(new Error('sensitive server details')); await h.flush();
  assert.equal(h.state.cycles.length, 0);
  assert.match(h.state.error, /Could not load/);
  assert.doesNotMatch(h.state.error, /sensitive/);
  h.state.retry(); h.requests[1].resolve(page); await h.flush();
  void h.state.loadMore(); h.requests[2].reject(new Error('offline')); await h.flush();
  assert.equal(h.state.cycles.length, 12);
  assert.equal(h.state.error, null);
  assert.match(h.state.moreError, /older months/);
  assert.equal(h.state.loadingMore, false);
  void h.state.loadMore();
  assert.deepEqual(h.requests[3].args, ['league-a', '2026-01-01', 12]);
  h.requests[3].resolve([]); await h.flush();
  assert.equal(h.state.moreError, null);
  assert.equal(h.state.hasMore, false);
  h.unmount();
});

for (const [label, next] of [
  ['league', ['league-b', 'user-a', '2026-11-01']],
  ['account', ['league-a', 'user-b', '2026-11-01']],
  ['UTC day', ['league-a', 'user-a', '2026-11-02']],
]) {
  test(`a late response cannot populate a changed ${label}`, async () => {
    const h = harness(); h.state.open(); h.render(next);
    assert.equal(h.state.cycles.length, 0);
    if (label !== 'UTC day') {
      assert.equal(h.requests.length, 1);
      h.state.open();
    }
    assert.equal(h.requests.length, 2);
    h.requests[1].resolve([cycle('2026-10-01', 8)]); await h.flush();
    h.requests[0].resolve([cycle('2026-09-01', 999)]); await h.flush();
    assert.equal(h.state.cycles.length, 1);
    assert.equal(h.state.cycles[0].results[0].days_completed, 8);
    h.unmount();
  });
}

for (const [event, user] of [['SIGNED_OUT', null], ['SIGNED_IN', 'another-user']]) {
  test(`${event} clears history and rejects a late pagination response`, async () => {
    const h = harness(); h.state.open(); h.requests[0].resolve(page); await h.flush();
    void h.state.loadMore(); h.auth(event, user);
    assert.equal(h.state.cycles.length, 0);
    h.state.refresh(); h.state.open(); h.state.retry(); h.foreground();
    assert.equal(h.requests.length, 2);
    h.requests[1].resolve([cycle('2025-12-01')]); await h.flush();
    assert.equal(h.state.cycles.length, 0);
    h.unmount();
  });
}

test('refresh replaces older provisional data and invalidates a pending older-page request', async () => {
  const h = harness(); h.state.open(); h.requests[0].resolve(page); await h.flush();
  void h.state.loadMore(); h.foreground();
  assert.equal(h.requests.length, 3);
  assert.equal(h.state.loading, true);
  h.requests[2].resolve([cycle('2026-12-01', 12)]); await h.flush();
  h.requests[1].resolve([cycle('2025-12-01')]); await h.flush();
  assert.equal(h.state.cycles.length, 1);
  assert.equal(h.state.cycles[0].results[0].days_completed, 12);
  h.unmount();
});

test('unmount removes listeners and prevents pending requests from publishing', async () => {
  const h = harness(); h.state.open();
  assert.deepEqual(h.listenerCounts(), [1, 1]);
  h.unmount(); const before = h.writes;
  assert.deepEqual(h.listenerCounts(), [0, 0]);
  h.requests[0].resolve(page); await h.flush();
  assert.equal(h.writes, before);
});

test('matching sign-in after sign-out permits a new explicit open, without leaking old data', async () => {
  const h = harness(); h.auth('SIGNED_OUT'); h.state.open();
  assert.equal(h.requests.length, 0);
  h.auth('SIGNED_IN', 'user-a'); h.state.open();
  assert.equal(h.requests.length, 1);
  h.requests[0].resolve([]); await h.flush();
  assert.equal(h.state.cycles.length, 0);
  assert.equal(h.state.error, null);
  h.unmount();
});

test('an unavailable feature or missing account cannot request history', () => {
  for (const props of [['', 'user-a', '2026-11-01'], ['league-a', '', '2026-11-01']]) {
    const h = harness(props);
    h.state.open(); h.state.retry(); h.state.refresh(); void h.state.loadMore(); h.foreground();
    assert.equal(h.requests.length, 0);
    assert.equal(h.state.cycles.length, 0);
    h.unmount();
  }
});

test('refresh callback stays stable across loading and results renders', async () => {
  const h = harness(); const refresh = h.state.refresh;
  h.state.open(); assert.equal(h.state.refresh, refresh);
  h.requests[0].resolve(page); await h.flush();
  assert.equal(h.state.refresh, refresh);
  h.state.refresh(); assert.equal(h.state.refresh, refresh);
  h.requests[1].reject(new Error('offline')); await h.flush();
  assert.equal(h.state.refresh, refresh);
  h.unmount();
});
