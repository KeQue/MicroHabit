# Invitations and engagement measurement — Batch 2

October 28, 2026. The founder explicitly approved this reporting migration and
a new TestFlight build after reviewing the local implementation. The single
migration committed at 21:59:39 UTC and was verified from fresh requests.
Commito 1.0.2 (34) is built and uploaded with published HTTPS invitations; build 33
still shares the app-only address. Installed build 31 lacks the Batch-2
invitation changes. The next
retention batch and a public App Store release are outside this approval.

Superseded build-32 source: `6e215b66c2297eeda92b067c3393b4449d0a2fd0`.
The [build-32 job](https://expo.dev/accounts/keke12/projects/microhabit/builds/548fbc21-2c05-40bc-b1e0-faac54d7fe61)
finished at 22:09:05 UTC. Its
[automatic TestFlight submission](https://expo.dev/accounts/keke12/projects/microhabit/submissions/4c6e6268-78aa-4901-9014-acde8fcff471)
was verified `FINISHED` at 22:11:12 UTC, using existing credentials and App
Store Connect app ID 6759626676. Final review found that editing a prefilled
code detached Back/success cleanup from its original pending invitation. A new
screen-handler test failed before the fix. Cleanup now uses the route's nonce
and preserves newer intents. Build 32 had already uploaded before cancellation
was attempted; it is superseded by build 33. This is an app-only correction:
the verified database migration was not changed or reapplied.

Corrected source checkpoint: `f8830071ed4058781091bbaf3e6f65ea9143596e`.
The [build-33 job](https://expo.dev/accounts/keke12/projects/microhabit/builds/d73bd69c-f393-4580-b672-c1af9c209f06)
finished at 22:19:00 UTC. Its
[automatic TestFlight submission](https://expo.dev/accounts/keke12/projects/microhabit/submissions/06be5e43-68ed-454f-98f8-5d86707b57f6)
was verified `FINISHED` at 22:19:25 UTC. The expected version, build and corrected
source identity were verified, and a binary is available. This establishes
build/upload completion, not Apple processing, actual iPhone installation,
native invitation behavior or public-release readiness. Use build 33 rather
than superseded build 32 for testing.

## Observable outcome

### Follow-up: published web invitations / build 34

The founder reports build 33's `microhabit:///` address is unclickable both in
the app's preview and after sending the shared message. The preview was plain
Text. A valid app-only address does not make it a usable messenger link.

The approved fix shortens the message and shares
`https://keque.github.io/MicroHabit/join/?code=…`. Its preview uses an explicit
accessible link handler; native iOS sharing also receives the URL separately.
The new static `docs/join/index.html` and `invite.js` show a code, Open Commito
and Copy invite code. They perform no account/league lookup or automatic join.
The Open button uses the exact existing native URI validated by the app.
Missing installation or blocked clipboard/browser handoff retains manual code
entry. No store URL, new domain, analytics service or universal-link entitlement
is introduced. This is a web page with an explicit app button, not a promise of
one-tap universal linking or retaining a code automatically through installation.

The founder approved publishing the page and a new TestFlight build. Pages
configuration was inspected: source `main`, directory `/docs`. A separate
[website-only commit](https://github.com/KeQue/MicroHabit/commit/59c847eda6b200345445627e98c53e520e6de415)
updates exactly four files: the invitation HTML/JS and both privacy sources.
It is based on remote `ba145724ad2f3b1aaf24325bd776f3903867265b`, with a guarded
fast-forward of `main`; no app branch or unrelated app work was merged/pushed.
GitHub reports this exact Pages commit built successfully. Fresh HTTPS requests
to the invitation HTML, script and privacy page all returned 200 and matched
the reviewed source after line-ending normalization. The script is served as
JavaScript. Privacy now describes GitHub hosting, URL codes and aggregate usage.

Only after those checks, `INVITE_WEB_PAGE_AVAILABLE=true` was set for build 34.
Installed build 33 is unchanged. Turning the flag off keeps manual code sharing
and omits a web link; do not remove a published page while shared links use it.
Any recovery should restore a reviewed safe page at the same address, preserving
the code fallback, rather than reset `main` or overwrite unrelated updates.

Verification: all 76 Node tests pass, as do TypeScript and full ESLint. New
checks cover web-sharing enabled/disabled, explicit app address matching the
installed Expo builder, invalid/duplicate input and clipboard failure. Actual
Chrome with device viewport overrides at 320px and 390px loaded both the local
and now-public HTTPS page/script under its content security policy, displayed
the expected app button and showed no horizontal overflow. The live test used
only synthetic `ABC234`, performed no account lookup and created no membership.
This does not prove iOS app handoff, native preview touches, VoiceOver or
messenger auto-linking; these remain device checks for build 34. No database
change or public App Store release was performed for this fix.

The native candidate preserves the app identity, sign-in validation, join RPC,
league rules and paid-disabled flag. Test sharing afresh from build 34; old
messages containing `microhabit:///` do not change automatically.

Build-34 source checkpoint: `c281ef118d9741649418cfecaf2e1649e68c1fba`.
The [Expo build](https://expo.dev/accounts/keke12/projects/microhabit/builds/d67b95e7-f669-4e24-9a36-abed15de1961)
finished at 22:52:33 UTC on October 28. Its
[automatic TestFlight submission](https://expo.dev/accounts/keke12/projects/microhabit/submissions/63f2ebb1-5bfe-4d36-963c-2bd39c23df33)
was verified `FINISHED` at 22:52:57 UTC. The version, build and exact source
identity match, and a binary is available. This verifies Expo build and Apple
upload completion, not Apple processing or actual installation. On October 29,
the founder confirmed on their iPhone that the live page's Open Commito button
opened the Join screen with the expected invite code prefilled. This is a narrow
web-to-app handoff pass: the installed build, initial sign-in state, new native
share payload, preview link and messenger entry path were not separately
confirmed. Signed-out signup/join and other pending device checks remain open.
No new database work was performed.

A friend can share an invitation through the existing native Share sheet.
The message contains a readable code, an installed-app link, and manual
signup/code instructions. The existing purple league screen is preserved.
The longer message preview scrolls so its action buttons stay accessible.
No WhatsApp-specific integration or analytics SDK was added.

An invitation opened before sign-in is remembered on that device for up to
seven days, including through signup and email confirmation. After ordinary
sign-in, the Join screen is prefilled. Membership still requires an explicit
**Join league** tap. Password recovery takes priority. Successful joining or
explicit Back clears that invitation; sign-out, account replacement and
successful account deletion also clear it. A late request cannot clear a newer
invitation or display the previous account's join result. Failed local storage
does not block normal sign-in; the user can enter the code manually.

The pending record uses the existing protected native storage adapter under a
separate key; it does not change session/PKCE credentials. Web uses the existing
web storage fallback. New link validation uses the installed Expo URL builder,
including the native triple-slash address and exact Expo Go host/port.

This is an installed-app custom-scheme link, **not** a universal or deferred
installation link. Some messaging apps may not make it clickable. Without an
installed app the recipient must keep the readable code, install Commito when
available, sign up, and enter it. No public store URL/domain was invented.

Joining continues to use the existing authenticated, free-only server function.
Its unique membership constraint and conflict handling prevent duplicate
memberships and preserve original join dates. Profile/join/read requests use
the initiating session's explicit authorization token, with account and request
checks around each awaited step. A request already received by the server may
finish for its original account after navigation; it cannot become a join for
a different account. An interrupted post-join read can be retried safely.
Dormant paid acceptance controls were removed from this screen; paid access
remains rejected by the existing server boundary.

## Minimum measurement

The prepared operator-only report reads existing saved free-league records.
It returns counts, not names, emails, user/league IDs, habit text or invite codes.
There is no app-callable report, new collector, additional personal-data table,
or third-party tracking dependency. Private output is not a claim that the
underlying records are anonymous. Both local privacy-policy sources describe
this purpose; their hosted version has **not** been published by this work.

| Measure | Definition and practical limit |
| --- | --- |
| Leagues created | Retained free leagues, grouped by UTC creation month. |
| Invitations accepted | Retained noncreator memberships by original join time: a **join proxy**, not delivery/click attribution. |
| Daily check-ins | Saved member/league days marked complete; false rows, toggles and app opens are not counted. |
| Activation | At least two distinct participants each complete a day during the first seven UTC creation dates. Fully observed at 00:00 UTC on creation date + 8, after the last correction day; provisional cohorts are separate. |
| Weekly engagement | At least one participant completes a day in a Monday–Sunday UTC week. Socially active requires two participants. Partial weeks and their correction window are flagged. |
| Completed monthly cycles | All elapsed league/calendar months after the day-2 finality cutoff, plus a separate count with actual activity. Independent of whether someone opened Past results. |
| Monthly continuation | A league has a completed day in each of two consecutive months. Numerator and prior active-league denominator are supplied. |
| Returning members | The same user/league pair completes a day in consecutive months. Unchanged membership alone is not a rejoin. |

The report covers the latest 12 UTC months and 12 weeks. Follow-up months are
marked future, partial, correction-window or complete. Compare closed cohorts
for retention; do not treat an unfinished follow-up month as a final failure.
Operator-supplied test/reviewer league exclusions are supported but not guessed.

These are **retained-state** measurements, not immutable lifetime analytics.
Undo, membership/account/owner deletion and subsequent edits can change counts.
The optional report cutoff controls windows/maturity; it cannot reconstruct
historical database state. Current completed check-ins are therefore useful for
product validation, but this does not measure screen opens, share deliveries,
notification impressions, or users who installed and never joined.

## Approved database deployment

`supabase/migrations/20261028210000_private_engagement.sql` adds only the private
operator report and closes unused app access to `public.analytics_events`.
The existing anonymous/authenticated insert policy allowed arbitrary event
names/data, so that table is unsuitable as product evidence. Existing records
and operator/service grants are preserved. App SELECT was already blocked by
RLS; this finding does **not** establish that ordinary clients could read it.

Before preparing this migration, fresh schema-only production metadata matched
the verified Batch-1 baseline. No user records were read for this batch.
The approved deployment repeated that comparison immediately before applying
only this migration in a guarded transaction, with a five-second lock timeout
and an explicit migration-history record. No historical migration was replayed.
The app's invitation changes do not depend on this report being installed.

`supabase/reports/free_engagement.sql` is the read-only operator entry point with
a 30-second timeout. Never place operator credentials in the app. The disable
script under `supabase/rollback` removes the report and preserves saved activity.
It deliberately keeps the unused client event writer closed; restoring those
permissions would require separately reviewed baseline recovery. This is not
a full data-backup/restore procedure.

## Verification and remaining boundaries

- Automated: TypeScript and full ESLint passed. 73 Node tests passed, including
  installed Expo link generation, strict parser, storage/account/expiry races,
  password-recovery navigation priority, actual screen-handler retry/duplicate/
  account-switch behavior, explicit SDK token preservation, and existing auth,
  protected storage, UTC/calendar and monthly-history regressions.
- Isolated database: the new migration and engagement suite passed in local
  synthetic `commito_engagement_batch2`, cloned from the verified Batch-1 schema.
  All six existing SQL suites also passed there: deletion, free joining,
  shared-profile privacy, legacy purchase access, check-in authorization and
  monthly cycles. Fixtures roll back. Separate permission checks found no app
  column privileges on the unused event table and confirmed the genuine clock.
  The disable script also passed in a separate disposable recovery clone:
  report removed, unused writer still closed, existing joining preserved.
- Live backend: the approved migration `20261028210000` is committed. Fresh
  requests verified its exact report body, empty search path, invoker execution,
  and denied report execution for anon/authenticated/service roles. Unused app
  event writes are denied; existing service event permissions are preserved.
  All 28 public function definitions, previous private helpers, RLS, constraints
  and user triggers are unchanged. Only the intended event-table grants/policy
  and new migration-history entry differ. A read-only operator report shape
  check returned 12 weeks, 12 months and 12 activation cohorts with no UUID
  fields. No user rows were exported, no settings changed and no public release
  was performed. These checks do not establish real-device joining behavior.
- Recovery: protected before/after schema and permission metadata, migration,
  transaction and tested disable script were retained outside the repository.
  The fresh managed backup response still lists zero completed backups and PITR
  disabled. No full-data restore point or user-data export was established.
- Founder device results: earlier monthly-history and sign-in results remain
  separate evidence. These invitation changes are not in TestFlight build 31
  and have not been tested on an actual iPhone.
- Review: implementation agents supplied scoped modules and SQL fixture results.
  Their final independent review was interrupted by the session usage limit.
  The primary agent reviewed the final callers, permissions and failure states
  using the self-assessment workflow; no completed independent final review is
  claimed.

Before shipping this batch, verify real iPhone cold/warm invitation opening,
signed-out signup/confirmation, both social providers, recovery priority,
native sharing, duplicate joins, and the small-screen message preview. Public
launch still depends on the existing security, abuse prevention, email,
privacy, recovery and App Store gates. Weekly recaps/reminder preferences and
later nudges/achievements are outside this batch.
