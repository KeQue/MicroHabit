# Commito beta smoke test

Use this checklist to check the free beta with two disposable accounts, A and B.
This is a testing guide, not a product roadmap. Payments must remain disabled.

## Status before device testing

- Local TypeScript checking and full-repository ESLint checks passed during this change.
- Automated date tests cover UTC dates, leap years, month/year boundaries, and the
  midnight edit window. These checks do not prove that the live database or an
  installed app works.
- Every account, device, and network check below is **pending**
  until someone performs it and records the result.
- The new migration
  `supabase/migrations/20261026_allow_free_beta_league_joins.sql` was applied
  to the live project on October 26, 2026, with the founder's approval.
  Fresh-connection verification confirms the old allowance restriction is gone.
- The shared-profile privacy migration `20261026150000` was applied in the same
  transaction. Local schema integration tests confirm that it keeps
  own-profile access and exposes only names/handles to league members. The app
  temporarily supports older backends by requesting only these display fields;
  the live backend now uses the narrow membership-checked RPC. A REST check
  confirmed that the endpoint is loaded and anonymous access is denied.
- Full-schema local integration verified the free-join migration, authenticated
  check-in persistence and access restrictions against a schema-only copy of
  the live database. No real account records were copied or changed. Local
  PostgreSQL 18 differs from the live PostgreSQL 17; these SQL checks do not
  establish that native authentication or PostgREST request flows work.
- The purchase-verification restriction `20261026160000` was also applied in
  that transaction. All three SQL assertion suites pass together against the
  isolated live-schema copy. App roles cannot call the legacy purchase RPC;
  trusted backend access is preserved. A scan of all 27 public functions found
  no other app-callable paid membership/payment writer. This is a scoped review,
  not a general security certification.
- Read-only inspection of the linked `microhabit` Supabase project confirmed
  free-only league creation/joining, UTC today/yesterday check-in policies,
  restrictions on direct membership writes, and owner-league account deletion.
  The old lifetime free-join restriction was subsequently removed. These are checks of
  database definitions; account and device flows still require testing.
- Before deployment, live migration history recorded only `20260312`, although
  later function and policy definitions were present. Do not run a blanket migration push:
  historical migrations must be reconciled separately. This checklist does
  not apply database changes. Following explicit founder approval, only the
  three October fixes above were applied and recorded; historical migrations
  were not replayed. All changes committed atomically, and fresh read-only
  metadata checks passed. No user records were modified by deployment.
- A read-only check of public authentication settings confirmed that email,
  Google, and Apple sign-in are enabled and email confirmation is required.
  Successful sign-in and recovery flows still need device testing.
- Public privacy and support URLs returned HTTP 200 on October 26, 2026.
  The published pages still lack the local owner-league deletion explanation;
  the published support page also lacks the UTC check-in explanation. Publish
  the reviewed documentation updates before wider beta distribution, then
  recheck the actual page content. Reachability alone is not content approval.

## Device result recorded October 26, 2026

- **Pass (founder reported):** On the founder's iPhone using the SDK 54 Expo
  client, today's completed check-in remained saved after refresh and closing
  and reopening the league. This confirms that specific persistence flow only.
- **Pass (founder reported):** The founder could not edit another member's
  progress on the iPhone. Testing both views and reversing account roles remain
  pending; this observation alone does not establish complete backend security.
- **Pass (founder reported):** Yesterday's completed check-in remained saved
  after refresh and reopening the league on the founder's iPhone.
- **Pass (founder reported, after the database update):** Other members' names
  and progress remained visible after reloading Commito. A second account
  successfully joined two different free leagues.
- Other unreported device checks below remain pending.
- **Resolved backend privacy finding:** League peers could retrieve full profile
  rows, including email addresses. The deployed privacy migration removes that
  policy and provides only display fields through a membership-checked RPC.
- **Resolved access-control finding:** A legacy purchase-verification RPC trusts
  caller-supplied purchase details. A synthetic authenticated outsider used it
  to enter a paid league and read its logs in a rollback-only local test.
  The deployed restriction now denies app and anonymous roles access while
  preserving trusted backend access. Payments remain disabled in the app.

## Authentication results recorded October 27, 2026

- **Pass (founder reported):** Sign-in and sign-out worked during the current
  TestFlight check. A full restart while signed out was not separately reported.
- **Delivered to Spam (founder reported):** The recovery email arrived in Spam;
  the original missing-email report was not a delivery failure.
- **Fail (founder reported, Commito 1.0.2 (27)):** The recovery email opened
  Chrome, requested permission to open Commito, then opened the signed-in app
  without displaying the new-password form. No password change was confirmed.
- **Local correction, not in build 27:** Recognize recovery from the reset path
  as well as the link type, handle native and Expo callback paths, and hold
  ordinary sign-in routing while the initial link/session is being processed.
  Recovery stays on the password form until a successful change. The success
  message now accurately says the password was saved and keeps the user signed
  in. Reset-request copy mentions Spam/Junk without claiming delivery.
- Automated callback tests use synthetic tokens and mocked authentication;
  they cover native/Expo formats, PKCE without a type parameter, ordinary
  sign-in, expired/incomplete links, and exchange/network failures. These tests
  do not prove native routing, email configuration, or a real password change.
  Repeat recovery with a fresh email on the next standalone build, both with
  Commito closed and already open. Confirm the new password works and the old
  password fails. No additional email was requested by the assistant.

## Prepare the test

1. Use two email addresses you control. Keep passwords outside this repository.
   Name every test league clearly, for example `Beta A Walk` and `Beta A Read`.
   Do not use a real group's league for deletion tests.
2. Ideally use two iPhones so A and B can stay signed in simultaneously. If you
   have one phone, sign out between accounts; mark simultaneous live-update
   testing as pending until a second device is available.
3. For local-source testing, use the SDK 54-compatible Expo client supplied
   through TestFlight, if that is your available client. Start Expo from the
   repository (`npx.cmd expo start --lan` on Windows), keep the computer and
   phone on the same network, and open the terminal's development link/QR code
   in that client. Use the port Expo reports. If the client reports an SDK
   mismatch, stop and record it rather than testing an older installed app.
4. Confirm the client is actually showing the local changes: the sign-in screen
   should have Privacy policy and Support links. In a league, open Menu and tap
   Check-in rules to find the UTC check-in explanation.
5. A normal standalone Commito TestFlight build does **not** pick up local Expo
   source changes by scanning this QR code. Repeat the release checks below in
   the final Commito build containing these changes. Testing in an Expo client
   alone is insufficient for release approval.
6. Confirm which Supabase project the local environment uses. Disposable accounts
   still write to that configured project. Never paste database passwords,
   service-role keys, or account passwords into the test record.

Record device/iOS version, client or Commito build number, code revision, backend
project name, and UTC test time. Use **Pass**, **Fail**, or **Pending** per item.

## Accounts, creation, and joining

- [ ] Create A and B through email sign-up. If confirmation is enabled, confirm
  both emails and verify each account can sign in. Record email delays or broken
  confirmation links.
- [ ] As A, create two free leagues with different activities. Both appear in
  the league list and open with the right name and activity.
- [ ] Copy/share each invite code. As B, join both leagues. Both should succeed
  once the free-beta migration is applied, even if B previously joined a free
  league. If blocked, record the exact message and deployment status.
- [ ] Re-enter the first code as B. It should reopen the same league without a
  duplicate membership or reset history. As A, re-enter A's own code and verify
  owner access remains intact.
- [ ] Try a clearly invalid code. The app gives a useful error and still allows
  a later valid attempt. Codes with surrounding spaces should work.
- [ ] Paid plans are hidden or blocked. No action requests money or silently
  grants a paid entitlement.

## Check-ins and rankings

Use the actual UTC date, which may differ from your phone's local date. A new
day begins at 00:00 UTC. Do not change your phone clock against the live backend
to simulate month boundaries: the database uses its own clock.

- [ ] As A, mark today complete, then incomplete, then complete again. Each state
  survives pull-to-refresh, leaving/reopening the league, and restarting the app.
- [ ] Yesterday is editable; earlier days and future days are not.
- [ ] A cannot edit B's check-ins in either My View or Ranking. B can edit B's
  own permitted days. Repeat the same check with the roles reversed.
- [ ] Complete different days as A and B. Rankings count completed days only;
  undoing a day reduces the score. Equal scores may be ordered by name; this is
  not a financial prize-tie rule.
- [ ] Open Ranking and use the pencil beside your name to edit the display name.
  Refresh on both devices and confirm the name persists without changing scores.
- [ ] With both phones open, A changes a day and B sees the change without
  refreshing. Repeat B to A. If automatic updates fail, record that separately
  from whether pull-to-refresh retrieves the correct saved result.
- [ ] Turn off networking, attempt a check-in, then restore networking. The app
  must not leave an unsaved change looking permanently saved. Refresh and verify
  the stored value. Record an operation that remains stuck rather than assuming
  it succeeded.

## UTC rollover and month boundary

These require the actual boundary or a separate controlled test environment.
Leave them **Pending** if you cannot run them; helper tests are not substitutes.

- [ ] Leave a league open across 00:00 UTC. Today/yesterday eligibility advances
  without reopening. Repeat by backgrounding before midnight and returning after.
- [ ] At the start of a UTC month, the grid shows the new month. A separate
  yesterday control shows the previous month's final date and can complete/undo
  that day. Its value survives refresh and is excluded from new-month rankings.
- [ ] If connectivity is lost during month rollover, previous-month check-ins
  must not appear editable as new-month data. Restore connectivity and pull to
  refresh; the correct new month should load.
- [ ] Check that an in-flight save or refresh across midnight does not populate
  the wrong month. Record exact dates and UTC time if it behaves incorrectly.

## Privacy, support, and deletion

- [ ] Open Privacy policy and Support from sign-in, sign-up, the Leagues Account
  menu, and the league menu. Pages load and are readable. A browser opening does
  not establish that its content loaded successfully; check the page itself.
- [ ] On a smaller screen, with the keyboard visible and larger text enabled,
  scroll to the links and activate them. Screen-reader navigation identifies
  them as links. A browser-launch failure should show an error with the URL.
- [ ] Begin deleting A and cancel. No data is removed. The warning must explain
  that owned leagues and every member's shared history in them will be deleted.
- [ ] After all other checks, delete disposable owner A. A is signed out and
  cannot sign in with the deleted account. B refreshes and can no longer access
  A's deleted leagues or their history. B's separate owned league, if created,
  should remain. This operation is irreversible.
- [ ] Delete disposable B when testing is complete. Do not delete the App Review
  demonstration account or a real participant's account.

## Repeat on the final Commito TestFlight build

### Local menu update after build 26

The league and Account menus now share an iOS-style grouped settings sheet.
It includes an app-version footer, using the installed binary's version/build
in standalone apps and a distinct development-preview label in Expo Go.
The compact purple sheet also supports dragging down from its header/handle
to dismiss. Isolated touch-browser checks passed for short/horizontal drags,
downward dismissal, position reset on reopening, and independent row scrolling.
Repeat these gestures on the actual iPhone; browser results do not verify
native gesture handling or modal animation.
These UI changes were made after build 26 and are **not in that build**.
Version **1.0.2 (27)** was prepared on October 27, 2026 to include them.
TypeScript, ESLint, version-label checks, and an iOS JS export passed during
implementation. An isolated browser preview checked phone layouts and callback
wiring with mocked native metadata; actual iPhone presentation remains pending.
Verify close/back, check-in rules, policy/support links, sign-out, the deletion
confirmation/cancel path, scrolling with larger text, and the displayed version
on the next native build. Do not delete a real account for this UI check.

### Build 27 status

- Checkpoint source: [0e8b22f](https://github.com/KeQue/MicroHabit/commit/0e8b22f47bd70c8b173574e5abdceabe66f24a1f)
  on `beta/free-leagues-build-27`; [draft review](https://github.com/KeQue/MicroHabit/pull/1).
- [iOS build](https://expo.dev/accounts/keke12/projects/microhabit/builds/9f7ae895-e413-4995-8da7-0c892575a9e0)
  finished successfully on October 27, 2026. Expo's build metadata confirms
  version 1.0.2, build 27, and the exact checkpoint source commit above.
- [TestFlight upload](https://expo.dev/accounts/keke12/projects/microhabit/submissions/b8876530-1e74-4f1f-8f24-86213c7b0837)
  completed successfully on October 27, 2026 using the existing App Store
  Connect API key; Expo reports FINISHED with no error. Apple processing and
  installation have not yet been verified.
- No public App Store review/release, branch merge, new database migration,
  wider tester invitation, or policy-page publication was performed during this
  checkpoint. Updated policy pages still need publishing before wider beta.
- First device check: open Commito from TestFlight, then open Settings and
  confirm `Commito 1.0.2 (27)`. Repeat the pending native checks below.

### Build 28 preparation

- Version 1.0.2 (28) contains the local password-recovery correction described
  above. It does not introduce a separate email-link sign-in option.
- TypeScript, repository ESLint, seven callback tests and three UTC tests pass.
  An isolated browser harness ran the actual auth provider, route gate and
  password screen with mocked native services/authentication. Cold and warm
  recovery, PKCE without a type parameter, ordinary OAuth and expired-link
  routing passed. Mismatched passwords never submitted, a failed save stayed
  on the form, and a successful save returned to leagues with confirmation.
- These synthetic checks do not verify iOS deep links or real password changes.
  Cloud compilation, TestFlight upload and native recovery verification are
  pending until their results are recorded.
- On build 28, request a fresh reset email, check Spam/Junk, and open its link
  on the iPhone. Expect **Choose a new password**. Save a new password, sign
  out, confirm the old password fails and the new password works. Repeat once
  with Commito fully closed and once with it already running, using fresh links.

### Build 26 status

Version **1.0.2 (26)** was uploaded to Expo for an iOS cloud build on October
26, 2026: [build status](https://expo.dev/accounts/keke12/projects/microhabit/builds/056d5337-2c86-4e30-9806-cd3a3d81bd41).
Compilation finished successfully. An Apple upload was scheduled through Expo:
[submission status](https://expo.dev/accounts/keke12/projects/microhabit/submissions/bf410113-fd5e-4ec6-aa0f-48d04194240d).
The founder subsequently confirmed Commito **1.0.2 (26)** was available in
TestFlight. Expo also reports that build as FINISHED on October 27, 2026.
The founder already belongs to the existing internal TestFlight group, which
has access to all builds. No invitation or group change was made.
Standalone authentication, recovery, reminders, and deletion checks remain
pending; availability in TestFlight is not a pass for those flows.
No public App Store review or release
was requested. Both Expo and Apple listed build 25 as the latest existing Commito
build before this request. This is the standalone `com.sadik.microhabit` app,
distinct from the SDK-compatible Expo client. The production Expo environment's
two public Supabase configuration values matched the tested local environment.

All of these remain pending even if ordinary tracking works in the SDK 54 Expo
client. Native configuration and production authentication redirects can differ.

- [ ] Email confirmation returns to the intended app flow.
- [ ] Forgot password sends an email; its link opens the correct recovery screen;
  the new password works and the old password no longer does.
- [ ] Google sign-in and Apple sign-in complete on an iPhone and return to the
  correct account. Provider cancellation returns to a usable screen. An Expo
  client failure is not sufficient evidence that the standalone flow is broken.
- [ ] Sign out and restart: private screens are unavailable until sign-in.
- [ ] Allow notifications and verify a local daily reminder arrives at 17:00
  device-local time. These are local reminders, not server notifications. Denying
  permission should not prevent using leagues. The developer-only short test
  notification, if present in a development client, does not prove delivery of
  the release reminder. UTC check-in boundaries and local reminder time differ.
- [ ] Repeat invite, check-in persistence, two-device updates, policy links, and
  deletion on the actual build intended for beta distribution.

## Record failures

For each failure, record the action, expected result, actual result, UTC time,
device/build, and whether a refresh/restart changes the outcome. Include a
screenshot when useful, with personal information removed. Keep uncertain or
unperformed checks marked Pending; do not count them as passes.

Do not invite a wider beta group until failures affecting sign-in, joining,
saved check-ins, access to another user's data, or deletion are resolved and
retested on the intended build and backend.
