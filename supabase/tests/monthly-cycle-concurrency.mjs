// Explicit isolated-local test only. Never run against linked/live Supabase.
// node supabase/tests/monthly-cycle-concurrency.mjs commito_cycle_batch1_v3
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const database = process.argv[2];
assert.match(database ?? '', /^commito_cycle_batch1_v\d+$/, 'Use a disposable cycle-test clone');
const args = ['-X', '-qAt', '-h', '127.0.0.1', '-p', '55439', '-U', 'postgres', '-w', '-d', database, '-v', 'ON_ERROR_STOP=1'];
function sql(query) {
  const result = spawnSync('psql', [...args, '-c', query], { encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout.trim();
}
function session(name) {
  const child = spawn('psql', args, { env: { ...process.env, PGAPPNAME: name }, stdio: ['pipe', 'pipe', 'pipe'] });
  let pending = null;
  let buffer = '';
  let errors = '';
  child.stderr.on('data', (data) => { errors += data; });
  child.stdin.on('error', () => {}); // process exit reports the SQL error below
  child.stdout.on('data', (data) => {
    buffer += data;
    let end;
    while ((end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end).trim();
      buffer = buffer.slice(end + 1);
      if (line === pending?.marker) {
        const done = pending;
        pending = null;
        clearTimeout(done.timer);
        done.resolve(done.lines.join('\n'));
      } else if (pending) pending.lines.push(line);
    }
  });
  child.on('error', (error) => pending?.reject(error));
  child.on('exit', () => {
    if (pending) { clearTimeout(pending.timer); pending.reject(new Error(errors || 'psql exited')); pending = null; }
  });
  return {
    run(query) {
      assert.equal(pending, null, 'Only one command at a time per session');
      return new Promise((resolve, reject) => {
        const marker = randomUUID();
        const timer = setTimeout(() => { child.kill(); reject(new Error('Local SQL session timed out')); }, 10000);
        pending = { marker, resolve, reject, timer, lines: [] };
        child.stdin.write(`${query}\n\\echo ${marker}\n`);
      });
    },
    close() { if (!child.stdin.destroyed) child.stdin.end('rollback;\n\\q\n'); },
  };
}
async function waitForAdvisory(name) {
  for (let i = 0; i < 50; i++) {
    if (sql(`select count(*) from pg_stat_activity where application_name='${name}' and wait_event='advisory'`) === '1') return;
    await delay(40);
  }
  throw new Error(`Expected ${name} to wait for the cycle lock`);
}

const owner = randomUUID();
const league = randomUUID();
const suffix = randomUUID();
const writerName = `cycle-write-${suffix}`;
const readerName = `cycle-read-${suffix}`;
const originalClock = sql("select pg_get_functiondef('commito_private.utc_now()'::regprocedure)");
const writer = session(writerName);
const reader = session(readerName);
try {
  sql(`create table commito_private.cycle_test_clock(instant timestamptz);
    insert into commito_private.cycle_test_clock values ('2024-01-31T12:00:00Z');
    create or replace function commito_private.utc_now() returns timestamptz language sql volatile set search_path='' as
      $$ select instant from commito_private.cycle_test_clock $$;
    insert into auth.users(id,email) values ('${owner}','${owner}@example.invalid');
    insert into public.profiles(id) values ('${owner}') on conflict(id) do nothing;
    insert into public.leagues(id,name,activity,invite_code,created_by,month_key,is_free,created_at)
      values ('${league}','Local race fixture','Walk','${league}','${owner}','2024-01',true,'2024-01-01T00:00:00Z');
    insert into public.league_members(league_id,user_id,role,payment_status,joined_at)
      values ('${league}','${owner}','owner','free','2024-01-01T00:00:00Z');
    insert into public.daily_logs(league_id,user_id,log_date,completed) values ('${league}','${owner}','2024-01-31',false);
    update commito_private.cycle_test_clock set instant='2024-02-01T23:59:59Z';`);
  await writer.run(`begin; update public.daily_logs set completed=true where league_id='${league}';`);
  sql("update commito_private.cycle_test_clock set instant='2024-02-02T00:00:00Z'");
  const historyPromise = reader.run(`begin;
    set local request.jwt.claim.sub='${owner}'; set local role authenticated;
    select public.get_free_league_history('${league}');`);
  await waitForAdvisory(readerName);
  await writer.run('commit;');
  const history = JSON.parse(await historyPromise);
  assert.equal(history[0].status, 'final');
  assert.equal(history[0].results[0].days_completed, 1, 'Finalizer must include the committed correction');

  // Finalizer still owns its transaction lock. A competing old-day edit waits,
  // then must reject after the snapshot commits rather than rewrite its source.
  const rejectedEdit = writer.run(`begin; update public.daily_logs set completed=false where league_id='${league}';`)
    .then(() => null, (error) => error);
  await waitForAdvisory(writerName);
  await reader.run('commit;');
  assert.match((await rejectedEdit)?.message ?? '', /month_checkin_locked/);
  assert.equal(sql(`select days_completed from public.free_league_cycle_results where league_id='${league}'`), '1');
  assert.equal(sql(`select completed from public.daily_logs where league_id='${league}'`), 't');
  console.log('PASS: concurrent correction/finalization serializes; a waiting closed-month edit rejects after finalization');
} finally {
  writer.close();
  reader.close();
  sql(`delete from auth.users where id='${owner}'; ${originalClock}; drop table if exists commito_private.cycle_test_clock;`);
}
