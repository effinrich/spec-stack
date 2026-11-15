---
description: Parallel execution engine. Fire all independent implementation tasks as simultaneous agent dispatches with explicit model-tier routing, background long operations, and a lightweight completion check. Use inside /spec:apply when tasks are independent; sequential tasks still run in order.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
---
<!-- GENERATED from core/commands/ultrawork.md — edit the core file and run node tools/generate.mjs; hand edits will be overwritten -->

# /spec:ultrawork

Parallel execution layer for the spec flow. It provides parallelism and model-tier routing only — gates, verification, and state stay with the spec commands. **Never run it as a competing loop**: it is a bounded dispatch pattern, not a persistence mode.

## When

- `/spec:apply` faces multiple independent tasks (tasks.md or proposal `## What`)
- The user says "ultrawork" or "ulw" during any implementation phase
- Standalone parallel work outside an active spec change

## When not

- Tasks have dependencies → run them sequentially in dependency order
- Only one task → dispatch a single executor directly
- Verification time → that is `/spec:verify`'s job, never this command's
- Inside `/spec:loop` rounds → rounds are self-run by design; the stack is off there

## Execution policy

1. **Classify tasks by independence.** Read tasks.md / the proposal's `## What`. Independent = touches disjoint files or modules with no interface dependency between them this round.
2. **Fire all independent dispatches in the same turn.** Never serialize independent work.
3. **Route each task to a tier:**

| Task shape | Agent | Tier |
|---|---|---|
| Trivial: typo, missing export, small config | executor | LOW |
| Standard implementation of one task | executor | MEDIUM |
| Complex: cross-cutting refactor, tricky state | executor | HIGH |
| Failure diagnosis between cycles | architect | HIGH |
| Check-running / interactive service testing | qa-tester | MEDIUM |

Map tiers to the models your runtime actually exposes — never invent a model the host doesn't support.

4. **Background long operations.** Installs, builds, test suites (>~30s) run detached; quick checks stay in the foreground.
5. **Dependent tasks wait.** Launch a dependent task only after its prerequisite reports completion.

## Dispatch mechanics (Claude Code)

- Dispatch with `Task(subagent_type="spec:executor", model=..., prompt=...)` — one call per task, all independent calls in the same block.
- Tier → `model`: LOW = haiku, MEDIUM = sonnet, HIGH = opus.
- Long operations dispatch with `run_in_background: true`.
- `spec:architect`, `spec:qa-tester` are dispatched the same way for diagnosis and check-running.

## Per-task discipline (binding)

Every dispatch carries the task contract in the prompt:

- The task's scope from tasks.md / proposal (files, seams, acceptance)
- **TDD when the task adds or changes behavior**: red → green, one seam, one test, minimal implementation — the executor follows the plugin's TDD skill. Pre-agreed seams only; expected values from an independent source, never recomputed.
- The Coding Charter (`skills/core/references/code-charter.md`) applies to every dispatch.

## Completion check (lightweight, self-run)

When all dispatches report back, before handing back to the spec flow:

- Build / typecheck passes
- Affected tests pass
- No new errors introduced

Failures here route to `/spec:ultraqa` to converge, not to more blind dispatches.

## Escalation and stop conditions

- A task failing repeatedly across retries → stop that task, report the issue; do not retry indefinitely
- Unclear dependencies or conflicting requirements between tasks → surface to the user instead of guessing
- Anything needing guaranteed completion with verification → the spec gates and `/spec:verify` provide that; ultrawork never certifies done on its own
