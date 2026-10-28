# Free monthly cycles — Batch 1

Updated October 28, 2026. Implementation and review record, not a public-release
approval. Payments remain disabled. The founder approved deployment and a new
TestFlight candidate on October 28. The single migration is now deployed and
verified on production PostgreSQL 17.6. Commito 1.0.2 (30) is being prepared;
installed build 29 does not contain the history panel.

## Product rules

- Use UTC calendar months: 28, 29, 30 or 31 days. The old May launch plan's
  fixed 30-day wording is superseded by the current free strategy.
- Continue automatically in the same league, with the same members and invite
  code. There is no renewal purchase, recreated league or destructive log reset.
- Show the new month's grid immediately on day 1. Existing dated logs remain;
  the grid reads only the new month's dates.
- Keep the existing today/yesterday correction window. On day 1, the separate
  yesterday control edits the previous month's final day. Those results are
  provisional until **00:00 UTC on day 2**, as confirmed by the founder.
- Rank completed days descending, then display name ascending, then member UUID
  ascending. Positions are unique ordinals; longest streak is descriptive and
  does not break ties. Only `completed=true` rows count. Streaks use consecutive
  dates within that month.
- Name ordering now uses a stable Unicode order in the current Ranking screen
  and PostgreSQL `COLLATE "C"` for saved results. This removes device-locale
  differences; case/accent ties can differ from the old `localeCompare` order.
- New members do not acquire results for months before joining. The existing
  day-1/yesterday exception remains: a member joining on day 1 who records the
  previous final day is included in that provisional month.
- Final results are read only. Deleting an account still removes its personal
  logs/results; deleting an owner still removes their league and shared history,
  as the existing deletion warning explains. Surviving historical ranks are not
  renumbered after personal-data deletion.

## What already existed and what changed

UTC rollover, a correctly sized monthly grid, dated check-ins, same-league
continuation, the yesterday correction control, invitations through native
sharing, and duplicate-join protection already existed. This batch reuses them.

New work adds a month label, compact expandable **Past results**, pagination,
provisional/final status, server-calculated completed days and longest streaks,
and protected historical snapshots. No visual redesign or paid code was added.

Invitation-after-signup improvements and actual engagement instrumentation
remain for Batch 2. Weekly recap, reminder-time preferences, nudges, and voluntary
achievement sharing remain later batches. Existing analytics tables do not prove
that app events are being measured.

## Database and app boundary

`supabase/migrations/20261028_free_monthly_cycles.sql` adds:

- `free_league_cycles` and `free_league_cycle_results`, with RLS and member-only
  reads. App roles cannot insert, change or delete snapshots directly.
- `get_free_league_history(uuid,date,integer)`, authenticated and membership
  checked, free leagues only. It returns previous months newest first, at most
  24 per call (the app requests 12), with an exclusive pagination cursor.
- Private calculation/finalization helpers inaccessible to app/service roles.
- A free-league log trigger enforcing the actual UTC edit window after obtaining
  the same transaction lock used for finalization. It checks both original and
  replacement dates/leagues; account/league deletion cascades still work.
- A profile-name trigger that snapshots any unsaved closed periods before a
  rename can change their tie ordering. It skips existing snapshots. Exceptional
  imports older than 100 years or edits requiring more than 240 new snapshots
  reject with `history_backfill_required`, rather than silently changing old
  results. Such exceptional data needs an operator-reviewed backfill.

Snapshots are materialized when a member first requests a closed month, or
before a relevant profile rename. No scheduled task is needed for correctness:
the log guard locks past dates even when nobody has viewed history. The new
month does not wait for snapshot generation. First-time historical backfill uses
retained logs and the available roster/names; it cannot recover names, activity
or memberships already deleted before this feature existed.

Legacy paid settlement is deliberately unused: it closes a league and creates
financial records. Existing `v_month_results` / `v_member_month_stats` are also
unused for this feature: inspection found false-row counting and streak issues.
This batch does not certify or change those dormant legacy calculations.

`MONTHLY_RESULTS_AVAILABLE` was kept false until deployment was approved and
verified. It is now **true** for the build-30 candidate. The hook makes no
history requests while disabled. New history is
cleared on account/league/day changes; late responses cannot publish into the
new scope. Loading errors show a retry, not fabricated results. Returned display
fields and numeric results are validated before rendering.

## Executed verification

- TypeScript and repository lint pass. All 43 current Node tests pass, including
  calendar/result parsing, 12 history-hook cases and prior authentication/storage
  regression tests.
- Isolated PostgreSQL clone of the captured live schema, with synthetic data:
  migration applies atomically; expanded `monthly_cycles.sql` passes, covering
  leap/non-leap February, year change, UTC cutoff in a non-UTC DB session,
  day-1 corrections, subsequent-month saves, ties, interrupted streaks, false
  rows, pagination, permissions, repeat finalization, rename protection,
  exceptional backfill rejection, and deletion cascades.
- All five prior SQL security suites pass with the migration installed: free
  joins, profile privacy, purchase verification access, account deletion, and
  check-in authorization. Fixtures roll back.
- `monthly-cycle-concurrency.mjs` passes using competing local SQL connections:
  finalization waits for a correction and includes it after commit; an edit
  waiting behind finalization rejects after the snapshot commits. This test is
  hardwired to the disposable localhost database family, never linked Supabase.
  Its competing writer uses the database-owner role to exercise the new guard;
  authenticated RLS is tested separately with real current dates.
- Independent agents reviewed the migration and screen integration. Hook tests
  exercise late responses, sign-out, account changes, UTC-day changes, retry,
  pagination, refresh and unmount. Synthetic browser component checks cover
  collapsed/open state, supplied ranks, read-only status, loading/error/empty
  states, narrow layout and pagination controls.

Boundaries: browser checks mock React Native primitives, and the hook tests use
a deterministic hook scheduler. These are not iPhone or VoiceOver tests. The
isolated database is PostgreSQL 18; production is PostgreSQL 17.6. The deployed
function bodies, permissions and member/outsider history access were separately
verified on that target. Adversarial
multi-league writes can deadlock and abort; the current app writes one check-in
at a time. The tested two-connection scenario does not establish every possible
concurrent schedule.

## Deployment evidence and remaining release checks

- Approval received October 28 for this batch's production migration and
  TestFlight preparation; no public App Store release or Batch 2 approval.
- Fresh live schema matched the tested baseline: 27 existing public functions,
  29 policies and 499 table grants. The read-only API route hides grant metadata
  for its restricted role; the definitive comparison used the management role
  inside a SQL read-only transaction rather than discarding the grant check.
- Applied only `20261028_free_monthly_cycles.sql` in one transaction, with an
  exact baseline guard, short lock timeout, migration-history record and
  PostgREST schema reload. No old migration was replayed.
- Fresh requests verified seven exact function bodies, both new RLS tables and
  triggers, authenticated-only RPC execution, inaccessible private helpers and
  no direct snapshot writes. All previous public definitions/policies/grants
  remained unchanged after filtering only the intended additions.
- A live rollback-only functional transaction verified member history access and
  outsider rejection; it left no snapshots or account/activity changes behind.
- Recovery metadata and the tested disable script were saved outside the repo.
  Supabase reported no listed completed backups and PITR disabled. This was an
  additive schema deployment with a non-destructive disable rollback; a verified
  full-data restore point was not established. Automatic approval review rejected
  a proposed local user-data export as outside deployment authorization. That
  command did not run, and no user records were exported afterward.

The rollout sequence is retained below for reference. Steps 1–2 are complete;
the flag is enabled for build 30, with binary upload and iPhone checks pending.

1. Review and explicitly approve the **single new migration**; do not replay the
   old migration directory. Freshly compare live schema/grants/policies against
   the captured baseline and check backup/recovery before applying it.
2. After approval, apply only this migration transactionally. Verify from a new
   connection: table policies/grants, RPC/private helper grants, trigger bodies,
   member history access, outsider rejection and unchanged current check-ins.
3. Enable the history flag only after backend verification, then create a new
   TestFlight candidate. Build 29 and the installed app do not update themselves
   from these local files.
4. Check the actual iPhone layout, retry after network loss, same-league second
   cycle, day-1 correction and day-2 finality using an isolated test environment
   with an operator-controlled clock. Do not change the live clock or fake the
   phone date against production. Record native results separately.

If verification fails, keep/restore the flag to false and stop the new app
rollout. The prepared operator rollback is
`supabase/rollback/20261028_free_monthly_cycles_disable.sql`: it revokes history
execution and removes the two new triggers while retaining all logs, tables,
and snapshots. It also requires explicit deployment approval; do not execute
it casually. Re-enabling afterward needs a targeted reviewed repair script,
not replaying the table-creation migration. The rollback was verified in a
separate disposable clone; current-date security assertions still pass there.

Batch 2 and public release are not approved by this record. Existing public
release blockers, including provider deletion/revocation, abuse safeguards,
email delivery, privacy disclosures and native release checks, remain tracked
in the launch/security documentation.
