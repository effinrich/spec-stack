---
name: spec-ultrawork
description: Parallel execution engine. Fire all independent implementation tasks as simultaneous Task dispatches with explicit model-tier routing (executor agents), background long operations, and a lightweight completion check. Use inside $spec-apply when tasks are independent; sequential tasks still run in order.
---
<!-- GENERATED from core/commands/ultrawork.md — edit the core file and run node tools/generate.mjs; hand edits will be overwritten -->

# $spec-ultrawork

Parallel execution layer for the spec flow. It provides parallelism and model-tier routing only — gates, verification, and state stay with the spec commands. **Never run it as a competing loop**: it is a bounded dispatch pattern, not a persistence mode.

## When

- `$spec-apply` faces multiple independent tasks (tasks.md or proposal `## What`)
- A `$spec-loop` round's plan lists independent increments
- The user says "ultrawork" or "ulw" during any implementation phase

## When not

- Tasks have dependencies → run them sequentially in dependency order
- Only one task → dispatch a single executor directly
- Verification time → that is `$spec-verify`'s job, never this command's

## Execution policy

1. **Classify tasks by independence.** Read tasks.md / the proposal's `## What`. Independent = touches disjoint files or modules with no interface dependency between them this round.
2. **Fire all independent Task calls in the same block.** Never serialize independent work.
3. **Route each task to a tier** (explicit `model` on every dispatch):

| Task shape | Agent | model |
|---|---|---|
| Trivial: typo, missing export, small config | `spec:executor` | haiku |
| Standard implementation of one task | `spec:executor` | sonnet |
| Complex: cross-cutting refactor, tricky state | `spec:executor` | opus |
| Failure diagnosis between cycles | `spec:architect` | opus |
| Check-running / interactive service testing | `spec:qa-tester` | sonnet |

4. **Background long operations.** Installs, builds, test suites (>~30s) dispatch with `run_in_background: true`. Quick checks (git status, file reads) stay foreground.
5. **Dependent tasks wait.** Launch a dependent task only after its prerequisite reports completion.

## Per-task discipline (binding)

Every executor dispatch carries the task contract in the prompt:

- The task's scope from tasks.md / proposal (files, seams, acceptance)
- **TDD when the task adds or changes behavior**: red → green, one seam, one test, minimal implementation — the executor reads the spec-tdd skill (`skills/spec-tdd/SKILL.md` in the installed plugin tree) first and follows it. Pre-agreed seams only; expected values from an independent source, never recomputed.
- The Coding Charter (`../spec-core/references/code-charter.md`) applies to every dispatch.

## Completion check (lightweight, self-run)

When all dispatches report back, before handing back to the spec flow:

- Build / typecheck passes
- Affected tests pass
- No new errors introduced

Failures here route to `$spec-ultraqa` to converge, not to more blind dispatches.

## Escalation and stop conditions

- A task failing repeatedly across retries → stop that task, report the issue; do not retry indefinitely
- Unclear dependencies or conflicting requirements between tasks → surface to the user instead of guessing
- Anything needing guaranteed completion with verification → the spec gates and `$spec-verify` provide that; ultrawork never certifies done on its own
