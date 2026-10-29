# Mobile login setup and execution record

October 29, 2026. This records observed setup evidence; it is not a mobile pass.

| Case | Status | Device / OS | App version/build | Backend | Authentication evidence |
| --- | --- | --- | --- | --- | --- |
| TC-001 Android login | PASS: two complete native attempts | Dedicated Commito_E2E emulator, Android 14 / API 34, emulator-5554 | Installed 1.0.2 / versionCode 1 | Production; normal profile/auth effects approved | Both reached successful authenticated leagues loading, then repeated it after process restart |
| TC-002 iOS login | BLOCKED: CI environment secrets/publication pending; cloud run approved | No local Mac/Xcode; standard GitHub macOS Simulator workflow prepared | Source configuration 1.0.2 / 36; no Simulator build executed | Same production account required | None: no iOS Simulator test executed |

Initial Android run: October 29 at 14:04:04 UTC (15:04 Berlin), **310 seconds**
including preflight; attempts **184.1s** and **121.3s**, both PASS. Command:
`npm run e2e:android`, launched by the hidden-input PowerShell wrapper. The
checkout was `21fdaddfc08ca8c2cf6a5c4b9b278876f9232db6` plus the then-uncommitted
QA changes. A repeat against the saved/published QA source commit is planned so
the iOS prerequisite identifies an exact commit. The account was entered only
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
- Maestro 2.12.0 downloaded with approval and verified against the official
  SHA256 `a6044a84542f522f434c5dc3d609e60c7446d423f3ed1b2ae513f5c48663ec5e`.
  It is stored under ignored `tests/e2e/.tools/maestro`.
- `npm run e2e:doctor` ran successfully with normal host-folder access: Java,
  Maestro and ADB available; zero ready Android devices after deliberate shutdown;
  iOS host capability false; no credentials requested or backend contacted.
- Expo SDK 54 / React Native 0.81.5; resolved app version 1.0.2, iOS build 36,
  both native identifiers `com.sadik.microhabit`. `app.json`'s build 29 is stale.
- GitHub `KeQue/MicroHabit` is public; connector reports repository administration
  access. No local CI workflow existed before this change. Prepared cloud work
  remains local; account billing/quota and execution permissions are not proven.
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
  written. Raw test screenshots/command reports remain private and are deleted.
- Nine synthetic result-parser checks passed, including skipped/empty/error and
  timeout counterexamples. These validate reporting behavior, not authentication.
- Two additional synthetic startup checks verify that an executable which fails
  to start, or reports an unvalidated CLI version, returns BLOCKED with zero UI
  attempts. These exercise the independent review's reporting finding.
- Five YAML files parse; the GitHub workflow trigger is manual only. The hidden
  PowerShell prompt parses without errors. No GitHub workflow has run.
- Existing 111 Node tests passed initially and again after the QA changes.
  TypeScript and full lint passed initially. Final focused QA/app-file lint,
  JavaScript syntax and whitespace checks pass. The latest standard TypeScript
  check finds five TS5097 import-extension errors in concurrently added,
  unrelated `supabase/functions` Apple account-deletion files; these were left
  untouched. This is a current workspace check failure, not a mobile result.
- Current GitHub connector capabilities include repository/workflow inspection,
  but do not expose workflow dispatch or secret creation. The prepared beginner
  instructions use GitHub's UI for those actions after cloud approval.

## Boundaries and next action

No isolated database tests were performed. The two Android attempts exercised
the real production authentication and protected app loading through native UI.
No new founder-reported device results apply to these two cases. Existing beta
smoke results concern other flows/builds and do not establish these E2E passes.
No production policy, league/check-in, paid feature, app release or deployment
was changed by this QA work. Unrelated Apple account-deletion work appearing in
the shared workspace is outside this review and must be preserved.

Save/publish the QA source, repeat Android on that commit, and put the same
account in CI environment secrets. Cloud publication and one manual iOS run
are now approved. Only the dispatch workflow needs to exist on the default branch;
it checks out the tested QA commit, avoiding a merge of the older default app
source with the current work. See [the beginner guide](README.md) for commands
and secret-store steps.
