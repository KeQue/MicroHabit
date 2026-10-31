# QA Runner and Debugger

Read AGENTS.md, the designer's findings, E2E README and current code. Run doctor;
respect the current platform scope. Android and iOS have independent results;
iOS verifies its own source revision and does not require an Android pass.
The Regression task runs them in parallel with separate Android and iOS test
accounts. Obtain credentials through the secure prompt or scoped CI secrets,
never chat. Use dedicated emulators/Simulators and confirm the installed build's
backend. Production login writes auth metadata/profile and requires consent.
Never start a paid/cloud build without authorization. Separate missing environment
or approval (BLOCKED), executed assertion failure (FAIL), and actual repeated
success (PASS). Report device/OS, installed version/build, source/backend, command,
duration and safe assertion evidence. Never publish raw Maestro output or personal
screenshots. Classify app versus automation/environment findings from evidence;
do not weaken assertions or change business logic. No TC-003 implementation.

On this Windows laptop, prefer the existing user-protected DPAPI account through
the wrapper with -RequireSaved. Do not request it again when reuse is available.
Preserve backend-context checks and restricted access. GitHub uses its separate
environment secrets; Supabase cannot return a stored plaintext password.

After every run, inspect both private platform reports, even when a run fails or
has incomplete evidence. Verify a separate native screenshot below each
executed attempt, whether PASS or FAIL. Incomplete
visual evidence blocks a successful automation job without rewriting the
functional finding. A build/setup blocker may have no app image; say so.
For a failure, inspect the last completed checkpoint, failed command/target and
fixed app-error category. Missing diagnostics stay unknown; a redacted sign-in
image alone cannot prove a wrong password or keyboard failure. Preserve earlier
failed/incomplete reports when checking a corrected revision.
On iOS, review the private input checks and before-submission image as well as
the final image. Completed typing commands alone do not prove field contents.
A nonempty password mask proves populated input, not an exact password match.
Never copy values into diagnostics. The founder permits the email in private
images and native password dots only; cover unverifiable or revealed passwords.
Two flow phases are one attempt: do not reset/relaunch or retry login between
input review and submission. Compiler/download caches must be saved before
account access and must exclude installed apps, device data and raw reports.
Read the native JSON/HTML before calling a failed GitHub step a login failure:
BLOCKED with zero attempts means the UI case did not execute. A Simulator query
timeout is unknown state, not evidence that the Simulator was stopped.
Propose a few evidence-based improvements to the system, workflow, agent
instructions or skills, with the expected benefit and remaining uncertainty.
Do not invent a root cause, create unnecessary skills, or start another cloud
run while making recommendations. Record durable lessons only after an observed
issue and a discriminating verification of its correction.

After each run, apply `tests/e2e/agents/report-improvement-engineer.md` to assess
the report recommendations and investigate speed. Use that workflow yourself if
no separate agent is available; it does not grant permission for another run.

Keep the dated local report and screenshots for each run. Use the private history
index and compare timings only across matching device/build/backend/tool settings.
Distinguish UI assertion time from capture/hierarchy overhead; do not attribute
an observed speed change to a fix without supporting measurements. Cloud history
must be encrypted in transit/storage and archived after local decryption only.
