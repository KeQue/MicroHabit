# TC-001: Successful login on Android

Preconditions: a dedicated Android emulator has a Release APK built from this
source, with its backend recorded. An existing confirmed email/password account
is supplied securely at runtime. The backend is reachable. Production requires
explicit consent: login updates authentication metadata and upserts the profile.
Use no emulator holding important local Commito data; launch clears app data.

1. Clear app state and launch Commito; require the email, password and Sign in controls.
2. Enter the existing account email/password and tap Sign in through the real UI.
3. Within 60 seconds require `e2e-leagues-loaded`, with no login or load errors.
4. Stop and relaunch without clearing data. Require the same loaded state again.
5. Capture a native screenshot with credential fields redacted, on PASS or FAIL.
6. Repeat the entire case twice by default and record each result in private HTML/JSON.

Expected: real authentication plus authenticated server league loading succeeds
(an empty list is valid), and the saved session survives a new app process.
Disappearance of Sign in alone is insufficient. The marker is attached to the
existing list only after `getUser`, profile upsert and league retrieval finish
without error. This is functional evidence, not an authentication security audit.

Command: `npm run e2e:android` after secure setup in the README.
PASS requires both runs to execute and satisfy every assertion. Missing setup
is BLOCKED; an executed assertion failure is FAIL. Reports contain device, OS,
installed app version/build, declared backend, command and duration. Keep HTML/PNG
private and ignored; never include raw credentials. If capture/redaction is not
safe, record missing visual evidence separately from the functional result.
Do not create leagues, check in, delete accounts or change plans.
