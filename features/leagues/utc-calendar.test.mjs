import test from 'node:test';
import assert from 'node:assert/strict';
import { canEditUtcDate, millisecondsUntilNextUtcDay, utcCalendar } from './utc-calendar.ts';

test('one instant has the same UTC day across device timezones', () => {
  for (const timezone of ['Europe/Berlin', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
    process.env.TZ = timezone;
    const calendar = utcCalendar(new Date('2026-10-31T23:30:00Z'));
    assert.equal(calendar.today, '2026-10-31');
    assert.equal(calendar.start, '2026-10-01');
    assert.equal(calendar.end, '2026-10-31');
    assert.equal(calendar.todayIndex, 30);
  }
});

test('yesterday remains editable across month, year, and leap boundaries', () => {
  const cases = [
    ['2026-01-01T00:00:00Z', '2025-12-31', 31],
    ['2024-03-01T00:00:00Z', '2024-02-29', 31],
    ['2025-03-01T00:00:00Z', '2025-02-28', 31],
    ['2024-02-29T23:59:59Z', '2024-02-28', 29],
    ['2026-04-01T00:00:00Z', '2026-03-31', 30],
  ];
  for (const [instant, yesterday, monthDays] of cases) {
    const now = new Date(instant);
    const calendar = utcCalendar(now);
    assert.equal(calendar.yesterday, yesterday);
    assert.equal(calendar.monthDays, monthDays);
    assert.equal(calendar.yesterdayOutsideMonth, calendar.todayIndex === 0);
    assert.equal(canEditUtcDate(yesterday, now), true);
    assert.equal(canEditUtcDate(calendar.today, now), true);
    assert.equal(canEditUtcDate('2000-01-01', now), false);
    assert.equal(canEditUtcDate('2099-01-01', now), false);
  }
});

test('edit window advances at UTC midnight and timer targets that boundary', () => {
  const before = new Date('2026-12-31T23:59:59.900Z');
  const after = new Date('2027-01-01T00:00:00Z');
  assert.equal(millisecondsUntilNextUtcDay(before), 100);
  assert.equal(millisecondsUntilNextUtcDay(after), 86_400_000);
  assert.equal(canEditUtcDate('2026-12-30', before), true);
  assert.equal(canEditUtcDate('2026-12-30', after), false);
  assert.equal(canEditUtcDate('2027-01-01', before), false);
  assert.equal(canEditUtcDate('2027-01-01', after), true);
});
