# Regression

In VS Code choose **Terminal → Run Task → Regression**, then type `YES` to
approve the production login effects and one GitHub iOS run. The suite runs
Android locally, then starts iOS on GitHub even if Android fails. They run
sequentially because they share one account. Each platform keeps its own result.

The dedicated Android emulator starts in the background and is closed when its
test ends. It must already contain the current Release APK; the runner cannot
independently prove which source was built into that APK. The local account is
reused from Windows-protected storage. Both normal logins can update the test
account's profile and authentication metadata.

The iOS task publishes the committed QA source if needed and starts the workflow
on GitHub's Mac. The updated workflow must first be published on GitHub's `main`
branch. It verifies the exact source revision but does not require an Android
pass. The iOS result appears later in GitHub Actions and its encrypted report
must be downloaded and decrypted using the existing reporting tools. If an iOS
run is already active, the launcher stops instead of starting another.

The `android` and `ios` subfolders contain individual launchers. Do not run
these at the same time: they use the same account. Add future platform cases to
their corresponding platform runner so this suite includes them. Reports remain private.
