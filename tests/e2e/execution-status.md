# Mobile login setup and execution record

October 29, 2026. Setup checks and actual native execution are distinguished below.

| Case | Status | Device / OS | App version/build | Backend | Authentication evidence |
| --- | --- | --- | --- | --- | --- |
| TC-001 Android login | PASS: two complete native attempts | Dedicated Commito_E2E emulator, Android 14 / API 34, emulator-5554 | Installed 1.0.2 / versionCode 1 | Production; normal profile/auth effects approved | Both reached successful authenticated leagues loading, then repeated it after process restart |
| TC-002 iOS login | BLOCKED: run cancelled at founder request after 55m 12s in combined build/install | Standard macos-15-intel runner; no Simulator app execution observed | Source configuration 1.0.2 / 36; installed version unknown | Production configured; account secrets never reached a test step | None: TC-002 never started |

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
  PNGs locally, with encrypted-only cloud upload; it has not had a fresh login run.
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

## Prepared corrections and visual reports

These later changes are local and have not been dispatched on GitHub:

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

Android passed on source `350486a`; the current reporting changes are a later
local revision. iOS remains BLOCKED, with zero native attempts. See
[the beginner guide](README.md) for commands and secret-store steps.
