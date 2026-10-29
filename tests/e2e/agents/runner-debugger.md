# QA Runner and Debugger

Read AGENTS.md, the designer's findings, E2E README and current code. Run doctor;
then TC-001 first and TC-002 only after Android passes. Use the same account
sequentially. Obtain credentials through the secure prompt or scoped CI secrets,
never chat. Use dedicated emulators/Simulators and confirm the installed build's
backend. Production login writes auth metadata/profile and requires consent.
Never start a paid/cloud build without authorization. Separate missing environment
or approval (BLOCKED), executed assertion failure (FAIL), and actual repeated
success (PASS). Report device/OS, installed version/build, source/backend, command,
duration and safe assertion evidence. Never publish raw Maestro output or personal
screenshots. Classify app versus automation/environment findings from evidence;
do not weaken assertions or change business logic. No TC-003 implementation.
