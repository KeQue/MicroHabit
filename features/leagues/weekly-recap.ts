export type WeeklyRecap = {
  week_start: string;
  week_end: string;
  provisional: boolean;
  finalizes_at: string;
  generated_at: string;
  total_member_days: number;
  group_active_days: number;
  members: { user_id: string; display_name: string; active_days: number }[];
};

const DAY = 86_400_000;
const dateKey = (value: unknown): value is string => typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const count = (value: unknown, max: number): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= max;

/** Presentation only: authoritative week/counts come from the member-only RPC. */
export function parseWeeklyRecap(value: unknown): WeeklyRecap {
  const invalid = (): never => { throw new Error("Invalid weekly recap response"); };
  if (!value || typeof value !== "object") return invalid();
  const v = value as WeeklyRecap;
  if (!dateKey(v.week_start) || !dateKey(v.week_end) ||
    new Date(`${v.week_start}T00:00:00Z`).getUTCDay() !== 1 ||
    Date.parse(v.week_end) - Date.parse(v.week_start) !== 6 * DAY ||
    typeof v.provisional !== "boolean" ||
    typeof v.finalizes_at !== "string" || !v.finalizes_at.endsWith("Z") ||
    Date.parse(v.finalizes_at) !== Date.parse(v.week_start) + 8 * DAY ||
    typeof v.generated_at !== "string" || !v.generated_at.endsWith("Z") ||
    !Number.isFinite(Date.parse(v.generated_at)) ||
    v.provisional !== (Date.parse(v.generated_at) < Date.parse(v.finalizes_at)) ||
    Date.parse(v.generated_at) < Date.parse(v.week_start) + 7 * DAY ||
    Date.parse(v.generated_at) >= Date.parse(v.week_start) + 14 * DAY ||
    !count(v.total_member_days, Number.MAX_SAFE_INTEGER) || !count(v.group_active_days, 7) ||
    v.group_active_days > v.total_member_days || !Array.isArray(v.members)) return invalid();
  const ids = new Set<string>();
  const members = v.members.map((member) => {
    if (!member || typeof member.user_id !== "string" ||
      !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(member.user_id) ||
      ids.has(member.user_id) || typeof member.display_name !== "string" ||
      !count(member.active_days, 7) || member.active_days > v.group_active_days) return invalid();
    ids.add(member.user_id);
    return { user_id: member.user_id, display_name: member.display_name, active_days: member.active_days };
  });
  if (members.reduce((sum, member) => sum + member.active_days, 0) !== v.total_member_days) return invalid();
  return { week_start: v.week_start, week_end: v.week_end, provisional: v.provisional,
    finalizes_at: v.finalizes_at, generated_at: v.generated_at,
    total_member_days: v.total_member_days, group_active_days: v.group_active_days, members };
}

export function weeklyRecapDateLabel(date: string): string {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00Z`));
}

/** Compact display only; UTC week boundaries and scores still come from RPC. */
export function weeklyRecapRangeLabel(start: string, end: string): string {
  const first = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  const month = (date: Date) => new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(date);
  if (first.getUTCFullYear() !== last.getUTCFullYear()) {
    return `${first.getUTCDate()} ${month(first)} ${first.getUTCFullYear()} – ${last.getUTCDate()} ${month(last)} ${last.getUTCFullYear()} · UTC`;
  }
  const firstLabel = first.getUTCMonth() === last.getUTCMonth()
    ? String(first.getUTCDate()) : `${first.getUTCDate()} ${month(first)}`;
  return `${firstLabel}–${last.getUTCDate()} ${month(last)} ${last.getUTCFullYear()} · UTC`;
}

/** Invalidate before any await; late success/failure cannot publish an old scope. */
export function createRecapRequest<T>(publish: (value: { data: T | null; loading: boolean; error: boolean }) => void) {
  let generation = 0;
  return {
    cancel() { generation++; },
    async load(fetch: () => Promise<T>) {
      const request = ++generation;
      publish({ data: null, loading: true, error: false });
      try {
        const data = await fetch();
        if (request === generation) publish({ data, loading: false, error: false });
      } catch {
        if (request === generation) publish({ data: null, loading: false, error: true });
      }
    },
  };
}
