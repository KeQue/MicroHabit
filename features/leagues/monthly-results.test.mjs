import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRankNames, formatUtcMonth, parseMonthlyCycles } from './monthly-results.ts';
import { utcCalendar } from './utc-calendar.ts';

test('month labels and next-cycle boundaries remain UTC across device zones', () => {
  for (const timezone of ['Europe/Berlin', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
    process.env.TZ = timezone;
    assert.equal(formatUtcMonth('2024-02-01'), 'February 2024');
    assert.equal(formatUtcMonth('2027-01-01'), 'January 2027');
    for (const [instant, start, end] of [
      ['2024-02-01T00:00:00Z', '2024-02-01', '2024-02-29'],
      ['2025-02-01T00:00:00Z', '2025-02-01', '2025-02-28'],
      ['2027-01-01T00:00:00Z', '2027-01-01', '2027-01-31'],
    ]) {
      const calendar = utcCalendar(new Date(instant));
      assert.equal(calendar.start, start);
      assert.equal(calendar.end, end);
    }
  }
});

test('invalid month labels fail instead of silently rolling into another month', () => {
  for (const value of ['2026-13-01', '2026-00-01', '2026-02-30', '2026-02', 'not-a-date']) {
    assert.throws(() => formatUtcMonth(value), /Invalid month/);
  }
});

test('equal-score names use the same stable Unicode order as server snapshots', () => {
  const names = ['\u{10000}', '\uE000', 'Éva', 'eva', 'Eva', 'Ev', 'Ana'];
  assert.deepEqual(names.sort(compareRankNames), ['Ana', 'Ev', 'Eva', 'eva', 'Éva', '\uE000', '\u{10000}']);
  assert.equal(compareRankNames('Twin', 'Twin'), 0);
});

test('history rejects malformed server responses, preserves supplied ranks and exposes display fields only', () => {
  const row = { user_id: 'member', display_name: 'Eva', days_completed: 3, longest_streak: 2, position: 7 };
  const cycle = { month_start: '2026-09-01', status: 'final', finalizes_at: '2026-10-02T00:00:00Z', results: [row] };
  assert.deepEqual(parseMonthlyCycles([{ ...cycle, results: [{ ...row, email: 'private@example.invalid' }] }]), [cycle]);
  for (const bad of [null, {}, [null], [{ ...cycle, month_start: '2026-13-01' }],
    [{ ...cycle, status: 'paid' }], [{ ...cycle, finalizes_at: 'never' }], [{ ...cycle, results: null }],
    [{ ...cycle, results: [{ ...row, days_completed: 32 }] }],
    [{ ...cycle, results: [{ ...row, longest_streak: 4 }] }],
    [{ ...cycle, results: [{ ...row, position: 0 }] }],
    [{ ...cycle, results: [row, row] }], [cycle, cycle]]) {
    assert.throws(() => parseMonthlyCycles(bad), /Invalid monthly history response/);
  }
});
