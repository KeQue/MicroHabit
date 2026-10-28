export class StaleJoinAttempt extends Error {
  constructor() {
    super("This invitation changed. Try joining again.");
    this.name = "StaleJoinAttempt";
  }
}

export type JoinSession = { userId: string; accessToken: string; email: string | null };

/** Check account/navigation identity on both sides of every asynchronous step. */
export async function runFreeJoin<T extends { id: string; is_free: boolean | null }>(options: {
  userId: string;
  code: string;
  isCurrent: () => boolean;
  session: () => Promise<JoinSession>;
  ensureProfile: (session: JoinSession) => Promise<void>;
  join: (code: string, session: JoinSession) => Promise<string>;
  readLeague: (id: string, session: JoinSession) => Promise<T>;
}): Promise<T> {
  const check = () => { if (!options.isCurrent()) throw new StaleJoinAttempt(); };
  check();
  const session = await options.session();
  check();
  if (session.userId !== options.userId || !session.accessToken) throw new Error("Sign in again before joining this league.");
  await options.ensureProfile(session);
  check();
  const id = await options.join(options.code, session);
  check();
  if (!id) throw new Error("Could not join this league. Try again.");
  const league = await options.readLeague(id, session);
  check();
  if (league.id !== id || league.is_free !== true) throw new Error("This version supports free leagues only.");
  return league;
}
