# Commito mobile login regression

Only two mobile cases exist: [TC-001 Android](cases/TC-001-android-login.md)
and [TC-002 iOS](cases/TC-002-ios-login.md). Both use the same existing
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
runner repeats the entire case twice; both attempts must pass. It never retries
a failed assertion into a passing result. This proves the login/load/restore
journey, not every authentication security property or other app flow.

## Files and tools

```text
tests/e2e/
  agents/                 Reusable instructions for the three QA roles
  cases/                  Human-readable TC-001 and TC-002
  maestro/                One wrapper per platform
    shared/               Shared login and authenticated-state assertions
  scripts/                Runner and hidden PowerShell credential prompt
  results/                Ignored machine results and temporary raw files
  .tools/                 Ignored local tools/build caches
```

Reuse Node/npm, Expo SDK 54, Java 21, Android SDK and the existing
Pixel_7 Android 14 image. Maestro CLI is pinned to **2.12.0**. No npm testing
framework is added. `app.config.ts` resolves to version 1.0.2, iOS build 36 and
`com.sadik.microhabit` on both platforms. `app.json` still contains build 29;
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
chat, source files, YAML, a shell command, a bug report or a screenshot. Do not run
PowerShell transcription/screen recording while entering or running credentials.
The prompt hides both email and password, passes them only to the test process,
and restores the previous process environment afterward.

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
`macos-15-intel` runner, which builds an unsigned Simulator Release `.app` and
runs Maestro against the installed app. No Apple signing key, App Store release,
EAS build or paid Maestro Cloud account is required for this route.

The repository is public. Standard GitHub-hosted runners are free for public
repositories; availability and permissions still need checking before launch.
If the repository becomes private, minutes above its allowance can be billed.
No cloud job has been authorized or started by preparing this workflow. Keep
triggers manual and request approval before the first launch. ChatGPT Plus is
not a mobile CI subscription.

After TC-001 passes twice on the final committed source:

1. Put the reviewed files on the GitHub branch to test. The workflow must exist
   on the default branch to appear under Actions. Review and commit first, then
   rerun Android if the tested source changed. Never include `.tools`, results,
   `.env` or credentials in the commit.
2. In GitHub repository **Settings > Environments**, create `e2e-login` and
   restrict deployment branches to the trusted branch being tested. Add required
   reviewers if available. This environment gates access to the account secrets.
3. Add environment **variables** `E2E_BACKEND_ENV` (`production` or `staging`) and
   `E2E_BACKEND_HOST` (hostname only). Add environment **secrets**
   `E2E_LOGIN_EMAIL`, `E2E_LOGIN_PASSWORD` and `E2E_SUPABASE_ANON_KEY`. Enter the
   same existing account through GitHub's secret form, never chat. The last key
   is the app's public Supabase key, never a service-role/management key.
4. After approval, choose **Actions > Manual iOS login E2E > Run workflow**.
   Supply the full commit SHA whose Android case passed on the same backend and
   account. That input is an operator attestation, not an automated retrieval of
   Android evidence. Approve normal production login effects if applicable.
5. Review the sanitized result printed by the final test step. Setup failures
   remain BLOCKED. A green build step alone is not a TC-002 pass.

The job serializes cloud runs using one account concurrency group and times out
after 60 minutes. Do not start local Android login while cloud iOS uses the same
account. Account secrets are available only to the test step, not dependency
installation or compilation. Raw artifacts are not uploaded. Restrict who can
edit and dispatch workflows with this account's environment access.

For an already prepared Mac/Simulator, use `npm run e2e:ios`, with the same secret
environment and backend metadata plus `E2E_IOS_DEVICE`, optional separate
`E2E_IOS_APP_ID`, `E2E_ANDROID_PASS_SHA`, and `E2E_DISPOSABLE_SIMULATOR=yes`.
**TC-002 clears the entire Simulator Keychain.** Use a disposable Simulator only.
The second launch within each attempt preserves storage and Keychain.

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

Exit codes are 0 PASS, 1 executed failure, 2 BLOCKED/setup problem. Raw Maestro
console output, JUnit, screenshots and command dumps may contain secrets, even
with friendly step labels. The runner captures them privately, emits only a
whitelisted summary, and removes temporary raw files after the run. Do not run
the YAML directly with real credentials or upload raw artifacts. Interrupted
runs may leave `.private-*` folders: verify no test is still running, then delete
those folders and a stale `.run.lock` locally. Keep the results directory private.

For failures, inspect the live emulator without exposing entered credentials.
Do not relax assertions to obtain a pass. Missing tools, devices, binaries or
credentials are environment blockers. A native assertion failure needs triage;
it does not automatically establish an app bug. No screenshots of account data
are required as evidence for this initial setup.

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
[EAS Maestro jobs](https://docs.expo.dev/eas/workflows/pre-packaged-jobs/).
