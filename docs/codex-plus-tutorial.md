# Assistant quality checks with Codex and ChatGPT Plus

Revised October 26, 2026 to focus on improving the assistant's work.

The earlier version emphasized teaching the founder. That did not match the
request. This version adapts the assessment-and-feedback idea from
[claude-howto](https://github.com/luongnv89/claude-howto) to checking the
assistant's own deliverables. It is not the original Claude question bank.

## Self-assessment

Ask: "Use self-assessment on your work before calling it complete."

The assistant checks whether the deliverable meets the actual user request,
inspects evidence, challenges material claims, fixes supported issues within
scope, and distinguishes passed checks from untested behavior. It assesses
observable work rather than assigning itself a general intelligence score.

Example for Commito: a hidden paid button is insufficient evidence that paid
access is blocked. Review relevant exposed backend functions and permissions,
including legacy paths. State which routes and roles were actually checked.

## Lesson quiz

Ask: "Use lesson-quiz to check whether you have addressed this mistake."

The assistant identifies an observed gap, states expected behavior for a few
concrete scenarios, and verifies its answers against artifacts or tests. A
changed scenario checks whether the lesson transfers beyond the original case.
The founder is not asked to take a quiz unless they request one.

Example: after correcting duplicate joins, check an existing owner's role and
original joining date as well as a first-time member. Use isolated fixtures;
this example does not authorize testing or changing live accounts.

## Use in Codex

Two personal skills are installed in your Codex skill directory:

| Skill | Purpose |
| --- | --- |
| self-assessment | Review the assistant's deliverable against intent and evidence. |
| lesson-quiz | Check application of a concrete lesson through counterexamples. |

In Codex CLI/IDE, use the skill selector or mention $self-assessment and
$lesson-quiz. In other clients, select the skills if offered, or ask for the
workflow in plain language. If newly installed skills are not visible, restart
Codex. Slash-command names from Claude Code are not automatically registered in
Codex. [Official skills documentation](https://learn.chatgpt.com/docs/build-skills).

Use your ChatGPT Plus account to sign in. These workflows need no API key;
model activity still consumes the usage available to your plan. Check your
account's usage screen rather than assuming unlimited reviews.
[Authentication](https://learn.chatgpt.com/docs/auth),
[usage guidance](https://learn.chatgpt.com/docs/pricing).

A useful request is:

> Finish the authorized task, use self-assessment to challenge the result, and
> apply lesson-quiz if a material mistake was found. Fix supported findings and
> report evidence and remaining gaps. Keep the checks proportional to the task.

## How this improves ongoing work

AGENTS.md directs substantive Commito work to these checks and preserves the
project-specific lessons in [work-quality-lessons.md](work-quality-lessons.md).
Existing authorization still applies; neither skill grants deployment rights.
A skill file guides future behavior but does not retrain the model. Self-review
and another agent's agreement do not replace execution tests or device checks.

Only add a lesson when an observed failure or new evidence justifies it. Do not
create recurring scores, repeatedly run unchanged checks, or turn a small edit
into a full security audit.

The workflows are original Codex adaptations. The source tutorial's
[self-assessment](https://github.com/luongnv89/claude-howto/blob/main/.claude/skills/self-assessment/SKILL.md)
and [lesson-quiz](https://github.com/luongnv89/claude-howto/blob/main/.claude/skills/lesson-quiz/SKILL.md)
assess human understanding of Claude Code; this version assesses assistant work.
