# Login on iOS (TC-002)

Preconditions: TC-001 has passed for the same source revision/backend/account;
macOS with Xcode, Maestro and a dedicated booted iOS Simulator are available.
Install an unsigned Simulator Release `.app` built from this source, with an
embedded bundle. An App Store/TestFlight `.ipa` is unsuitable. An iPhone attached
to Windows does not meet these requirements. Supply the same existing confirmed
email/password account securely and approve production effects if applicable.

1. Clear app state and the Simulator's entire Keychain, then launch Commito.
2. Require the email, password and Sign in controls; enter runtime credentials.
3. Before submission, privately verify the email matches the saved account and
   the password field is populated. A native mask proves populated input, not
   the hidden password's exact value. Capture this screen with visible email
   and native password dots where masking is verifiable. Stop if checks/photo fail.
4. Continue the same session and tap Sign in. Within 60 seconds require
   `e2e-leagues-loaded` and no errors; an explicit app error fails promptly.
5. Stop and relaunch without clearing state/Keychain; require loaded state again.
6. Capture the final native screen on PASS or FAIL. Preserve the real password's
   privacy, and show both before-submission and final photos under their attempt.
7. Repeat the entire case twice by default and record each result in private HTML/JSON.

Expected: the same real login/server-load/session-restoration assertions as
TC-001. An empty league list is valid. The loaded marker is conditional on an
authenticated user and completed successful league loading, never a static title.

Command: `npm run e2e:ios` on macOS, or the manually dispatched workflow after
Android passes. PASS requires every assertion in both runs. Missing setup is
BLOCKED; an executed assertion failure is FAIL. Retain sanitized metadata/status
only in console output. Keep visual reports private; upload only the encrypted
report for the founder's local viewing key. Record unavailable capture separately.
The GitHub workflow disables Password AutoFill only on its disposable Simulator
and reads both settings back before testing. Missing/changed internal Apple
settings paths block setup with a fixed diagnostic; they do not justify a PASS.
Input and submission phases share one six-minute UI budget, with no relaunch or
login retry between them. Only first-phase setup installs the driver again;
capture/continuation reuse it. Screenshot time is recorded separately.

Never reuse a Simulator containing important Keychain data. Login updates
authentication metadata and upserts the profile; it is not read-only. No league,
check-in, account deletion or paid-plan actions belong to this case.
