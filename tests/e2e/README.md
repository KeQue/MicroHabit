# Commito mobile login regression

Only two mobile cases exist: [Login on Android](cases/TC-001-android-login.md)
and [Login on iOS](cases/TC-002-ios-login.md). Both use the same existing
email/password account, sequentially, through the real UI and Supabase backend.
No accounts or leagues are created, no check-ins change, and nothing is deleted.
Normal login **does** update authentication metadata and upsert the profile's
ID/email. Production use needs approval covering those effects.

Implementation and environment checks are not device passes. Read
[the setup/execution record](execution-status.md) for the observed results.

## What proves a pass

The flow starts with cleared local app data and visible login inputs. It enters
the runtime credentials, submits once, then requires `e2e-leagues-loaded`.
This identifier exists on the existing leagues container only after the app's
server `getUser`, profile upsert and league query have succeeded. Empty accounts
are supported. The heading and "No leagues yet" alone are insufficient: those
can appear during loading or after an error.

The flow stops/restarts the app **without clearing storage** and requires the
same server-loaded state again, with no auth/load errors or login inputs. The
runner stops after one pass, or retries once after a failure. Both attempts and
their screenshots remain in the report; a pass on retry is marked flaky. Missing
required screenshots still fail the evidence check. This proves the login/load/restore
journey, not every authentication security property or other app flow.

## Files and tools

```text
tests/e2e/
  agents/                 Reusable instructions for the QA roles
  cases/                  Human-readable TC-001 and TC-002
  maestro/                One wrapper per platform
    shared/               Shared login and authenticated-state assertions
  scripts/                Runner and hidden PowerShell credential prompt
  results/                Ignored machine results and temporary raw files
  .tools/                 Ignored local tools/build caches
```

After a run, the runner follows [the report and performance improvement agent](agents/report-improvement-engineer.md)
to review recommendations and look for evidence-backed speed improvements. This
is an assistant workflow, not an unattended service: it runs when an assistant is
working on the report and does not independently start tests or cloud jobs.

Reuse Node/npm, Expo SDK 54, Java 21, Android SDK and the existing
Pixel_7 Android 14 image. Maestro CLI is pinned to **2.12.0**. No npm testing
framework is added. `app.config.ts` resolves to version 1.0.2, iOS build 36 and
`com.sadik.microhabit` on both platforms. The small `pngjs` development utility
redacts native screenshot pixels; it is not a mobile test framework.
`app.json` still contains build 29;
the resolved dynamic configuration is authoritative. Installed build details are
read from the device when available, rather than assumed from these files.

## Android on this Windows laptop

1. Open PowerShell in `C:\Users\sadik\microhabit`.
2. Run `npm run e2e:doctor`. This checks tools without requesting credentials or
   contacting Supabase. Exit code 2 means setup is incomplete.
3. Use the approved local Maestro installation in `.tools`. For a new machine,
   obtain [Maestro's official release](https://github.com/mobile-dev-inc/Maestro/releases/tag/cli-2.12.0),
   verify `checksums_sha256.txt`, and extract it under `tests/e2e/.tools`.
   Windows is supported natively; WSL is unnecessary. The archive is about
   333 MiB. Large downloads require the machine owner's approval.
4. Install a **current Release APK containing these selectors** on a dedicated
   emulator. March's version-1.0.1 cloud builds lack them. Do not use Expo Go,
   an AAB, or an old TestFlight binary for these cases.

The first local build downloads free Gradle/NDK/CMake/Maven dependencies and can
use several GB. Approval was granted for this setup session. On a future machine,
confirm download/disk capacity first. Stop the emulator during compilation on
an 8 GB laptop. Run these commands only when a new APK is needed:

```powershell
$env:JAVA_HOME = (Get-Content tests/e2e/.tools/jdk/installation.json | ConvertFrom-Json).home
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:GRADLE_USER_HOME = "$PWD\tests\e2e\.tools\gradle-cache"
$env:NODE_ENV = 'production'
node node_modules/expo/bin/cli prebuild --platform android --no-install --skip-dependency-update react,react-native
.\android\gradlew.bat -p android :app:assembleRelease --no-daemon --max-workers=2 '-Dorg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m' '-PreactNativeArchitectures=x86_64'
```

Expo prebuild may rewrite the existing `android`/`ios` npm shortcuts; keep their
original `expo start --android` / `expo start --ios` values if this happens.
Native build output stays ignored. The Release APK embeds its JavaScript;
Metro is not required. This APK uses the local test signing configuration,
not a store release or deployment. The backend comes from the public Expo
environment variables at build time; never put account credentials in `.env`.
The separate ignored JDK is used on this machine because Android Studio's Java
runtime lost required files during setup; its cause is unestablished. On another
machine a working Java 21 installation can be selected with `JAVA_HOME` instead.

After compilation, start the dedicated test emulator using the already installed
Android 14 image. This keeps its disposable app data separate from existing AVDs:

```powershell
.\tests\e2e\scripts\start-android.ps1
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb devices -l
& $adb -s emulator-5554 install -r android/app/build/outputs/apk/release/app-release.apk
```

Use the actual serial from `devices -l` below. It must say `device`, not
`offline` or `unauthorized`. A cold boot may be needed after an ADB key change.
Do not delete keys or wipe a device holding important data to resolve this.
The helper refuses to start while another emulator is detected. It writes only
the dedicated AVD under ignored `.tools/avd`; it never downloads an image or wipes
an existing AVD. Its first boot creates local guest storage from the installed
image. `-Headless` is available for automated sessions; native UI tests still run
inside the emulator.

## Enter credentials securely and run Android

Use an existing confirmed, dedicated test account. Never paste its password into
chat, source files, YAML, a shell command or a shared bug report. The login email
may appear in private screenshots as requested; the actual password must not. Do not run
PowerShell transcription/screen recording while entering or running credentials.
The prompt hides both email and password, passes them only to the test process,
and restores the previous process environment afterward.

The founder authorized remembering this account locally. On Windows, save it
once using the same non-secret backend settings shown below:

```powershell
.\tests\e2e\scripts\manage-credentials.ps1 -Action save
```

Both email and password are encrypted with current-user Windows DPAPI in ignored
`.tools/credentials/login.dpapi.json`. File access is restricted to your Windows
account and SYSTEM. No password is saved in `.env`, Git, a command line or a
report. This protects the stored file; programs running as your Windows account
can decrypt it. Do not share the file or use it as a portable password backup.
Supabase stores a password hash, which cannot supply the original password.

Subsequent calls to `prompt-credentials.ps1` automatically reuse the saved account
when the configured backend matches. For automation, add `-RequireSaved` to fail
instead of prompting when no saved record exists. Corrupt, unreadable or
different-backend records block without falling back silently. CI continues to
use its separate GitHub secrets; the local encrypted file is never uploaded.
To replace or remove the saved account:

```powershell
.\tests\e2e\scripts\manage-credentials.ps1 -Action save
.\tests\e2e\scripts\manage-credentials.ps1 -Action forget
```

Set the following **non-secret** metadata in the same terminal. These production
values match the currently configured backend; use staging values for a staging
build. Confirm which backend was built into the installed APK first.

```powershell
$env:E2E_ANDROID_DEVICE = 'emulator-5554'
$env:E2E_ANDROID_APP_ID = 'com.sadik.microhabit'
$env:E2E_BACKEND_ENV = 'production'
$env:E2E_BACKEND_HOST = 'nzpnfrutomyuvrprkrwi.supabase.co'
$env:E2E_BUILD_BACKEND_CONFIRMED = 'yes'
$env:E2E_ALLOW_PRODUCTION_LOGIN = 'yes'
.\tests\e2e\scripts\prompt-credentials.ps1 -Platform android
```

If script execution is blocked, start a process-scoped invocation with
`powershell -NoProfile -ExecutionPolicy Bypass -File tests/e2e/scripts/prompt-credentials.ps1 -Platform android`.
This does not change the machine's execution policy. Do not use an administrator
terminal for routine account tests. If a tool requests elevated access, resolve
its local installation/log permissions first.

With credentials already supplied by a CI secret store or a secure parent
process, `npm run e2e:android` runs the same case directly. The runner reads
`MAESTRO_E2E_EMAIL` and `MAESTRO_E2E_PASSWORD`; it never passes them as command-line
arguments. Android `inputText` currently requires printable ASCII credentials.
Do not change the existing account password solely to accommodate the test.

## iOS from Windows

Windows cannot host an iOS Simulator. A cabled iPhone does not provide native iOS
automation here. Use the prepared manual workflow
[e2e-ios-login.yml](../../.github/workflows/e2e-ios-login.yml) on GitHub's standard
`macos-15` Apple Silicon runner, which builds an ad-hoc-signed Simulator Release `.app` and
runs Maestro against the installed app. No Apple signing key, App Store release,
EAS build or paid Maestro Cloud account is required for this route.

The repository is public. Standard GitHub-hosted runners are free for public
repositories; availability and permissions still need checking before launch.
If the repository becomes private, minutes above its allowance can be billed.
The founder approved this setup's manual GitHub run. Keep triggers manual;
future execution must follow the account owner's authorization and budget.
ChatGPT Plus is not a mobile CI subscription.

After TC-001 passes with complete evidence on the final committed source:

1. Put the reviewed files on the GitHub branch to test. The workflow must exist
   on the default branch to appear under Actions. Review and commit first, then
   rerun Android if the tested source changed. Never include `.tools`, results,
   `.env` or credentials in the commit.
2. In GitHub repository **Settings > Environments**, create `e2e-login` and
   restrict deployment branches to `main`, the trusted dispatcher branch. The
   dispatcher checks out the separately supplied Android-tested source commit.
   Add required reviewers if available. This environment gates account secrets.
3. Add environment **variables** `E2E_BACKEND_ENV` (`production` or `staging`) and
   `E2E_BACKEND_HOST` (hostname only). Add environment **secrets**
   `E2E_LOGIN_EMAIL` and `E2E_LOGIN_PASSWORD`. Enter the same existing account
   through GitHub's secret form, never chat. Add `E2E_SUPABASE_ANON_KEY` as a
   secret or variable: it is the app's public Supabase key, never a service-role
   or management key. A secret takes precedence if both are present.
4. After approval, choose **Actions > Manual iOS login E2E > Run workflow**.
   Supply the full commit SHA whose Android case passed on the same backend and
   account. That input is an operator attestation, not an automated retrieval of
   Android evidence. Approve normal production login effects if applicable.
5. Review the sanitized result printed by the final test step. Setup failures
   remain BLOCKED. A green build step alone is not a TC-002 pass.

The updated workflow gives the **build/install step at most 60 minutes**. Its
overall job limit is 110 minutes, allowing dependency setup, the two tests,
report encryption and cleanup. The earlier run retains its original 60-minute
overall limit; editing the workflow cannot change a running job.
Do not start local Android login while cloud iOS uses the same
account. Account secrets are available only to the test step, not dependency
installation or compilation. Only an encrypted visual report is uploaded. Restrict who can
edit and dispatch workflows with this account's environment access.

Safe progress messages identify Expo prebuild/CocoaPods, Simulator startup,
Xcode compilation and app installation. On failure or interruption an always-run
step reads the last recorded phase and emits fixed diagnostic categories, exit
status and log timing/size. It never prints raw log lines. A timeout/cancellation
that kills the shell before it records an exit code is reported as interrupted;
GitHub's own annotation distinguishes timeout from manual cancellation.

Project generation and CocoaPods installation are separate phases, with safe
minute heartbeats. The build pins the installed Xcode 16.4/iOS 18.5 runtime and
creates a dedicated iPhone 16 Simulator. It compiles before booting the Simulator
to avoid consuming Simulator resources during compilation. Missing pinned tools
block the job rather than downloading another Xcode/runtime.

Download caching covers npm's `_cacache`, CocoaPods' downloads and the pinned
Maestro ZIP. A restored Maestro archive is checked against its fixed SHA-256
before extraction; a corrupt cache is downloaded again and reverified.
Keys include OS, CPU architecture, Xcode and dependency/configuration hashes;
`npm ci` and native dependency installation still run. Cache save occurs before
account access, even after a compilation failure if prebuild completed. Failed
cache operations are bounded and do not fail the tests. An optional ccache
installation enables React Native's native compiler cache with a 1 GiB limit,
keyed by OS, architecture, Xcode/compiler-cache versions and dependency/config
hashes. This stores compiler results from the pre-account build, not installed
apps, JS bundles, DerivedData, Simulator/Keychain data, reports or raw logs.
Both caches are saved before account secrets become available. The build uses
a fresh private directory at a stable path for cache reuse; a pre-existing path
is never reused. Editor indexing is disabled, and only the active Simulator
architecture is built. Cache savings remain unmeasured until an approved Mac run;
the first compiler-cache fill still requires compilation. No larger/paid runner
or hosted build service is enabled.

For an already prepared Mac/Simulator, use `npm run e2e:ios`, with the same secret
environment and backend metadata plus `E2E_IOS_DEVICE`, optional separate
`E2E_IOS_APP_ID`, `E2E_ANDROID_PASS_SHA`, and `E2E_DISPOSABLE_SIMULATOR=yes`.
**TC-002 clears the entire Simulator Keychain.** Use a disposable Simulator only.
The second launch within each attempt preserves storage and Keychain.
The runner now divides each iOS attempt into input and submission phases, without
relaunching between them. It privately checks the entered email and nonempty
password field, captures the screen, then continues only if both checks and the
photo succeed. A masked field proves populated input, not the hidden password's
exact value. Pre-submission and final images appear under their own attempt.
The two phases share the original six-minute UI budget; image time is separate.
Continuation and inspections reuse the installed driver. Explicit auth/load
errors fail promptly while successful load still has its 60-second allowance.
The disposable Simulator's Password AutoFill is disabled using
[Maestro's documented workaround](https://docs.maestro.dev/extra-materials/troubleshooting/known-issues)
and both settings are read back. Missing internal Apple settings paths block
setup instead of silently skipping configuration. This workaround is a candidate
for input flakiness; the earlier failure's cause remains unconfirmed.

EAS is an alternative, not a second testing framework. The new `e2e` build
profile creates Android APKs and iOS Simulator Release builds. Do not run
`eas build --profile e2e` without cloud approval. Expo currently lists free-plan
build/workflow allowances, but remaining account quota is unverified and the
EAS Maestro job is alpha. GitHub's single build-and-test job avoids coordinating
two cloud systems for this initial scope.

## Results, privacy and debugging

`results/TC-001-latest.json` and `TC-002-latest.json` record PASS, FAIL or BLOCKED,
device, OS, installed app version/build, declared backend, checkout revision,
command, durations and assertion evidence. The backend is operator-confirmed,
not extracted from the installed binary. A checkout SHA alone does not identify
uncommitted edits; use a clean committed source for reproducible comparisons.

Exit codes are 0 PASS with complete screenshot evidence, 1 executed failure,
2 BLOCKED/setup problem or missing required visual evidence. A missing image
does not rewrite the functional finding, but it prevents a green automation job.
Raw Maestro
console output, JUnit, screenshots and command dumps may contain secrets, even
with friendly step labels. The runner captures them privately, emits only a
whitelisted summary, and removes temporary raw files after the run. Do not run
the YAML directly with real credentials or upload raw artifacts. Interrupted
runs may leave `.private-*` folders: verify no test is still running, then delete
those folders and a stale `.run.lock` locally. Keep the results directory private.

For failures, inspect the live emulator without exposing entered credentials.
Do not relax assertions to obtain a pass. Missing tools, devices, binaries or
credentials are environment blockers. A native assertion failure needs triage;
it does not automatically establish an app bug. Use the private visual report
below for screenshot review; keep account information out of shared bug reports.

## Visual reports for PASS and FAIL

New runs write `results/TC-001-latest.html` or `TC-002-latest.html`, with a native
screenshot after each completed or failed attempt. Open the local HTML in a
browser; it embeds the images and needs no web server. The JSON remains the
machine-readable result. Screenshot capture does not change the assertion result:
`evidenceStatus` separately says COMPLETE, INCOMPLETE or NOT_AVAILABLE.

Open the report with an explicit browser command, even if Windows normally opens
HTML files in VS Code:

```powershell
npm.cmd run e2e:report -- android
npm.cmd run e2e:report -- ios
```

The report headings use **Login on Android** and **Login on iOS**. Internal
TC-001/TC-002 identifiers and filenames remain stable for traceability.
Each screenshot belongs to the attempt directly above it. Hierarchy inspection
has a 90-second limit per inspection to accommodate native tool startup on this
laptop; any capture failure records its phase and a fixed diagnostic category.
Android preflight also checks current system error windows. A known crash/ANR
dialog blocks setup before credentials are entered. Resolve it outside an active
case; do not dismiss dialogs midway through a test or rewrite the earlier result.
ADB reporting `device`, an awake screen and a running app do not by themselves
prove that the app's UI is accessible.
The second hierarchy read reuses the driver from the first read; test startup
and the first inspection still use fresh setup. Failed attempts retain only
allowlisted completed checkpoints, failed command/target names and fixed app
error categories. Raw command reports, input values and error text are discarded.
On iOS, tapping the non-interactive COMMITO heading dismisses the keyboard before
submission, following [Maestro's documented workaround](https://docs.maestro.dev/reference/commands-available/hidekeyboard) for unreliable swipes.
The iOS workflow confirms Simulator readiness again after installation. Test
preflight allows 90 seconds per Simulator query and one read-only retry for a
timeout, command failure or observed boot-in-progress. It records fixed categories
and timings; a genuinely stopped, absent, unavailable or unidentifiable device
still blocks. A setup blocker is not an executed login failure and has no attempt
photo. The latest completed iOS run passed preflight, then failed after login
submission; see the execution record for the distinction from the earlier blocker.

Local runs also retain a dated, self-contained HTML report and result JSON under
`results/history/`. Reports never overwrite one another. Open their private index:

```powershell
npm.cmd run e2e:report -- history
```

Timing comparisons use the previous complete passing run only when device, OS,
installed build, backend, Maestro version and attempt count match. They separate
UI-test time from screenshot time. A shorter run is not proof of an improvement's
cause. Cloud runners create no plaintext history; downloading/decrypting an iOS
report archives a private local copy instead.

Every HTML report includes suggested improvements based on its observed result,
capture completeness and timings. The run review should also consider workflow,
agent instructions and skills, state what is untested, and preserve the original
findings. Suggestions do not authorize new cloud runs or other external changes.

At the founder's request, new private screenshots preserve the login email and
the password field's native dots/asterisks. The password field is visible only
when both hierarchy inspections show exclusively masking characters at the same
verified bounds. Plaintext, partial last-character reveals and unknown masking
remain covered. These are original pixels, not replacement stars. Other sensitive
fields and keyboard/autofill areas remain hidden, including explicit keyboard
overlays over the login fields. Logs and structured screen summaries retain
no field values; the email is permitted only in the private image. Earlier masks
cannot be removed because raw screenshots were deleted.
If hierarchy, coordinates or capture cannot be verified, the raw
image is discarded and the report explicitly says the image is unavailable.
A setup/build failure may have no app to photograph. Screenshots from earlier
runs cannot be reconstructed. A later supplemental screenshot is labelled with
its actual capture time and does not become an assertion-time image.

Images can still contain private league details, so all local HTML/PNG files stay
ignored. Cloud uploads contain **only encrypted HTML**, never plaintext images,
HTML, raw reports or logs. The report's RSA private key stays in the ignored
`tests/e2e/.tools/report-keys/private.pem` on this laptop. GitHub receives only
`public.pem` as environment variable `E2E_REPORT_PUBLIC_KEY`; this session's key
is already configured. A new machine can generate its pair with:

```powershell
node tests/e2e/scripts/report.mjs keys
```

Keep a private backup of the key: losing it prevents opening earlier encrypted
reports. Never upload the private key or put it in GitHub variables. The helper
refuses to overwrite an existing pair. After an approved cloud run, download its
`TC-002-report-...` artifact, unzip it, then open the private report locally:

```powershell
node tests/e2e/scripts/report.mjs decrypt "$env:USERPROFILE\Downloads\TC-002-report.encrypted.json"
npm.cmd run e2e:report -- downloaded-ios
```

The encrypted artifact expires after seven days. Reporting changes alone do not
authorize a cloud run. Publishing the dispatcher to `main` also triggers the
repository's existing Pages rebuild. The founder subsequently requested the
prepared improvements and iOS execution; this authorizes that manual verification.
Keep future cloud execution manual and within the founder's current instructions.

## Reuse the QA roles

In Codex, ask it to use the instructions in `agents/test-designer.md`, then
`agents/automation-engineer.md`, then `agents/runner-debugger.md`, sequentially.
These are reusable role instructions, not new built-in Codex agent types.
The designer independently reviewed the authentication assertions in this setup.
No additional personal skill is needed for two cases; the installed
`self-assessment` and `lesson-quiz` workflows cover review and corrections.

`npm run e2e:all` runs Android then iOS sequentially on a host with both device
types available (normally macOS). On Windows, run Android locally and iOS in the
manual workflow. These commands need no Codex session or AI credits.

Next proposed case, **not implemented**: invalid password retains the logged-out
state and displays the expected error without exposing protected content.

Sources checked October 29, 2026:
[Maestro installation](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli),
[runtime variables](https://docs.maestro.dev/maestro-flows/flow-control-and-logic/parameters-and-constants),
[launch/reset semantics](https://docs.maestro.dev/reference/commands-available/launchapp),
[GitHub runner allowances](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job),
[Expo pricing](https://expo.dev/pricing),
[EAS Maestro jobs](https://docs.expo.dev/eas/workflows/pre-packaged-jobs/),
[GitHub step timeouts](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax),
[dependency cache boundaries](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching),
[CocoaPods cache location](https://guides.cocoapods.org/using/faq.html),
[active architecture setting](https://developer.apple.com/documentation/xcode/build-settings-reference),
[Windows protected strings](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/convertto-securestring),
[Supabase password storage](https://supabase.com/docs/guides/auth/password-security),
[observed Mac runner image](https://github.com/actions/runner-images/blob/macos-15/20260824.0482/images/macos/macos-15-Readme.md).
