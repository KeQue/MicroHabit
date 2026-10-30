# Login regression suite

From VS Code, choose **Terminal → Run Task → Commito: Run login regression**. Or open
this folder in Windows File Explorer and double-click **Run Android login.cmd**.
The changes must first be committed to Git. The existing saved Windows-protected account is reused. Install the current Release APK on the dedicated emulator once.
The task starts that emulator in the background if needed, waits for it to boot,
and closes it after the test, including on failure. It runs one
attempt and retries only if it fails; it opens the private report in a browser.
After an Android pass it also opens the iOS workflow page and prints the source
revision. To start iOS without copying the revision, choose **Terminal → Run
Task → Commito: Run iOS login**, then type `YES` to confirm. Or double-click
**Start iOS login.cmd** in File Explorer. The iOS task uses the existing Android
report, publishes the current QA branch if needed, and starts one GitHub run.
It stops if another iOS run is active or the Android report does not match the
current committed revision. Its encrypted report uses the default protected
screenshot policy. Do not run this task while another person is starting the
same workflow: GitHub's check and dispatch are separate operations.
Running it signs in to production and can update the test account's profile and
authentication metadata. It clears the test app's local data on the emulator.

For iOS, Windows cannot run Apple's simulator. The iOS task uses GitHub's Mac
runner and the existing GitHub sign-in and environment secrets. If its dispatch
outcome is unknown, check the Actions page before resolving the pending marker;
never start a second run until you know what happened. Alternatively, open
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
