# Commito beta smoke test

Use this checklist to check the free beta with two disposable accounts, A and B.
This is a testing guide, not a product roadmap. Payments must remain disabled.

## Recap sheet refinement — candidate 36, October 29, 2026

The founder confirmed build 35 loaded its recap and said Daily reminder looked
fine. They reported the floating recap did not close on outside taps and
approved the sheet/menu refinements recorded in
[Batch-3 presentation follow-up](weekly-recaps-reminders.md).
The change passes 111 automated tests and local synthetic web previews; it is
included in build 36, which finished at 11:44:16 UTC; its automatic TestFlight
upload was verified FINISHED at 11:45:36 UTC. Apple processing and actual
installation remain pending. Check outside tap, X, header swipe,
body scrolling, large text and unchanged Daily reminder on an iPhone.

## Weekly recaps and reminders — candidate 35, October 29, 2026

See [rules, implementation, evidence and pending device checks](weekly-recaps-reminders.md).
The founder approved deployment and native delivery. The single recap migration
is live and verified; candidate 1.0.2 (35) enables its menu entry. The new app
controls are not in installed build 34. Build 35 finished at 10:48:29 UTC;
its automatic TestFlight submission was verified FINISHED at 10:49:23 UTC.
Apple processing, actual installation and device results remain pending.
Existing successful phone checks do not establish Batch-3 behavior.

- [ ] Update Commito through TestFlight and confirm Settings shows **1.0.2 (35)**.
- [ ] Open the league menu → Weekly recap. Check last week's UTC date range,
  per-member days and total group activity; return to the unchanged league view.
- [ ] Open Daily reminder, choose a local time a few minutes ahead and Save.
  Confirm the keyboard can be dismissed and the setting survives reopening.
- [ ] Observe one notification, then turn reminders off and confirm it stays off.
- [ ] Complete remaining permission/account/timezone/accessibility cases in the
  Batch-3 record. Actual DST/background delivery remains unverified.

## Repeated display names — deployed October 29, 2026

The founder reported that changing Saddu to Sadu failed although nobody in
that league had that name. Schema-only production inspection confirmed the
case-insensitive global `profiles_username_unique` index. The editor updates
both username and name, while app identity, profile access, league membership,
check-ins and ranking joins use account UUIDs. No private account records were
read to identify who held the name.

The founder chose **allow repeated display names**, including within the same
league. Names remain account-wide across leagues, not per-league aliases.
Approved migration `20261029100000_repeated_display_names.sql` removes only
that unique display-name index. It preserves the profile ID primary key,
three-to-twenty-character username check, policies, grants, monthly-name freeze
trigger and existing UUID tie ordering. It changes no names or saved activity.
No app source change, new build or payment work is required.

Isolated results: the original cross-league collision reproduced before the
migration. After it, the new rollback-only SQL fixture passed exact/case-variant
duplicates, same-league duplicates, distinct profile IDs, independent progress,
cross-user write/read denial, outsider RPC denial, stable equal-name ranking,
old finalized names/scores and input bounds. All seven existing SQL suites
also passed. Genuine clocks were restored. An initial fixture table-reference
error and old-date RLS rejection were corrected in the fixture; no live policy
or permission was relaxed to make it pass.

Recovery was tested separately: uniqueness can be restored before duplicates
exist. Once duplicate names exist, the rollback refuses safely and preserves
names/accounts; restoring the old rule then requires separate review. The
rollback must never auto-rename or delete users to recreate the index.

The founder approved production execution. The single migration committed on
October 29 at **10:17:51 UTC**, after fresh schema metadata matched the tested
baseline. Fresh post-commit requests verified that only the display-name index
was removed and its migration record added. Public functions, policies, RLS,
grants, constraints, profile columns/triggers, views and private functions were
unchanged. The profile primary key and name-length check remain in place.
No live user records were changed or exported during deployment. The founder
subsequently confirmed that saving Sadu worked on their iPhone. Refresh/reopen
persistence and a two-account duplicate-name device check were not separately
reported; isolated SQL passes are not device results.

- [x] Retry Sadu in the existing app (founder-reported success, October 29).
- [ ] Confirm the renamed profile after refresh/reopening the league.
- [ ] With two disposable accounts, use the same name and verify progress stays
  separate. Equal names do not grant access to anyone else's profile/check-ins.

## HTTPS invitations — build 34, October 28, 2026

The founder confirmed build 33's app-only address was unclickable both in the
preview and after sending. They approved publication and a new TestFlight build.
Only the reviewed invitation/disclosure files were published to Pages `main`;
its exact commit, public HTML/JS and privacy text were verified. Live Chrome
checks at 320px/390px passed with synthetic code and no database requests.
All 76 Node tests, TypeScript and full lint pass. Build 34 enables the published
web link; build 33 retains the old share text. Its
[build](https://expo.dev/accounts/keke12/projects/microhabit/builds/d67b95e7-f669-4e24-9a36-abed15de1961)
from `c281ef1` and [automatic TestFlight submission](https://expo.dev/accounts/keke12/projects/microhabit/submissions/63f2ebb1-5bfe-4d36-963c-2bd39c23df33)
both finished: build at 22:52:33 UTC, submission verified at 22:52:57 UTC.
On October 29, the founder confirmed on their iPhone that the live invitation
page's **Open Commito** button opened the Join screen with the expected code
prefilled. The installed build, initial sign-in state and messenger entry path
were not separately confirmed. Build-34 installation and remaining checks:

- [x] Live invitation page → Open Commito → Join screen with code preserved
  (founder-reported iPhone result, October 29).

- [ ] Update Commito to **1.0.2 (34)** and share a **new** invitation. Its address
  should start with `https://keque.github.io/MicroHabit/join/`, with the same code.
- [ ] Tap that address in Commito's preview: the invitation page opens.
- [ ] Send it in a messenger and tap the received HTTPS link. On the page, tap
  **Open Commito**; the Join screen is prefilled. Membership requires a tap.
- [ ] Repeat while signed out: sign in, retain the invitation and join once.
- [ ] Copy invite code on the page. With blocked clipboard or no installed app,
  manual instructions and the code remain available. Keep the code through
  installation; this is not deferred-install/universal linking.

No production migration or public App Store release is part of this fix. See
[publication evidence and boundaries](invitations-engagement.md).

## Invitations and measurement — Batch 2 / build 33, October 28, 2026

See [implementation, metric definitions and evidence](invitations-engagement.md).
The invitation changes are not included in build 31. The founder approved the
single reporting migration and a new TestFlight build. The migration is now
committed and verified. Build 32 finished and uploaded, but is superseded by
build 33: final review found and reproduced an edited-code cancellation gap,
then fixed it using the original intent's nonce. Use build 33 for these checks.
Its [build](https://expo.dev/accounts/keke12/projects/microhabit/builds/d73bd69c-f393-4580-b672-c1af9c209f06)
from corrected source `f883007` and
[automatic TestFlight submission](https://expo.dev/accounts/keke12/projects/microhabit/submissions/06be5e43-68ed-454f-98f8-5d86707b57f6)
both finished: the build at 22:19:00 UTC and submission verified at 22:19:25 UTC.
Apple processing and actual iPhone installation remain unverified. Automated checks and
isolated SQL fixtures do not establish the following iPhone results:

- [ ] Update Commito in TestFlight and confirm Settings shows **1.0.2 (33)**.
  Build 32 is superseded; My Expo Go is a separate preview app.

- [ ] Share an invite using the existing Share button. Check readable code,
  native-app link and manual signup instructions; cancel sharing safely.
- [ ] Open it with Commito installed, both closed and already running. Prefill
  the code, but create no membership until **Join league** is tapped.
- [ ] Repeat while signed out. Complete ordinary email/social sign-in or signup
  and email confirmation; return to the same invitation. Back cancels it.
- [ ] Edit the prefilled code, then Back. Reopening the app must not resurrect
  the cancelled original invitation. A newer invitation must remain intact.
- [ ] Password recovery still opens the password-change screen before any
  pending invitation. A new account must not inherit an old account's intent.
- [ ] Join twice using the same code: one membership. Invalid code/network loss
  offers retry. Open a second invitation while the first request is pending;
  no stale preview or clearing of the second invitation.
- [ ] Check the longer message preview and all action buttons on a small iPhone
  and with larger text/VoiceOver. Custom-scheme clickability varies by messenger;
  the readable code remains the installation fallback.

Fresh backend verification confirms app report execution and unused event
writes are denied, with existing joining/check-in/ranking definitions and
permissions unchanged. Phone behavior remains to be tested after build 33 is
installed.

## Compact month row — build 31 preparation, October 28, 2026

The founder reported the monthly-history screen working and supplied a native
screenshot. They requested moving the separate current-month label into the
Past results control to reduce scrolling. This is a layout-only revision:
`October 2026` now appears beside `Past results` in its existing row. Removing
the standalone text and its bottom margin moves the member cards upward.

TypeScript and targeted lint pass. A synthetic React Native Web / headless
Chrome preview fits the row at 320px and 390px widths, including September's
longer label. Icons were substituted in that preview; actual iPhone layout and
VoiceOver remain pending. No database, scoring or check-in behavior changed.
The [build-31 job](https://expo.dev/accounts/keke12/projects/microhabit/builds/458a5369-7223-4352-99c6-5270dd8ce2d1)
finished from source checkpoint `183fb51`. Its [automatic TestFlight submission](https://expo.dev/accounts/keke12/projects/microhabit/submissions/32f4ab67-53ef-4df0-9eec-4a3778ff1ebd)
was verified `FINISHED` at 21:19:47 UTC on October 28. Actual iPhone installation
and compact-row native layout remain unverified; installed build 30 retains
the old layout. Build 30's submission is also `FINISHED`.

## Monthly history Batch 1 — build 30, October 28, 2026

See [monthly cycle rules and verification](monthly-cycles.md). The founder
confirmed keeping day-1 corrections and finalizing the previous month at
00:00 UTC on day 2. New migration, snapshots, history panel and tests are local
review work was approved for deployment. The single monthly-cycle migration is
now committed on production PostgreSQL 17.6 and separately verified: prior
functions/policies/grants unchanged, new permissions restricted, member access
works, outsider access rejected. The live functional transaction rolled back.
`MONTHLY_RESULTS_AVAILABLE=true` for the new 1.0.2 (30) candidate.
Source checkpoint: `68cb3e9171b179a36a58061c86e06371dd2ab0d3`.
The [build-30 job](https://expo.dev/accounts/keke12/projects/microhabit/builds/94ff94ab-b2d6-413c-b1ee-3751ed6fb846)
finished at 20:24:05 UTC, with an available binary and the expected
version/build/source. The [TestFlight submission](https://expo.dev/accounts/keke12/projects/microhabit/submissions/ed0f5aae-1b5d-4c16-a7da-1f6132df57f3)
was verified `FINISHED` at 20:58:55 UTC. The founder subsequently reported the
monthly-history screen working; the precise installed build was not separately
confirmed. The standard submission uses existing credentials; no Expo plan
upgrade or public App Store release was requested.
Installed build 29 lacks this feature.

Isolated tests cover calendar boundaries, server finality, scoring, membership
permissions, next-month continuation, deletion and overlapping save/finalization.
Native history/VoiceOver checks are pending. Prior device passes below do not
verify this new feature. The managed backup API lists no completed backups and
PITR is disabled; recovery for this additive rollout uses the tested disable
script and retained schema metadata, not a verified full-data restore point.

Focused build-30 iPhone checks, **pending**:

- [ ] In TestFlight, update **Commito**, then confirm Settings shows 1.0.2 (30).
  My Expo Go is a separate preview application and is not this candidate.
- [ ] Open an existing free league. Members, invite code and current check-ins
  remain available. Change today's check-in, refresh, and confirm it persists.
- [ ] Open **Past results**. A league with earlier months shows their server
  results with read-only status; a first-month league shows the empty explanation.
- [ ] Switch between available months. Scores, longest streaks and ranks remain
  consistent after refresh. Completed months have no editing controls.
- [ ] Open history without connectivity: show a retry rather than fabricated
  results. Reconnect and retry successfully.
- [ ] Check readable layout and VoiceOver labels on the actual iPhone.
- [ ] At a real UTC month boundary, or in an isolated operator-controlled test
  environment, verify new-month continuation, day-1 correction and day-2 finality.
  Do not fake the phone clock against the production server.

## Authentication hardening candidate 1.0.2 (29), October 27, 2026

Source checkpoint: [6a8d8ad](https://github.com/KeQue/MicroHabit/commit/6a8d8ad7a600933d76dacf36de7b441403f467e8).
The [iOS build](https://expo.dev/accounts/keke12/projects/microhabit/builds/23f50fcb-2bef-4618-a56b-4bbd8f36559f)
finished successfully with version 1.0.2, build 29 and that exact commit. Expo
reports a ready artifact and completion at 15:44:10 UTC on October 27. The
[TestFlight submission](https://expo.dev/accounts/keke12/projects/microhabit/submissions/dd26e04a-b015-4377-8f22-6ecc9cb3ee20)
was scheduled using existing EAS credentials. A fresh Expo check on October 28
confirms the submission is `FINISHED`, without a reported error. This verifies
the upload; it does not independently inspect Apple processing or the build
number installed on the phone. No public App Store review/release was performed.

**Public release remains NO-GO.** The earlier build-28 functional results did
not establish security or public-release readiness. This candidate addresses
native callback trust, PKCE and local session storage; it does not close the
entire subsequent audit. Installed build 28 does not contain these changes.

- **Build-29 social-login regression reported October 28:** The founder's
  iPhone showed `Could not complete Google sign-in` and the corresponding Apple
  error. The actual installed Expo Linking implementation generates
  `microhabit:///sign-in` and `microhabit:///update-password` for the app's
  leading-slash inputs. Supabase allowed only the two-slash forms, with the
  two-slash sign-in address as Site URL. The stricter build-29 callback wrapper
  rejects that different return-address shape. A test executing the installed
  Expo implementation reproduced the mismatch; the older mock URL builder had
  removed the leading slash and concealed it. No native interception attack or
  new provider-credential failure was established by these screenshots.
- **Targeted live correction October 28:** Added only the exact addresses
  `microhabit:///sign-in` and `microhabit:///update-password` to the existing
  Supabase redirect allowlist. A fresh configuration read verified that only
  `uri_allow_list` changed; Site URL, existing addresses, provider credentials,
  SMTP and all other auth fields remained unchanged. The prior allowlist was
  saved outside the repository for rollback. No wildcard redirects or relaxed
  client validation were added. This correction needs no new app binary.
  The founder subsequently retried both providers as requested and reported
  that both worked on October 28. This resolves the observed social-login
  regression for those iPhone attempts; cancellation and account-linking edge
  cases are not established by this result.
- Four new regression tests execute the installed Expo URL/Scheme code and the
  actual app link wrapper, with only native manifest/platform and backend
  dependencies mocked. They check standalone allowlist alignment, a synthetic
  code exchange, the rejected fallback-address shape/unrelated origins, and
  exact Expo Go host/port isolation. All 27 automated tests pass. This does not
  substitute for native provider testing. The founder's successful post-fix
  Google/Apple attempts are recorded separately above.
- **Deferred at the founder's request October 28:** Repeating password recovery
  on build 29 was skipped because the founder had tested it previously. The
  build-28 result remains a pass; build-29 native recovery is unverified.

- **Pass, narrow device observation (founder reported October 28, 2026):**
  Following the instruction to update to build 29 without uninstalling, the
  founder reported that the app remained signed in. The displayed build number
  and a subsequent full restart were not separately confirmed in that report.
  This supports session continuity after the instructed update, not independent
  verification of Keychain contents, plaintext removal or every recovery flow.

- Fresh protected Supabase inspection succeeded through read-only management
  queries: 27 public functions, 29 policies, and RLS enabled on all public tables.
  Function definitions/ACLs, policies, RLS settings, table/column grants, view
  definitions/options, constraints and nullability match the isolated copy after
  normalizing database names, line endings and PostgreSQL 17/18 NOT NULL catalog
  representation. All six public views use security-invoker semantics. The six
  privileged function signatures (including both legacy log toggles) remain
  service-role only. No production settings or user records were changed.
- Live migration versions are still `20260312`, `20261026`, `20261026150000`,
  and `20261026160000`. Historical migration/schema-file reconciliation is not
  complete. These observations are not permission to replay older migrations.
- The four existing isolated SQL suites passed again. The new repeatable
  `supabase/tests/checkin_authorization.sql` additionally checks authenticated
  check-in persistence, old-date/paid writes, cross-user updates, direct
  membership injection/deletion, role escalation, privileged legacy grants,
  outsider reads (including ranking views), and outsider writes. All fixtures
  roll back. This is role-level SQL testing, not fresh authenticated requests
  through the hosted Supabase Auth/PostgREST services.
- The client explicitly uses PKCE. Native crypto supplies secure random values
  and SHA-256 for the SDK's S256 challenge rather than its plain fallback.
  Exchanges require the verifier created by the initiating device. Callback
  addresses must match the app-generated sign-in/reset addresses; Expo callbacks
  are allowed only for that specific development address. Unrelated origins,
  embedded credentials, duplicate parameters and token-bearing implicit links
  cannot establish a session. Recovery is bound to the local reset flow rather
  than a URL-supplied type. OAuth cancellation/browser errors clear the verifier.
- Native session/verifier values now use Expo SecureStore (device-only Keychain
  accessibility on iOS). Bounded chunks support large Unicode sessions; a
  manifest is published only after every chunk is written. Existing AsyncStorage
  sessions migrate on read and their plaintext copy is removed after success.
  A failed migration retains its source for retry. Sign-out removes protected
  values and the legacy copy. Web retains the existing AsyncStorage adapter;
  native storage tests do not establish browser storage security. Keychain data
  may survive iOS uninstall; reinstall/session-expiry behaviour needs device QA.
- TypeScript, repository ESLint and whitespace checks passed. All 23 automated
  tests passed: 8 callback, 6 SDK/PKCE/crypto, 6 storage, and 3 UTC tests. SDK
  tests use synthetic endpoints and mocked token responses; no emails are sent.
  Tests exercise S256 through the native-crypto bridge, missing/wrong verifiers,
  one-use exchange, recovery flow markers, migration failure, replacement failure,
  missing/corrupt chunks, and sign-out without legacy-session resurrection.
- An isolated browser harness ran the actual auth provider, route gate and
  password form with native/backend services mocked: cold/warm PKCE recovery,
  ordinary OAuth, expired links, failed/successful password saves, rejection of
  unrelated native callback events, and cancellation/browser-failure cleanup
  passed. An iOS Hermes JS export also passed. Neither verifies real Keychain
  calls, provider consent or hosted PKCE exchange on an iPhone.
- After installing the new candidate, request NEW confirmation/reset emails
  from that device. Old token-based links are deliberately rejected. Open the
  newest link on the same device/client that requested it. A reset/new signup
  replaces the previous pending verifier. Confirmation resend requires a pending
  sign-in verifier; otherwise the UI directs the user to start signup again.
- **Required candidate device checks:** upgrade from build 28 while signed in;
  restart and confirm session migration; explicit sign-out/restart; fresh email
  signup/confirmation (including resend); Google and Apple login; fresh reset
  links with the app closed and open; new password accepted/old password rejected.
  Repeat cancellation on the candidate if practical. These are pending and
  cannot inherit the passes from build 28.
- **Other audit gates remain open:** Apple authorization revocation/deletion
  integration, public shared-content safeguards, privacy/controller disclosures,
  email Spam/capacity, relevant dependency advisories (npm still reports 49),
  abuse/idempotency controls, operations and the unperformed final-device/release
  checks. Verified HTTPS Universal Links are not configured. PKCE mitigates code
  interception; it does not make the custom URL scheme exclusive to Commito.

## Final verification recorded October 27, 2026

- TypeScript checking, repository ESLint, seven auth callback tests and three
  UTC calendar tests passed again during the final review.
- An isolated browser harness ran the actual league detail screen with
  synthetic data and mocked native components/backend services. Rejected
  writes and thrown network failures restored the previously checked value
  and score. Pending writes disabled overlapping edits; a successful change
  survived a reload of the mocked stored data. Rankings counted completed
  days only, updated after simulated realtime events, and ordered equal scores
  by name. This verifies screen logic, not native rendering or live transport.
- `supabase/tests/account_deletion.sql` passed against the existing isolated
  schema-only live copy (PostgreSQL 18; production is PostgreSQL 17). It called
  the real deletion RPC as authenticated synthetic owners/members, verified
  shared-league/history removal and peer read visibility, and preserved the
  other account's owned league and an unrelated owner's data. Unauthenticated
  deletion was rejected. Every fixture and deletion rolled back; no live user
  data was touched. This does not verify Supabase Auth service/session cleanup
  or refresh of the installed app after deletion.
- **Deferred at the founder's request:** The two-account iPhone owner-deletion
  test was explicitly skipped. Do not mark the native shared-deletion check
  below as passed based on the isolated SQL result.
- **Partial device observation:** Today was checked before the founder tried
  changing it offline, and was unchecked after reconnecting and refreshing.
  Error visibility and request timing were not confirmed. A request completing
  when connectivity returned could explain this result; it does not establish
  failed-save rollback on the phone. The explicit failure cases passed only in
  the isolated screen harness described above.
- Review found no app-source/config/dependency changes since the build-28
  checkpoint `7cc6142`. This pass adds a rollback-only SQL test and updates this
  record; it requires no new binary. The app review remains unmerged, with no
  public App Store release or wider tester invitations authorized here.
- Email Spam placement remains unresolved. Provider cancellation remains
  deferred. Native simultaneous updates, accessibility/large-text checks and
  actual UTC rollover observations remain unverified where listed below.

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
  Configuration alone does not establish native sign-in behaviour; subsequent
  founder-reported device results are recorded below.
- Public privacy and support URLs returned HTTP 200 on October 26, 2026.
  They then lacked the owner-league deletion and UTC explanations. The founder
  approved the documentation-only update on October 27; both pages are now
  published and their actual HTML was verified against the approved files.
  See the publication record below. Reachability alone is not content approval.

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

- **Pass (founder reported October 27, 2026):** In response to the daily-reminder
  check, the founder confirmed it arrived yesterday (October 26). The installed
  client/build and exact delivery time were not separately reported. The reminder
  implementation has no source changes between the baseline and current build;
  this is an observed delivery, not a fresh build-28 scheduling test.
- **Pass (founder reported):** Sign-in and sign-out worked during the current
  TestFlight check. The founder subsequently tapped Sign out, fully closed and
  reopened Commito, confirmed it was still signed out, and successfully signed
  in again with Apple. This completes the observed sign-out/restart flow.
- **Pass (founder reported):** Closing and reopening Commito without tapping
  Sign out preserved the signed-in session and displayed the league selection.
  The founder clarified that Sign out had not been tapped; this is session
  persistence, not verification of remaining signed out after restart.
- **Delivered to Spam (founder reported):** The recovery email arrived in Spam;
  the original missing-email report was not a delivery failure.
- **Pass with a delivery issue (founder reported October 27, 2026):** The signup
  confirmation email arrived in Spam and its link could not initially be
  selected in Gmail. After marking the message as not spam, the founder could
  select Confirm and reported that confirmation worked. The signup confirmation
  flow passed through that manual workaround. Spam placement remains unresolved;
  this result does not establish reliable inbox delivery for other recipients.
- **Read-only sender review October 27, 2026:** Supabase uses Gmail SMTP on
  port 465, with a gmail.com From address matching the authenticated sender,
  the display name Commito, and a 30-emails/hour project limit. Confirmation
  remains required, and the custom confirmation template includes
  `.ConfirmationURL`. No obvious sender mismatch or missing template link was
  found. No email settings were changed by this review. Spam placement has not
  been attributed to a specific cause; sender authentication headers and fresh
  recipient tests would provide further evidence. The founder confirmed on
  October 27 that no Commito domain is owned yet. No domain was purchased and
  no SMTP/DNS settings or email providers were changed. The current Gmail
  setup remains in use. Test delivery to fresh recipient inboxes before wider
  signup; spam handling remains a known private-beta workaround, not a
  completed delivery fix.
- **Final sender decision October 27, 2026:** After Google would not allow
  App Password creation for the support account, the founder chose to retain
  `cheosa.silviu@gmail.com` for automated signup and recovery emails, with
  `commito.support@gmail.com` as the public support/contact inbox. A fresh
  read-only check confirmed that Supabase's From address and SMTP username
  both remain the personal Gmail address, using Gmail port 465 and display
  name Commito; the existing SMTP password remains configured. Public
  support/privacy pages and their app links already direct support requests
  to the support inbox. No SMTP settings or reply routing were changed;
  replies to automated emails are not established as going to the support
  inbox. The unused local password-entry window was closed. No app rebuild
  or domain purchase is needed for this decision. Spam placement remains open.
- **Fail (founder reported, Commito 1.0.2 (27)):** The recovery email opened
  Chrome, requested permission to open Commito, then opened the signed-in app
  without displaying the new-password form. No password change was confirmed.
- **Pass (founder reported after the build 28 test instructions):** A new
  recovery email arrived, its link displayed the change-password screen, and
  changing the password worked. The founder subsequently confirmed that signing
  in with the new password worked and the old password was rejected. This
  completes the basic recovery test. Cold-start and already-running link tests
  remain pending as distinct cases.
- **Pass (founder reported during the TestFlight checks):** Google sign-in
  worked. Provider cancellation was not separately tested.
- **Pass (founder reported after the disposable-account deletion test):**
  Signing in with the deleted account's email/password returned invalid email
  or password. This confirms the observed post-deletion login rejection.
  Check-in persistence during that deletion test and removal of the deleted
  owner's leagues from another member's view were not separately reported;
  those observations are not inferred from the login error. Email confirmation
  and a separate native league/check-in flow subsequently passed as recorded
  elsewhere in this checklist.
- **Fail (founder reported):** Apple sign-in returned an external-code exchange
  error after account selection. A read-only query found a matching Supabase
  auth error at 2026-10-27 11:38:21 UTC with Apple's `invalid_client` response.
  Apple is enabled with Services ID `com.sadik.microhabit.auth`. The app uses
  browser OAuth for Apple. Expired or incorrect client credentials are possible
  causes; secret expiry has not been established from the available metadata.
- **Apple credential renewed October 27, 2026:** After the founder provided
  the key location, a nearby Apple-login key was found and used to generate an
  ES256 client-secret JWT for the existing Services ID and Apple team. The
  generated credential expires March 26, 2027; renew before that date. The
  private key and JWT were kept out of the repository and tool output.
  Supabase accepted a targeted update to `external_apple_secret`; a fresh
  configuration read showed that only this field changed. The API returns an
  opaque secret representation, which did not match the JWT or its SHA-256,
  so exact secret read-back verification was not established. Auth health and
  public settings returned HTTP 200 with Apple, Google and email still enabled.
- **Apple verification boundary:** The generated ES256 signature verified
  locally. Apple returned `invalid_grant` for both a synthetic invalid-code
  request and its invalid-signature control, so these requests do not establish
  that Apple accepts the key. The subsequent real iPhone test below supplies
  the end-to-end result. No app-code change or new build was made for this
  credential renewal.
- **Pass (founder reported after the credential renewal):** After being asked
  to retry Apple sign-in in Commito 1.0.2 (28), the founder confirmed that it
  signed in. This resolves the observed Apple sign-in failure. Provider
  cancellation and account-linking edge cases were not tested by that result.
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
  The founder subsequently confirmed the recovery form and password change on
  the iPhone, successful sign-in with the new password, and rejection of the old
  password. Still verify links with Commito closed and already open separately.
  No additional email was requested by the assistant.

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

- **Pass (founder reported October 27, 2026, following the TestFlight test
  instructions):** Created a free test league, joined it with a second account
  using its invite code, marked today complete, and confirmed the check-in was
  still saved after closing and reopening Commito. This verifies that reported
  installed-app flow; simultaneous two-device updates were not separately
  reported.

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

- [x] Privacy policy and Support both load from Commito Settings on the iPhone
  after publication (founder reported October 27, 2026).
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
  checkpoint. The policy pages were later published on October 27, as recorded
  below.
- First device check: open Commito from TestFlight, then open Settings and
  confirm `Commito 1.0.2 (27)`. Repeat the pending native checks below.

### Build 28 status

- Version 1.0.2 (28) contains the local password-recovery correction described
  above. It does not introduce a separate email-link sign-in option.
- TypeScript, repository ESLint, seven callback tests and three UTC tests pass.
  An isolated browser harness ran the actual auth provider, route gate and
  password screen with mocked native services/authentication. Cold and warm
  recovery, PKCE without a type parameter, ordinary OAuth and expired-link
  routing passed. Mismatched passwords never submitted, a failed save stayed
  on the form, and a successful save returned to leagues with confirmation.
- These synthetic checks do not verify iOS deep links or real password changes.
- Source checkpoint: [7cc6142](https://github.com/KeQue/MicroHabit/commit/7cc614223fe04eff5abaea821c27a9f6ae2cd4fa).
  [iOS build](https://expo.dev/accounts/keke12/projects/microhabit/builds/940eb2f9-5309-48ca-9024-fb16e8ac3cd3)
  finished successfully on October 27, 2026. Expo confirms version 1.0.2,
  build 28, the exact source checkpoint, and a ready artifact.
- [TestFlight upload](https://expo.dev/accounts/keke12/projects/microhabit/submissions/c2b597fd-4849-44a8-ac8b-863a0ee26f7a)
  is FINISHED without a reported error. After receiving the build 28 test
  instructions, the founder confirmed the email opened the password form and
  the password change worked on the iPhone. The installed build number was not
  separately reconfirmed in that report. New-password sign-in and old-password
  rejection subsequently passed (founder reported). Cold/warm link cases still
  need separate verification. No App Store release or branch merge was
  performed. The later Apple credential renewal is recorded above.
- Read-only Supabase auth configuration inspection confirms that
  `microhabit://update-password` is allowed, with `microhabit://sign-in` as the
  site URL. No auth settings were changed during this redirect inspection.
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

The results below supersede the earlier build-26 pending status. Unchecked
items remain unverified even if ordinary tracking works in the SDK 54 Expo
client. Native configuration and production authentication redirects can differ.

- [x] Email confirmation works after moving the message out of Gmail Spam
  (founder reported). Spam placement remains an unresolved onboarding issue.
- [x] Forgot password sends an email; its link opens the correct recovery screen;
  the new password works and the old password no longer does (founder reported
  after the build 28 test instructions; see authentication results above).
- [x] Google sign-in completes on the iPhone (founder reported).
- [x] Apple sign-in completes on the iPhone (founder reported after the October
  27 credential renewal). The previously observed error was `invalid_client`.
- [ ] **Deferred at the founder's request:** Provider cancellation returns to a
  usable screen. This check was skipped, not passed. An Expo client failure is
  not sufficient evidence that the standalone flow is broken.
- [x] Sign out and restart: the app remained signed out after closing/reopening,
  then Apple sign-in succeeded (founder reported).
- [x] After deleting the disposable account, email/password sign-in is rejected
  (founder reported). Shared-league deletion/cascade checks remain separate.
- [x] Daily reminder delivery observed: founder reported it arrived on October
  26. Build/client and exact delivery time were not separately recorded. The
  implementation schedules 17:00 device-local time. These are local reminders,
  not server notifications. Denying
  permission should not prevent using leagues. The developer-only short test
  notification, if present in a development client, does not prove delivery of
  the release reminder. UTC check-in boundaries and local reminder time differ.
- [x] League creation, joining by invite code with a second account, and today's
  check-in persistence after closing/reopening Commito (founder reported during
  the TestFlight checks). Settings policy links and post-deletion login rejection
  also passed as recorded above.
- [ ] Simultaneous two-device updates on the actual beta build remain unverified.
- [ ] **Deferred at the founder's request:** Shared-league owner deletion on the
  installed app. The isolated SQL deletion test passed; native refresh and
  navigation after deletion were not tested.

## Record failures

### Public-page update published October 27, 2026

- Fresh requests to the public Privacy policy and Support URLs returned HTTP
  200, but the live content still matched the older June wording. The owner
  deletion warning and UTC check-in explanation were absent.
- [Documentation-only review](https://github.com/KeQue/MicroHabit/pull/2)
  prepares the two HTML pages and their Markdown copies, based directly on
  current `main`. It includes the free-beta scope, owner-league deletion warning,
  UTC rules, reset-email/Spam guidance, current Google email-delivery service,
  local reminders, and version/build information for support requests.
- HTML and Markdown content match. Isolated browser checks passed at 320px and
  390px: one page heading, contact-link targets, and no horizontal overflow.
  Existing page styles were retained. These checks do not replace opening the
  links from the actual iPhone app or establish legal compliance.
- Read-only GitHub Pages settings confirm that publication uses `main:/docs`.
  After explicit founder approval, review #2 was merged at
  `ba145724ad2f3b1aaf24325bd776f3903867265b`. Comparing this commit with the prior
  main confirms that only the four approved documentation files changed.
- GitHub Pages reports the merge commit as built, without an error. Subsequent
  requests to the canonical [Privacy policy](https://keque.github.io/MicroHabit/privacy/)
  and [Support](https://keque.github.io/MicroHabit/support/) URLs both returned
  HTTP 200 and matched the approved HTML after line-ending normalization.
  Both show October 27, 2026, the free-beta wording and owner deletion warning;
  Support also shows the UTC and Spam/Junk explanations.
- The app beta review remains draft and unmerged. No app build, public App
  Store release, database change or Pages-settings change was made for this
  publication. The founder subsequently opened both links from Commito Settings
  on the iPhone and confirmed that both worked. Other entry points and
  accessibility scenarios remain separate checks.

For each failure, record the action, expected result, actual result, UTC time,
device/build, and whether a refresh/restart changes the outcome. Include a
screenshot when useful, with personal information removed. Keep uncertain or
unperformed checks marked Pending; do not count them as passes.

Do not invite a wider beta group until failures affecting sign-in, joining,
saved check-ins, access to another user's data, or deletion are resolved and
retested on the intended build and backend.
