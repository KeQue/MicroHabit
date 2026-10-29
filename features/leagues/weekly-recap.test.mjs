import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWeeklyRecap, createRecapRequest, weeklyRecapDateLabel } from './weekly-recap.ts';

const id = '00000000-0000-4000-8000-000000000001';
export const recapFixture = () => ({
  week_start: '2026-10-19', week_end: '2026-10-25', provisional: false,
  finalizes_at: '2026-10-27T00:00:00Z', generated_at: '2026-10-29T10:00:00Z',
  total_member_days: 3, group_active_days: 2,
  members: [{ user_id: id, display_name: 'Sadu', active_days: 2 },
    { user_id: '00000000-0000-4000-8000-000000000002', display_name: 'Sadu', active_days: 1 }],
});

test('recap retains separate equal-name members and never invents a rank', () => {
  const value = parseWeeklyRecap(recapFixture());
  assert.equal(value.members.length, 2);
  assert.equal(value.total_member_days, 3);
  assert.equal(value.members[0].position, undefined);
  assert.equal(weeklyRecapDateLabel(value.week_start), 'Oct 19, 2026');
});

test('recap rejects incompatible or impossible dates, counts and correction status', () => {
  const bad = [null, [], { ...recapFixture(), week_start: '2026-02-30' },
    { ...recapFixture(), week_start: '2026-10-20' }, { ...recapFixture(), week_end: '2026-10-26' },
    { ...recapFixture(), provisional: true }, { ...recapFixture(), total_member_days: 99 },
    { ...recapFixture(), group_active_days: 1 }, { ...recapFixture(), generated_at: '2026-10-26T00:00:00Z' },
    { ...recapFixture(), finalizes_at: '2026-10-26T00:00:00Z' },
    { ...recapFixture(), generated_at: '2026-11-02T00:00:00Z' },
    { ...recapFixture(), members: [{ user_id: id, display_name: 'A', active_days: -1 }] },
    { ...recapFixture(), members: [recapFixture().members[0], recapFixture().members[0]] }];
  for (const value of bad) assert.throws(() => parseWeeklyRecap(value), /Invalid weekly recap/);
  const monday = { ...recapFixture(), provisional: true, generated_at: '2026-10-26T23:59:59Z' };
  assert.equal(parseWeeklyRecap(monday).provisional, true);
  assert.equal(parseWeeklyRecap({ ...monday, provisional: false, generated_at: '2026-10-27T00:00:00Z' }).provisional, false);
});

test('late success and failure cannot overwrite a newer recap or a closed scope', async () => {
  const states = [];
  const request = createRecapRequest(value => states.push(value));
  let resolveOld, rejectOld;
  const first = request.load(() => new Promise(resolve => { resolveOld = resolve; }));
  await request.load(async () => 'new');
  resolveOld('old'); await first;
  assert.equal(states.at(-1).data, 'new');
  const second = request.load(() => new Promise((_, reject) => { rejectOld = reject; }));
  request.cancel(); const length = states.length;
  rejectOld(new Error('secret')); await second;
  assert.equal(states.length, length);
  await request.load(async () => { throw new Error('secret'); });
  assert.deepEqual(states.at(-1), { data: null, loading: false, error: true });
});
