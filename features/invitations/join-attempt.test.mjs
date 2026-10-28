import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { runFreeJoin, StaleJoinAttempt } from './join-attempt.ts';

function fixture(changes = {}) {
  const calls = [];
  const session = { userId: 'user-a', accessToken: 'synthetic-a', email: null };
  return { calls, options: {
    userId: 'user-a', code: 'ABC123', isCurrent: () => true,
    session: async () => session,
    ensureProfile: async s => { calls.push(['profile', s]); },
    join: async (code, s) => { calls.push(['join', code, s]); return 'league'; },
    readLeague: async (id, s) => { calls.push(['read', id, s]); return { id, is_free: true }; },
    ...changes,
  } };
}
test('explicit attempt ensures profile before joining and uses one captured session', async () => {
  const { calls, options } = fixture();
  assert.deepEqual(await runFreeJoin(options), { id: 'league', is_free: true });
  assert.deepEqual(calls.map(c => c[0]), ['profile', 'join', 'read']);
  assert.equal(calls[0][1], calls[1][2]);
  assert.equal(calls[1][2], calls[2][2]);
});
test('account or invite change during every asynchronous step rejects stale results', async () => {
  for (const boundary of ['session', 'ensureProfile', 'join', 'readLeague']) {
    let current = true;
    const { calls, options } = fixture({ isCurrent: () => current });
    const step = options[boundary];
    options[boundary] = async (...args) => { const result = await step(...args); current = false; return result; };
    await assert.rejects(runFreeJoin(options), StaleJoinAttempt);
    if (['session', 'ensureProfile'].includes(boundary)) assert.equal(calls.some(c => c[0] === 'join'), false);
  }
});
test('wrong session, storage/profile failure and paid results never publish a successful join', async () => {
  const wrong = fixture({ session: async () => ({ userId: 'user-b', accessToken: 'synthetic-b' }) });
  await assert.rejects(runFreeJoin(wrong.options), /Sign in again/);
  assert.equal(wrong.calls.length, 0);
  const failed = fixture({ ensureProfile: async () => { throw new Error('offline'); } });
  await assert.rejects(runFreeJoin(failed.options), /offline/);
  assert.equal(failed.calls.length, 0);
  for (const result of [{ id: 'league', is_free: false }, { id: 'other-league', is_free: true }]) {
    await assert.rejects(runFreeJoin(fixture({ readLeague: async () => result }).options), /free leagues only/);
  }
});
test('installed Supabase request wrapper preserves explicit originating token after account switch', async () => {
  const source = fs.readFileSync('node_modules/@supabase/supabase-js/src/lib/fetch.ts', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, Headers });
  let observed;
  const request = module.exports.fetchWithAuth('synthetic-public-key', async () => 'synthetic-new-account',
    async (_url, init) => { observed = init.headers.get('Authorization'); return {}; });
  await request('https://example.invalid/rest/v1/rpc/join_league_by_code', { headers: { Authorization: 'Bearer synthetic-original-account' } });
  assert.equal(observed, 'Bearer synthetic-original-account');
});
