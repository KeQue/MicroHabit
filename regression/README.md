# Regression

In VS Code choose **Terminal → Run Task → Regression**, then type `YES` to
approve the production login effects and one GitHub iOS run. Android runs locally
while iOS starts on GitHub; neither waits for the other's build or test result.
Each platform keeps its own result and uses a separate production test account.
Before starting, check that no other login run is using either account; the suite
does not automatically detect a run started separately.

The Android runner compares app inputs and the APK's hash with its local build
record. It rebuilds when needed, starts the dedicated emulator in the background,
and installs the APK if its installed hash differs. It verifies the installed
hash before login, then closes the emulator when the test ends. The first run
must build a fresh APK; later app changes can also take several minutes to build.
The Android account is reused from Windows-protected storage. Configure the
separate iOS account as GitHub environment secrets `E2E_IOS_LOGIN_EMAIL` and
`E2E_IOS_LOGIN_PASSWORD`; do not reuse the Android account. Both normal logins
can update their respective account's authentication metadata and profile.

The iOS task publishes the committed QA source if needed and starts the workflow
on GitHub's Mac. The updated workflow must first be published on GitHub's `main`
branch. It verifies the exact source revision but does not require an Android
pass. Keep the VS Code task open while GitHub runs iOS: it downloads and decrypts
the encrypted report and opens it in the browser afterward. If the task stops
early, download the encrypted artifact from GitHub and open it with the existing
reporting tools. If an iOS run is already active, the launcher stops instead of
starting another.

The `android` and `ios` subfolders contain individual launchers. Avoid starting
duplicate runs against either account. Add future platform cases to their
corresponding platform runner so this suite includes them. Reports remain private.
