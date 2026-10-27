# Working on Commito

## Context and scope

- Read current repository documentation and relevant implementation before
  proposing product changes. Flag conflicting documents; do not silently treat
  older conversations or plans as current decisions.
- Explain outcomes in plain language for a founder without coding experience.
- Preserve unrelated work. Follow the user's current authorization, including
  authorization already given; do not repeatedly request the same permission.
- Keep local edits, live backend changes, and app releases clearly distinguished.
  Do not enable paid leagues or expand deployment scope without authorization.

## Evidence before completion

- Define observable success for the requested change and identify assumptions.
- Review the final diff for regressions and unintended product or visual changes.
- Test meaningful behavior and failure cases appropriate to the change. A passing
  compiler or linter does not establish device behavior or launch readiness.
- Report separately: automated checks, isolated database tests, live backend
  verification, founder-reported device results, and remaining untested flows.
- State review boundaries and unresolved findings. Avoid unearned numeric
  confidence scores or broad claims such as "everything is secure."
- For substantive work, apply the self-assessment workflow before reporting
  completion. After a material mistake, use lesson-quiz to verify the correction
  against a different evidence-grounded scenario. These assess the assistant's
  work; do not give the founder homework unless requested. Use the named skills
  when available, or follow the workflows in docs/codex-plus-tutorial.md.
- Read relevant entries in docs/work-quality-lessons.md and update them only
  when an observed failure or new evidence supports a durable correction.

## Database and security lessons

- Before migration work, compare actual schema, functions, grants, policies, and
  migration history. This project has previously had live changes absent from
  migration history; never replay old migrations blindly.
- For access-control or payment reviews, enumerate all relevant exposed server
  functions, including legacy entry points. Check what app roles can call, what
  inputs they control, and whether functions bypass row-level security.
- Hiding a button does not enforce authorization. Omitting an email from a UI
  does not prevent backend access. Verify the server boundary itself.
- Use synthetic accounts in an isolated database for exploit and destructive
  tests. Keep credentials and personal records out of logs and review artifacts.
- Prepare rollback/recovery and targeted verification for authorized live
  changes. Inspect committed state from a fresh connection afterward.

## Useful checks

Run those relevant to the change; documentation-only edits need no app rebuild.

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js . --no-cache
node --test features/leagues/utc-calendar.test.mjs
git diff --check
```

Database fixtures under `supabase/tests` belong in an isolated test database.
Use `docs/beta-smoke-test.md` for device checks and recorded results.
See `docs/codex-plus-tutorial.md` for assistant assessment and lesson checks.
