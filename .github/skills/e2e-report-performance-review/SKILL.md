---
name: e2e-report-performance-review
description: 'Use after every Commito Android/iOS E2E or Regression run to inspect both private reports, explain platform outcomes, and find evidence-backed ways to reduce test time.'
---

# Review E2E reports and speed

Use after every mobile E2E run, including failed, blocked, or incomplete
attempts. Review Android and iOS independently and look for safe runtime
improvements without weakening coverage.

## Procedure

1. Read `AGENTS.md`, `tests/e2e/README.md`, the current regression launchers,
   this run's Android JSON/HTML report, and the matching iOS HTML report. Match
   the iOS report to its GitHub run ID and source revision; do not assume the
   newest cached download belongs to this run.
2. Record each platform's status, source revision, attempt count, evidence
   completeness, duration, and blocker/failure diagnostics. Missing screenshots
   are incomplete evidence, not proof of an app or account failure. Inspect
   private screenshots locally only when available; never paste pixels or
   account data into shared logs or summaries.
3. Separate end-to-end launcher stages from report E2E-runner duration: APK
   preparation, emulator boot, system-dialog recovery, UI stabilization,
   installation, credential/tool preflight, UI assertions, retries, screenshot
   capture, and report opening. Explain discrepancies instead of presenting
   runner time as total task time.
4. Compare timings only for compatible runs. State differences in device/OS,
   installed build, backend, source revision, tool version, cache/build status,
   and attempt count. Identify the largest measured delay and its evidence.
5. Implement a small, testable speed improvement only when measurements support
   it. Preserve authentication, post-restart checks, independent account use,
   source-revision verification, screenshot privacy, and missing-evidence
   failure behavior. Do not remove assertions, shorten safety checks blindly, or
   claim an unmeasured speedup.
6. Run focused automated checks. Do not launch another device login, production
   auth, cloud workflow, publish, download, or change live data unless the user
   separately authorized that action.

## Output

| Platform | Result | Attempts | Evidence | Reported duration | Main delay/failure |
|---|---|---:|---|---|---|

Then list measured causes versus unknowns, speed changes implemented and their
expected (not yet measured) benefit, automated checks, and whether a new device
run is still needed to measure the change. Always report both platforms, even
when one has no report or usable screenshots.
