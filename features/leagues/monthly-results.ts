export type MonthlyResult = {
  user_id: string;
  display_name: string;
  days_completed: number;
  longest_streak: number;
  position: number;
};

export type MonthlyCycle = {
  month_start: string;
  status: "provisional" | "final";
  finalizes_at: string;
  results: MonthlyResult[];
};

/** Reject incompatible responses before they reach the results renderer. */
export function parseMonthlyCycles(value: unknown): MonthlyCycle[] {
  const invalid = () => { throw new Error("Invalid monthly history response"); };
  if (!Array.isArray(value)) return invalid();
  const months = new Set<string>();
  return value.map((cycle) => {
    if (!cycle || typeof cycle !== "object" || typeof cycle.month_start !== "string"
      || !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(cycle.month_start)
      || months.has(cycle.month_start)
      || !["provisional", "final"].includes(cycle.status)
      || typeof cycle.finalizes_at !== "string" || !Number.isFinite(Date.parse(cycle.finalizes_at))
      || !Array.isArray(cycle.results)) return invalid();
    months.add(cycle.month_start);
    const users = new Set<string>();
    const positions = new Set<number>();
    const results = cycle.results.map((result: MonthlyResult) => {
      if (!result || typeof result.user_id !== "string" || !result.user_id || users.has(result.user_id)
        || typeof result.display_name !== "string"
        || !Number.isInteger(result.days_completed) || result.days_completed < 0 || result.days_completed > 31
        || !Number.isInteger(result.longest_streak) || result.longest_streak < 0 || result.longest_streak > result.days_completed
        || !Number.isInteger(result.position) || result.position < 1 || positions.has(result.position)) return invalid();
      users.add(result.user_id);
      positions.add(result.position);
      return { user_id: result.user_id, display_name: result.display_name, days_completed: result.days_completed,
        longest_streak: result.longest_streak, position: result.position };
    });
    return { month_start: cycle.month_start, status: cycle.status, finalizes_at: cycle.finalizes_at, results };
  });
}

/** Match PostgreSQL UTF-8 COLLATE "C", independent of a phone's locale. */
export function compareRankNames(a: string, b: string): number {
  const left = Array.from(a, (char) => char.codePointAt(0)!);
  const right = Array.from(b, (char) => char.codePointAt(0)!);
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return left.length - right.length;
}

/** Calendar-only display helper. Scores and final ranks always come from RPC. */
export function formatUtcMonth(monthStart: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(monthStart)) throw new Error("Invalid month");
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${monthStart}T00:00:00Z`));
}
