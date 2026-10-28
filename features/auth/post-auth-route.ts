import type { PendingInvite } from "../invitations/invite";

type RouteState = {
  userId: string | null;
  initializing: boolean;
  initialLinkChecked: boolean;
  processingAuthLink: boolean;
  passwordRecovery: boolean;
  pendingReady: boolean;
  pending: PendingInvite | null;
  segments: readonly string[];
  lastOffered: string | null;
};
export type PostAuthRoute = "sign-in" | "update-password" | "app" |
  { code: string; nonce: string; offeredKey: string } | null;

/** One navigation owner prevents auth success from overwriting an invitation. */
export function postAuthRoute(state: RouteState): PostAuthRoute {
  if (state.initializing || !state.initialLinkChecked || state.processingAuthLink || !state.pendingReady) return null;
  const group = state.segments[0];
  const updatingPassword = state.segments.join("/") === "(auth)/update-password";
  if (!state.userId) return group === "(auth)" ? null : "sign-in";
  if (state.passwordRecovery) return updatingPassword ? null : "update-password";
  // Completing recovery remains an explicit action on the password screen.
  if (updatingPassword) return null;
  const invite = state.pending;
  if (invite?.userId === state.userId) {
    const offeredKey = `${state.userId}:${invite.nonce}`;
    if (state.lastOffered !== offeredKey) return { code: invite.code, nonce: invite.nonce, offeredKey };
  }
  return group === "(app)" ? null : "app";
}
