# Login regression suite

From VS Code, choose **Terminal → Run Task → Commito: Run login regression**. Or open
this folder in Windows File Explorer and double-click **Run Android login.cmd**.
The changes must first be committed to Git. The existing saved Windows-protected account is reused. Start the dedicated
Android emulator first and install the current Release APK. The task runs one
attempt and retries only if it fails; it opens the private report in a browser.
After an Android pass it also opens the iOS workflow page and prints the source
revision. Starting iOS there is a separate, deliberate action.
Running it signs in to production and can update the test account's profile and
authentication metadata. It clears the test app's local data on the emulator.

For iOS, Windows cannot run Apple's simulator. Open
[the iOS workflow](https://github.com/KeQue/MicroHabit/actions/workflows/e2e-ios-login.yml),
select **Run workflow**, provide the full source revision that passed Android
with complete screenshots, and confirm the production-login option. The GitHub
workflow and tested revision must be published first. GitHub's existing secrets
are reused. This starts a cloud run; no cloud run is started by the Android task.
Download and decrypt the encrypted iOS report using the existing reporting tools.

The Android APK must correspond to the tested application source and backend;
the runner cannot independently prove that the installed APK came from the
current source revision. Rebuild it when application source or build settings
change. Keep all reports private.
