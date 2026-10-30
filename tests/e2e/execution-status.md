# Mobile login setup and execution record

Updated October 30, 2026. Setup checks and actual native execution are distinguished below.

Prepared locally after the final run: iOS now privately verifies fields and
captures the input screen before submission, then continues the same session.
The final screen is still captured for each attempt. Both phases share the
six-minute UI budget; exact email matching and populated/masked password state
are distinguished. Error classification includes only designated error-node
children; explicit auth/load errors fail promptly without shortening the success
allowance. The disposable Simulator's AutoFill workaround requires readback of
both settings. These are diagnostic/input-workaround changes, not a proven fix
for the previous authentication failure.

Prepared speed changes: optional 1 GiB native compiler cache, verified Maestro
download reuse, installed-driver reuse and disabled build indexing. The last
Apple Silicon run's compilation took about **11m 29s**, compared with **18m 06s**
on the preceding Intel run; these observations do not isolate a hardware cause.
Other build/setup phases still took about six minutes. A warm native compiler
cache has not yet been measured. Cache writes precede account access and exclude
app bundles, JS bundles, device/Keychain data, raw logs and visual reports.
The build limit remains **60 minutes**; the job allows **110 minutes**, with a
28-minute test-step ceiling to accommodate the additional evidence. Standard
runner/manual triggers remain in place. No cloud run or workflow publication
was started while preparing these changes.

Validation: **138 Node checks passed**, including 27 QA infrastructure checks.
Four flows passed the installed Maestro 2.12.0 syntax checker; ten workflow Bash
blocks parsed, and cache/account-step boundaries were checked. Focused ESLint
and diff whitespace checks passed. These checks do not prove Mac execution,
actual AutoFill file availability, cache savings or iOS authentication. Existing
unrelated Deno import errors from the full TypeScript check remain outside scope.

Local native verification of committed source
`a9ac59a4dc76d9e0781d265f334d9161aa6b3755` on October 30:

- **10:25:11 UTC (11:25 Berlin), BLOCKED**, zero attempts. The current system
  error-window guard caught a cold-boot System UI error. A verified native system
  Wait control was selected outside the case, then the current window guard
  confirmed healthy state. The blocked report remains in dated history.
- **10:29:36 UTC, FAIL**, first attempt PASS (**104.2s**), second FAIL (**93.1s**)
  after `process-restarted`, on `e2e-leagues-error`. Both own images were captured
  and reviewed. The second showed **Network request failed**, not a login form;
  the prior authenticated-load checkpoint had completed. Total **263.8s**.
  History: `TC-001-2026-10-30T10-29-36-492Z-8c75c625`.
- A verified Refresh was selected after the failed case, outside its assertions.
  A separate native inspection subsequently confirmed server-loaded state and
  no league-loading error. Host reachability/Android capability mentions alone
  did not establish recovery or explain the earlier network interruption.
- **10:39:30 UTC (11:39 Berlin), PASS**, a new complete two-attempt run after
  observed recovery: **92.2s**, **74.1s** UI; captures **23.0s**, **24.3s**; total
  **218.8s (3m 39s)**. Both own native images were reviewed and showed authenticated
  Leagues loading after restart, with no credential fields/errors. The saved
  account was reused without a prompt. History:
  `TC-001-2026-10-30T10-39-30-355Z-56b62334`. The browser report opened; raw capture
  directories and run lock were absent afterward, and the dedicated emulator
  was closed. This fresh PASS does not erase or explain the earlier failure.

The same-device passing baseline took 319.3s; this run was 100.5s shorter, with
49.4s less capture time. This does not isolate the effect of driver reuse or
establish an iOS saving. Next measurements should compare cold/warm Mac compiler
cache times separately from UI and image time. A useful follow-up diagnostic
improvement is fixed league-loading error categories, preserving real network
failures rather than refreshing/retrying inside an assertion. No cloud run,
workflow publication, app release or backend policy/schema change followed this
local verification; iOS still requires explicit run approval.

| Case | Status | Device / OS | App version/build | Backend | Authentication evidence |
| --- | --- | --- | --- | --- | --- |
| Login on Android (TC-001) | PASS: two native attempts, each with its own screenshot | Dedicated Commito_E2E emulator, Android 14 / API 34, emulator-5554 | Installed 1.0.2 / versionCode 1 | Production; normal profile/auth effects approved | Both reached successful authenticated leagues loading, then repeated it after process restart; loaded state verified around each photo |
| Login on iOS (TC-002) | FAIL: first attempt submitted login but did not reach authenticated loading; its screenshot retained | Standard macos-15 Apple Silicon runner; dedicated iPhone 16 Simulator, iOS 18.5 | Installed 1.0.2 / 36 | Production; scoped environment secrets | Completed checkpoint login-submitted; failed assertion e2e-leagues-loaded; other-auth-error present; exact cause unknown. Second attempt not run |

The final approved iOS run [40957455640](https://github.com/KeQue/MicroHabit/actions/runs/40957455640)
tested source `b21d8d8fe0888a71d50ed5fb7f84768530f278dc` on October 29.
Build and installation succeeded (phase messages from 21:25:37 to 21:43:03 UTC).
Native preflight confirmed the selected Simulator booted in 4.3 seconds.
The first login attempt started at **21:43:58 UTC (22:43 Berlin)** and failed
after **238.9 seconds**. It completed `login-submitted` but failed the assertion
for `e2e-leagues-loaded`. Both screenshot inspections found the login controls
and `other-auth-error`, with no server-loaded marker. This establishes an
executed login failure, not its root cause or an incorrect-password diagnosis.
The actual redacted native photo was retained (90.3 seconds capture/inspection),
visually reviewed, and embedded in the browser report. Total native runner time
was **351.4 seconds**. The encrypted artifact digest was verified before local
decryption. Local history:
`history/TC-002-2026-10-29T21-43-58-165Z-aab61238/report.html`.
The founder requested stopping after this run; no further native/cloud run began.

On October 30 the founder requested visible email and native masked password
fields in future private photos. The local screenshot policy now permits those
specific stable fields while preserving password/keyboard redaction when masking
cannot be verified. No native login was executed to check this change. Existing
photos remain unchanged because their raw pixels were discarded. Synthetic PNG
checks cover native mask preservation, plaintext/partial reveals, moved fields
and keyboard overlays; these do not establish device behavior.

Initial Android run: October 29 at 14:04:04 UTC (15:04 Berlin), **310 seconds**
including preflight; attempts **184.1s** and **121.3s**, both PASS. Command:
`npm run e2e:android`, launched by the hidden-input PowerShell wrapper. The
checkout was `21fdaddfc08ca8c2cf6a5c4b9b278876f9232db6` plus the then-uncommitted
QA changes. The repeat against saved source
`350486afb8a6a2c6e36921f50697410ccc78eb5d` started at **14:34:38 UTC** and
passed both attempts (**112.0s**, **100.8s**), **229.8s** including preflight.
It used the same installed APK/backend/account. The account was entered only
in the local hidden-input window; raw per-run artifacts were deleted afterward.
Setup/build time is separate. Sanitized machine results are ignored in `results/`.

The screenshot-enabled run on committed source
`bda5812474768349ef67a7d66c3048d5d68688ad` started at **18:29:15 UTC
(19:29 Berlin)**. Both attempts passed (**147.1s**, **117.6s**); total runtime
including preflight/capture was **445.2s**. Attempt 1 retained its own native
photo; attempt 2 reported `hierarchy-unavailable` and discarded raw pixels.
The old diagnostic does not distinguish timeout, command failure or parsing
failure, so its precise capture failure remains unknown. No later photo has
been substituted for attempt 2.

Two subsequent capture-only probes succeeded (**33.4s**, **24.2s**) on the
already authenticated emulator, with the loaded marker checked before/after
capture. These are not login attempts and do not repair the earlier evidence.
The next local correction gives hierarchy startup more time, records the capture
phase/category/timing, and makes missing required photos return blocked exit 2
without rewriting a functional PASS.

The corrected source `abb5d0f894f644a94b35407d09fd616fb6f960dd` ran at
**18:46:45 UTC (19:46 Berlin)**. Both real login/restart attempts passed
(**93.1s**, **109.2s**), with distinct native photos captured at **18:48:44 UTC**
and **18:51:16 UTC**. Capture took **32.3s**, **38.7s**; total **282.8s**.
Both images were visually inspected, embedded directly under their own attempt,
and showed the authenticated leagues screen with no credential fields.
`evidenceStatus=COMPLETE`; no raw directories or run lock remained. The report
opened through the explicit browser helper. The HTML includes post-run
improvement suggestions. This is actual Android evidence, not an iOS result.

After the founder requested credential reuse, Windows-only current-user DPAPI
storage was added locally for both email and password, with restricted folder
and file access and a backend-context check. Thirteen synthetic checks passed:
roundtrip, no plaintext fields, permitted access rules, backend mismatch,
corruption, replacement, removal, missing store and rejected external path.
The first permission implementation required a security privilege; restricting
changes to access rules corrected this without changing ownership/audit rules.
The real account was subsequently saved by the founder in the masked local
window. Both fields can be decrypted by the current Windows user without
printing either value. The saved-account native run on `f18f68f` started at
**18:57:11 UTC (19:57 Berlin)** and passed both attempts (**77.9s**, **85.1s**),
with each photo retained (**34.9s**, **28.9s** capture time). Total **231.4s**.
The wrapper reused the encrypted account automatically without another prompt.

The dated-history/timing revision `07319159ded21af57b5a497ee29337e8411062b2`
then passed both native Android attempts at **19:04:36 UTC (20:04 Berlin)**:
**100.7s**, **89.1s**, with captures **32.3s**, **37.5s**, total **264.4s**.
Both native photos were visually reviewed and embedded under their own attempt.
The dated HTML exactly matches the latest HTML; the previous passing run remains
unchanged in history. The comparable baseline is `f18f68f`; this run took 33.0s
longer, which is an observation rather than evidence of a causal regression.
Measured native PNG capture was 1.1s/1.4s; hierarchy-before/after inspection
accounted for most of the remaining capture time. All **124 Node tests** passed
(111 existing plus 13 report/history checks); the separate 13 synthetic Windows
store checks also passed. Raw directories and the local run lock were removed.

The diagnostics/keyboard revision `645967448a48c41b7f309140a77d5d9119030044`
has **126 passing Node checks**. Its Android run at **20:07:00 UTC** passed
both functional attempts (123.1s/85.3s), but attempt 1's image failed coordinate
validation and was discarded; attempt 2 retained its image. This run remains
INCOMPLETE in dated history, with no substitute image or rewritten result.
The exact transient coordinate mismatch was not retained and remains unknown.

A complete repeat on the same source/account/build started **20:13:28 UTC
(21:13 Berlin)**. Both native attempts passed (101.3s/68.0s), with distinct
images captured at **20:15:30 UTC** and **20:17:04 UTC**, each visually reviewed.
Both showed authenticated leagues loading with no login/error elements, verified
before and after capture. Total 226.3s; capture 27.1s/25.9s. This was 38.1s less
than the matching `0731915` baseline, including 16.8s less capture time; timing
alone does not establish a cause. The protected account was reused automatically.
Afterward the dedicated Android emulator was closed to free laptop memory.

The readiness revision `06798ca` had **129 passing Node checks**, but its
Android cold-start run at **20:59:45 UTC** failed before credential entry:
last completed checkpoint `app-launched`, failed assertion `e2e-login-email`.
Attempt duration 217.2s; capture 123.3s was rejected for unverified coordinates.
The failed/incomplete result remains in dated history. A private native probe
afterward found a **System UI** ANR dialog with the actual Android Wait resource
identifier. Its hierarchy contained only a partial viewport; no image has been
substituted for that failed attempt. The emulator was awake/unlocked and the app
process existed, so those setup flags did not establish UI readiness. Only after
the case had ended, the verified system Wait button was selected and the dialog
cleared. A new preflight check blocks current Android error windows before login,
with fixed diagnostics; historical ANR mentions and arbitrary window titles are
not retained or treated as a current dialog.

The final setup-guard source `b21d8d8fe0888a71d50ed5fb7f84768530f278dc`
then passed both real Android attempts at **21:17:06 UTC (22:17 Berlin)**:
114.0s/104.5s, with its own photos at **21:19:30 UTC** and **21:22:09 UTC**.
Each image was visually reviewed and showed authenticated leagues, with the
server-loaded marker and absence of login/error elements checked around capture.
Capture took 56.9s/39.8s; total 319.3s. Compared with the matching `6459674` run,
total time was 93.0s longer, including 43.7s more capture time; no causal speed
claim is made. The new system-window preflight reported ready. Account reuse
required no new entry. The failed `06798ca` run remains unchanged in history.
All **131 Node checks** passed, as did nine Bash syntax checks and five actual
readiness-pipeline fixtures (ready, stopped, absent, unavailable, malformed).

## Observed environment

- Windows laptop, 8 GB RAM (founder supplied). Android Studio and its Java
  21.0.9 are installed. SDK has ADB 36.0.2 and emulator 36.3.10.
- Existing Pixel_7 Android 14 x86_64 image uses 2 GB RAM. WHPX acceleration
  reports installed/usable. An API 36.1 image also exists; no new image requested.
- Initial startup could not create lock files in the restricted sandbox. The
  startup retry left child processes; exact ownership was inspected, those
  processes were stopped, and one cold boot was attempted. ADB still reported
  unauthorized. That emulator was stopped for the memory-limited build.
- A dedicated `Commito_E2E` AVD was created under ignored tools using the existing
  Android 14 image, without wiping the existing AVD or downloading an image.
  It booted with authorized ADB. First-boot System UI and system-process ANR
  dialogs were handled with Wait; the native login UI then rendered all three
  expected selectors. These are environment startup findings, not login failures.
  After the repeated passes, the emulator was closed to free laptop memory.
  The helper's console-name query returned empty on this installation; it now
  reads `ro.boot.qemu.avd_name` instead. Running it against the existing test
  emulator correctly reported reuse and exited without starting another process.
- Maestro 2.12.0 downloaded with approval and verified against the official
  SHA256 `a6044a84542f522f434c5dc3d609e60c7446d423f3ed1b2ae513f5c48663ec5e`.
  It is stored under ignored `tests/e2e/.tools/maestro`.
- `npm run e2e:doctor` ran successfully with normal host-folder access: Java,
  Maestro and ADB available; zero ready Android devices after deliberate shutdown;
  iOS host capability false; no credentials requested or backend contacted.
- Expo SDK 54 / React Native 0.81.5; resolved app version 1.0.2, iOS build 36,
  both native identifiers `com.sadik.microhabit`. `app.json`'s build 29 is stale.
- GitHub `KeQue/MicroHabit` is public; connector reports repository administration
  access. QA source is published on `qa/mobile-login-e2e` at `350486a`. Only the
  manual dispatcher workflow was added to the older default branch, `main`.
  The dispatcher checks out the exact Android-tested QA commit. Account secrets
  are in `e2e-login`; the backend environment/host/public key are configured there.
  Standard public-repository runners were verified before dispatch.
- Read-only EAS inspection found Android production builds from March 20/21,
  version 1.0.1/build 1. They lack the new selectors and are unsuitable for the
  current regression. No cloud build was launched.
- User approved normal production login effects and the local Android build's
  required downloads. The first Gradle build stopped after 12m 36s because the
  previously working Studio JBR lost `lib/jvm.cfg` and other runtime files.
  Read-only checks confirmed the files are missing outside the sandbox too;
  cause is unestablished. A separate Temurin 21.0.12.1 JDK was downloaded into
  ignored tools and its official SHA256 verified. Doctor passes with that JDK.
  The cached Release retry succeeded in **21m 25s**, using two workers and 2 GB
  Java heap, x86_64 only. The resulting 38,084,847-byte APK installed successfully
  on the dedicated emulator. Android reports version 1.0.2/versionCode 1.
  The generated bundle contains the approved production hostname. A visible
  PowerShell window collected masked local account entry and the runner completed
  two actual login/load/session-restoration attempts. Credentials were not supplied
  through chat or command-line arguments, and the prompt process exited afterward.
  It does not deploy or run backend operations. NDK 27.1, CMake 3.22.1 and
  build-tools 36.0.0 were installed as approved build dependencies.

## Review and checks

- Independent QA Test Designer inspected real auth and home loading. It rejected
  headings/empty state as proof because they can appear before authentication
  finishes or after load errors. The conditional loaded marker and process
  restart assertions implement the accepted design. Final independent static
  review found no heading/empty-state false-pass path. It found a missing status
  link target and startup failures incorrectly labelled FAIL; both were fixed.
- QA Automation Engineer produced the first implementation; that agent hit its
  usage limit. The coordinating agent completed/reviewed the remaining work.
- QA Runner/Debugger installed Maestro, checked actual CLI options and validated
  both wrapper flows and their shared flows with Maestro `check-syntax`: OK.
  Only dummy credentials were used for syntax checks; no login occurred.
- Synthetic logging probes found native Windows DebugLogStore ignores Java home
  for its folder. Disabling JUL with a private configuration and suppressing
  Log4j messages plus exception traces (`%ex{0}`) prevented sentinel message and
  exception content from reaching those logs. OS/version metadata can still be
  written. Raw test screenshots/command reports were private and deleted. The
  subsequent requested visual-report feature retains only safely redacted native
  PNGs locally, with encrypted-only cloud upload; the later login run and its
  incomplete evidence are recorded above.
- Nine synthetic result-parser checks passed, including skipped/empty/error and
  timeout counterexamples. These validate reporting behavior, not authentication.
- Two additional synthetic startup checks verify that an executable which fails
  to start, or reports an unvalidated CLI version, returns BLOCKED with zero UI
  attempts. These exercise the independent review's reporting finding.
- Five YAML files parse; the GitHub workflow trigger is manual only. The hidden
  PowerShell prompt parses without errors. The approved iOS run is recorded below.
- Existing 111 Node tests passed initially and again after the QA changes.
  After adding visual reports, the original **111** tests passed again and all
  **six** reporting checks passed, including the independent review's identifier
  counterexamples (117 checks in total). These are not
  additional mobile test cases. The changed JavaScript files pass focused lint.
  TypeScript and full lint passed initially. Final focused QA/app-file lint,
  JavaScript syntax and whitespace checks pass. The latest standard TypeScript
  check finds five TS5097 import-extension errors in concurrently added,
  unrelated `supabase/functions` Apple account-deletion files; these were left
  untouched. This is a current workspace check failure, not a mobile result.
- The GitHub connector supports repository/workflow inspection but lacks dispatch
  and environment configuration endpoints. Those operations used GitHub's REST
  API with the existing local GitHub sign-in; its token stayed in process memory.
  The founder supplied account secrets directly through GitHub's form.

## GitHub execution

- Initial [run 40893636938](https://github.com/KeQue/MicroHabit/actions/runs/40893636938)
  stopped before allocating a runner (about four seconds): the environment allowed
  the QA source branch, but dispatch uses `main`. This was an environment blocker,
  not an iOS login failure; no build/account operation occurred.
- The environment restriction was corrected and freshly read back: only `main`
  is allowed. The beginner instructions now distinguish the dispatcher branch
  from the checked-out source. This verifies the counterexample: a permitted
  source branch alone does not authorize a dispatch from a different branch.
- [Run 40893761972](https://github.com/KeQue/MicroHabit/actions/runs/40893761972)
  was dispatched at **14:40:02 UTC** using tested source `350486a`, workflow
  commit `d4bebc3`, the same configured account and approved production effects.
  The founder subsequently instructed cancellation. GitHub confirms CANCELLED
  at **15:38:08 UTC**. Job time was **57m 57s**; combined build/install time was
  **55m 12s**. TC-002 was skipped. The downloaded job log's only error is
  "The operation was canceled." It contains no build-subphase milestone; the
  original exit trap discarded private build logs. The actual stalled command
  is therefore **unknown**, and neither an app defect nor Xcode failure is proven.
- Workflow-only commit `481eca9` adds safe setup/build stage messages for future
  runs. Fresh commit inspection confirms the workflow is its only changed file.
  It does not alter the active run or the Android-tested app/flow/runner source.
- After the founder requested the prepared improvements and iOS execution,
  workflow-only commit `5c30ab9` was published and freshly verified to contain
  only the reviewed dispatcher. This also triggered the existing unchanged
  Pages rebuild, which succeeded. The QA source branch was pushed at `0731915`;
  credentials, keys, reports and unrelated Apple work were excluded.
  Environment metadata was freshly verified: production backend, account secret
  names present, report public key matches the local private-key pair, only main
  is permitted. Standard public-repository macOS execution remains the route.
  [Run 40937553476](https://github.com/KeQue/MicroHabit/actions/runs/40937553476)
  was accepted at **19:09:49 UTC (20:09 Berlin)**. Dependencies installed
  successfully; the bounded build step started at **19:12:00 UTC**.
  Its completed build and failed login are recorded below.

## Completed instrumented iOS run

[Run 40937553476](https://github.com/KeQue/MicroHabit/actions/runs/40937553476)
tested source `07319159ded21af57b5a497ee29337e8411062b2`. Its unsigned
Simulator Release build/install succeeded in **25m 41s**, within the new
60-minute limit. Recorded phases: Expo generation about 6s, CocoaPods 2m 32s,
Xcode compilation 18m 49s, Simulator startup 2m 44s, installation 1m 12s.
The npm/CocoaPods cache saved successfully before account access; a warm-cache
speedup has not yet been measured. This success does not explain the original
cancelled run's unknown stall.

The first native iOS attempt started **19:39:28 UTC** and failed after
**269.3s**; the runner correctly stopped rather than retrying a failed case.
Its own redacted screenshot was captured at **19:45:43 UTC**, then encrypted
for upload. Local decryption and visual inspection showed the sign-in screen;
the credential fields and keyboard region remain masked. Capture took 150.8s,
mostly two native hierarchy reads (69.1s/72.1s). The failure's exact command was
not retained by the original sanitized summary, so neither an account error nor
a keyboard failure is established. The failed report remains in private history.

The local correction records only completed, fixed checkpoints and allowlisted
failed command/target names from private command JSON before deleting it. It
also retains fixed error categories from the designated app error element,
never raw messages or input values. A no-account native fixture verified the
pinned CLI's actual report schema; synthetic checks reject pending checkpoints,
secret-bearing fields and unknown targets. The iOS flow uses the documented
non-interactive-header keyboard-dismissal workaround; this remains a proposed
fix until native iOS execution verifies it. Only the second screenshot hierarchy
read skips redundant driver reinstall; first reads and tests retain fresh setup.

## Approved follow-up iOS run

The founder explicitly approved **one** follow-up run. Before dispatch, the three
existing `e2e-login` secrets were encrypted with GitHub's environment public key
and updated from the Windows-protected Android-verified account and local public
backend key. Only secret names/update metadata were retained; values, GitHub
tokens and response bodies were not printed. The helper used the official
libsodium sealed-box implementation; synthetic roundtrip, wrong-key and tamper
checks passed. No password was obtained from Supabase or entered again in chat.

[Run 40947806079](https://github.com/KeQue/MicroHabit/actions/runs/40947806079)
uses exact Android-tested source `6459674`, the unchanged reviewed dispatcher
on `main`, the same standard Intel Mac/Xcode/runtime, scoped production consent
and matching report recipient. The public repository, environment's main-only
policy, secret names and complete Android evidence were freshly verified before
dispatch. No additional Pages publication or app release was triggered.

The run completed with a **BLOCKED** native result at **20:50:17 UTC**, after
62.1s of preflight, with zero UI attempts: the runner could not confirm the selected
Simulator as available/booted. Build/install had succeeded in about **28m 14s**.
No attempt image exists because no login attempt started. The encrypted report
was downloaded with its SHA-256 digest verified and opened privately in a browser;
it remains in dated history beside the earlier failed attempt's image.

The public download cache hit (199 MiB). CocoaPods took about **1m 21s**, compared
with 2m 32s previously; Xcode took about **18m 06s**, compared with 18m 49s.
Simulator startup increased to **4m 01s** and installation to **3m 30s**.
The cache does not cover compilation or Simulator output, and the slower total
does not establish an overall caching speedup. Configuration/build variability
and slow Simulator operations remain separate from account authentication.

Review found a concrete diagnostic defect: the same generic "select a booted
Simulator" blocker covered a 20-second query timeout, command error, invalid JSON,
missing device and confirmed non-booted state. The old result does not identify
which occurred; calling it an executed login failure from GitHub's failed step
alone was incorrect. The prepared correction distinguishes those cases, allows
90-second queries with one bounded read-only retry, checks readiness again after
installation and retains fixed diagnostic/state/timing evidence in JSON/HTML.
The selected available/booted device, installed version, real auth assertions,
two attempts, screenshot requirements and the 60-minute build limit remain required.

The next dispatcher is prepared locally for the standard `macos-15` Apple Silicon
runner. Official image documentation confirms installed Xcode 16.4 and iOS 18.5;
public standard runners remain free. This is a proposed hardware change to measure,
not a demonstrated fix for the earlier Intel behavior. No further cloud run or
workflow publication had been started when that correction was prepared.

A separate read-only configuration check at **20:30:05 UTC** returned HTTP 200
from the production public Auth settings endpoint using the synchronized public
key, with email login enabled. It used no account password and changed no setting.
This verifies public backend configuration, not native iOS authentication.

## Authorized Apple Silicon verification

After the complete Android evidence above, the founder explicitly approved
publishing the prepared workflow and **one** standard Apple Silicon run.
Workflow-only main commit `7f978d970b18c67f9bf546f3cb7d108fb8e6b2a0` was freshly
verified to change exactly `.github/workflows/e2e-ios-login.yml`; its content
matches the reviewed dispatcher. The existing Pages rebuild has unchanged site
content; no app release or backend policy was published. Final preflight freshly
verified exact Android source/evidence, public-repository eligibility, production
context, trusted environment policy, secret names and encryption recipient.

[Run 40957455640](https://github.com/KeQue/MicroHabit/actions/runs/40957455640)
was accepted at **21:23:56 UTC (22:23 Berlin)** for source `b21d8d8`. It retains
Xcode 16.4/iOS 18.5, the 60-minute build limit, post-install readiness checks,
scoped credentials, two native attempts and encrypted-only reporting. Setup
succeeded and the bounded build is active at this entry's preparation; native
iOS login success remains unproven. The local Android emulator was closed after
its completed run to free laptop memory.

## Earlier prepared corrections and visual reports

The following records describe preparation before the completed run above:

- Build/install has its own **60-minute** step limit; the overall job limit is
  100 minutes to allow setup, tests, encryption and cleanup. The old run's limit
  was unchanged until it was explicitly cancelled as requested.
- Expo project generation and CocoaPods installation have separate phase records,
  followed by compilation, Simulator startup and installation. Safe minute
  heartbeats and an always-run diagnostic/cleanup step identify the last phase,
  exit/interruption status, log timing/size and fixed diagnostic categories.
  Raw log text is never printed. A missing exit record is labelled interrupted;
  GitHub's annotation distinguishes timeout from cancellation.
- The original Simulator selector accepted any first available iPhone across
  runtimes. The replacement pins installed Xcode 16.4 / iOS 18.5 and creates a
  dedicated iPhone 16 Simulator; missing tooling blocks without image downloads.
  It compiles only that architecture and boots the Simulator after compilation.
  These address reproducibility/resource weaknesses, **not a proven stall cause**.
- Nine final synthetic workflow scenarios passed for compiler failure, interrupted
  boot, signal interruption, successful installation without a login claim,
  unknown errors, missing bundle/runtime, failed CocoaPods and rejected cleanup
  paths. All Bash blocks parse. Valid RSA, EC and truncated keys exercise early
  key validation: only the supported RSA key proceeds. No cloud job was invoked.
- npm/CocoaPods download caches exclude app output, DerivedData, Simulator data,
  logs and all visual reports. Saves occur before account secrets are available.
  Savings and the revised native build remain unmeasured until an approved run.
- Each new native PASS or FAIL attempt requests a credential-redacted screenshot
  and self-contained private HTML. Unsafe/unavailable capture is explicitly
  INCOMPLETE rather than manufactured. Existing assertion-time images cannot be
  recovered from the earlier runs. A later Android image is supplementary only.
- The ignored local report private key was generated and its matching public key
  configured/read back in `e2e-login`. Only encrypted HTML may be uploaded for
  cloud viewing; encryption roundtrip, tamper/wrong-key rejection, moved-field
  masking, pixel preservation and unsafe-coordinate rejection passed locally.
- The designer independently reviewed the later workflow/report changes. Three
  findings were fixed and checked: PASS photos now require the authenticated
  marker before/after capture, only the actual `resource-id` can identify that
  marker (not an unrelated text label), and invalid report keys block before a
  costly build. The functional JUnit result remains separate from image evidence.
- A supplemental Android photo was initially rejected because the cold-booted
  emulator showed an Android System UI ANR. A safe identifier-only inspection and
  ADB focus confirmed the OS dialog. The verified OS Wait button was selected;
  no login/account/league action was performed. This does not change the earlier
  Android pass or count as a fresh login test.
  A subsequent native image succeeded at **15:56:36 UTC**, with the authenticated
  marker present before and after capture and no credential fields. It is embedded
  in the ignored local Android HTML report and explicitly labelled supplemental;
  the two earlier attempts still have no assertion-time photographs.
- No new cloud run has been started after the founder prohibited it. Publishing
  to `main` would also trigger the existing Pages rebuild, so that publication
  is held. A fresh Android pass on the new report source and an explicitly
  approved instrumented Mac run are needed to validate the new device behavior
  and determine whether an additional build fix is required.

## Boundaries and next action

No isolated database tests were performed. The repeated Android attempts exercised
the real production authentication and protected app loading through native UI.
No new founder-reported device results apply to these two cases. Existing beta
smoke results concern other flows/builds and do not establish these E2E passes.
No production policy, league/check-in, paid feature or app release was changed
by this QA work. Publishing the workflow on `main` triggered the repository's
existing GitHub Pages rebuild/deployment; the site content was unchanged.
Unrelated Apple account-deletion work appearing in
the shared workspace is outside this review and must be preserved.

Android passed on sources `abb5d0f` and `f18f68f`, with complete per-attempt visual
evidence and real saved-account reuse, followed by `0731915`. The founder then requested implementation
of the proposed report history/timing improvements and iOS execution. Dated local
archives preserve self-contained images, with timing comparisons restricted to
matching device/build/backend/tool settings and repetition count. Cloud report
generation creates no plaintext history; local decryption archives downloaded
iOS reports. Twenty focused reporting/history/diagnostic checks pass (131 Node
checks total),
including two distinct per-attempt images, explicit browser selection, missing
image exit status, and evidence-based post-run suggestions. No new app code,
test assertions or backend behavior changed. iOS now has one failed native
attempt with its own screenshot; two successful attempts remain required. See
[the beginner guide](README.md) for commands and secret-store steps.
