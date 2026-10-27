/** League days follow the backend's UTC calendar, regardless of device timezone. */
export function utcDateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function utcCalendar(now: Date = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const today = utcDateKey(now);
  const yesterday = utcDateKey(new Date(Date.UTC(year, month, now.getUTCDate() - 1)));
  const start = utcDateKey(new Date(Date.UTC(year, month, 1)));
  const end = utcDateKey(new Date(Date.UTC(year, month + 1, 0)));
  return {
    year, month, today, yesterday, start, end,
    todayIndex: now.getUTCDate() - 1,
    monthDays: Number(end.slice(8, 10)),
    yesterdayOutsideMonth: yesterday < start,
  };
}

export function canEditUtcDate(dateKey: string, now: Date = new Date()): boolean {
  const { today, yesterday } = utcCalendar(now);
  return dateKey === today || dateKey === yesterday;
}

export function millisecondsUntilNextUtcDay(now: Date = new Date()): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime();
}
