# Weekly recaps and reminder controls — Batch 3

October 29, 2026. The founder approved local implementation. This record does
not authorize production migration, website publication, a TestFlight upload
or a public App Store release. Payments and Batch 4 remain outside this work.

## Behavior and rules

Weekly recap is a league-menu action, not another panel above the members.
It shows the most recent complete Monday–Sunday UTC week: each member's
completed days, total member check-ins, distinct group-active days and a short
encouraging message. Two members completing the same day count as two member
check-ins and one group-active day. Identical names never merge accounts.

Sunday remains correctable throughout Monday under the existing UTC rule.
The recap is provisional on Monday; that window closes Tuesday 00:00 UTC.
This changes no monthly ranking or check-in rule. It summarizes retained
activity/current members, not immutable awards: corrections, membership changes
and deletion can change counts. A new league may have no last-week activity.

The recap loads on opening and refreshes on foreground/UTC day rollover while
open. Closing or changing league/account invalidates old requests. RPC calls
use the initiating session's explicit token. Errors clear results and offer
retry rather than showing fabricated zero activity.

Settings gains **Daily reminder**, with an on/off switch and 24-hour local
time fields. The existing default stays 17:00. Preferences are device-wide,
stored locally with the existing AsyncStorage dependency and clearly described
as shared across accounts in this installation. One reminder serves all leagues.
Signing out cancels daily/test reminders without deleting the preference.

Launch/foreground never prompts for notification permission. Saving an enabled
reminder may explicitly ask; refusal preserves the time and explains phone
settings. Core app use never depends on permission. Foreground reconciliation
checks permission/timezone, repairs legacy duplicates and retries scheduling.
Storage/cancellation/scheduling failures show an error. Unrelated notifications
remain. Work is serialized and account changes invalidate pending schedules.

iOS uses a repeating calendar trigger without a fixed timezone; Android uses
the installed Expo DAILY trigger and existing channel. IANA timezone changes
are reconciled on foreground. The OS controls actual delivery, including Focus
and battery restrictions. DST/travel/background delivery remains device-untested.

## Implementation and deployment boundary

- `features/leagues/weekly-recap.ts`, `use-weekly-recap.ts`,
  `components/WeeklyRecap.tsx`: response validation, scoped loading, recap UI.
- `components/AccountMenuSheet.tsx` and the existing league screen: menu entry;
  current member cards, grid and ranking layout remain unchanged.
- `features/notifications/local.ts`, `reminder-controller.ts`,
  `components/ReminderSettings.tsx`, `app/_layout.tsx`: preferences, native
  adapters, error handling and lifecycle integration. No new dependency/service.
- `supabase/migrations/20261029120000_weekly_recaps.sql`: adds only
  `get_free_league_weekly_recap(uuid)`. No tables, existing functions, policies,
  existing grants or saved data change. SECURITY DEFINER has an empty search
  path and identity/member/free-league checks. Only authenticated users receive
  execution; anon/service roles do not. The response contains only display
  names, member IDs, week/status and counts; no emails or invite codes.
- The matching rollback script drops only this RPC and deletes no user data.
- Both local privacy sources describe preferences and older fixed-time builds.
  These disclosure changes have not been published to the hosted site.

`WEEKLY_RECAP_AVAILABLE=false` hides the menu until the exact RPC is deployed
and verified. Tests exercise the implementation directly. Enable the flag only
for a reviewed candidate after backend verification. Existing TestFlight build
34 receives none of these local changes.

Before approved deployment, repeat a fresh schema/function/grant/policy/history
comparison; never replay old migrations. Read-only production preflight found
28 public functions, history through `20261029100000`, and the new RPC absent.

## Verification and remaining boundaries

- Automated: parser/request/hook checks cover invalid dates/counts, equal names,
  correction status, token pinning, stale success/error, account replacement,
  sign-out, retry, foreground and UTC-day refresh. Reminder controller/native
  adapter checks cover deduplication, permission refusal, timezone changes,
  persistence/cancellation/scheduling failure, corrupt preference recovery and
  account/test-notification races. Final full run: **105 Node tests passed**;
  TypeScript, full ESLint and `git diff --check` passed. These are automated
  checks, not actual native scheduling or rendering results.
- Isolated database: all nine suites passed in synthetic
  `commito_weekly_batch3_20261029`: recap, repeated names, deletion, free joins,
  profile privacy, purchase-access denial, check-in authorization, monthly
  cycles and engagement. Recap cases include leap day, year boundaries,
  session timezones, Monday correction, Tuesday cutoff, next-Monday rollover,
  zero/late members, anonymous/nonmember/paid denial and response-field limits.
  Fixtures/clocks roll back; the genuine clock was verified afterward.
- Recovery: the actual disable script passed in a separate isolated clone.
  Metadata found only the new RPC added; rollback restored prior public
  metadata. Local PG18 adds NOT NULL catalog entries compared with live PG17;
  these known version differences were identified, not mistaken for policy drift.
- Independent review: another agent reviewed recap loading, menu/root wiring,
  notifications and SQL, and executed 25 focused Node tests. It did not run SQL
  independently or test native rendering. It flagged reminder-keyboard
  avoidance. The correction adds iOS keyboard avoidance, an explicit keyboard
  dismissal action and accessibility escape. Follow-up independent review ran
  all four actual-component handler tests successfully. Native keyboard layout
  remains unverified. The lesson check also exercised dismissal/escape while
  a save was pending, rather than only the original idle-editing scenario.
- Live backend: read-only preflight only; no Batch-3 migration applied.
- Device: no Batch-3 results. Earlier sign-in/invitation/monthly/rename passes
  remain separate evidence. No broader release-readiness claim is made.

Primary self-assessment checked the final callers, RPC authorization, response
contract, native adapter and diff against the approved scope. No member-card
layout, paid flow or live setting change was introduced. Mocked tests, local
PostgreSQL and independent code review do not replace post-deployment checks
or an iPhone pass. Deployment and delivery remain the next approval decision.

Pending iPhone checks after approved deployment/candidate delivery:

- Open recap; verify the labelled week/counts and Monday provisional status.
  Close/reopen, change accounts, try offline retry and foreground refresh.
- Edit time with the keyboard open, reach Save/Close, reopen controls and check
  a small screen, larger text and VoiceOver.
- Allow/deny permission, change time, disable, sign out/reopen and re-enable.
  Observe actual delivery without duplicates.
- Change timezone and return to Commito; verify local-time scheduling. Keep
  DST/background delivery unverified until observed.

Public release still depends on the existing security, abuse prevention,
email delivery, backup/recovery and App Store gates.
