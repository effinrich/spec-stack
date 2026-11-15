---
name: spec-ultraqa
description: Autonomous QA cycling. Parse a structured goal (--tests, --build, --lint, --typecheck, --custom "pattern", --interactive), then cycle run-check → architect diagnosis → executor fix, max 5 cycles, with early-exit fuses (same failure 3x, environment error). Bounded in-conversation cycling, not a Stop-hook loop, so it never competes with the spec loop driver.
---
<!-- GENERATED from core/commands/ultraqa.md — edit the core file and run node tools/generate.mjs; hand edits will be overwritten -->

# $spec-ultraqa

QA convergence layer for the spec flow. It cycles until a quality goal is met or a fuse blows, then hands back. **It is not a Stop-driven looper** — it runs as a bounded cycle inside the current phase, so it never fights the `$spec-loop` driver for the Stop event.

## Goal parsing

| Invocation | Goal type | Check |
|---|---|---|
| `$spec-ultraqa --tests` | tests | project test command exits 0 |
| `$spec-ultraqa --build` | build | build exits 0 |
| `$spec-ultraqa --lint` | lint | no lint errors |
| `$spec-ultraqa --typecheck` | typecheck | no type errors |
| `$spec-ultraqa --custom "pattern"` | custom | pattern appears in command output |
| `$spec-ultraqa --interactive` | interactive | `spec:qa-tester` verifies a running service |

No structured goal → interpret the argument as a custom goal.

## Cycle (max 5)

1. **Run the check.** Execute the project command for the goal type yourself (foreground). For `--interactive`, dispatch `spec:qa-tester` (sonnet) with goal, service start command, and test cases.
2. **Pass?** → exit: `ULTRAQA COMPLETE: goal met after N cycles`.
3. **Fail** → dispatch `spec:architect` (opus): `DIAGNOSE FAILURE: goal, full failing output, root cause and specific fix recommendations.`
4. **Fix** → dispatch `spec:executor` (sonnet): apply the architect's recommendation precisely. TDD discipline applies when the fix changes behavior (the plugin's TDD skill).
5. **Repeat** from step 1.

Run diagnosis and fix-preparation in parallel where possible. Track each failure string to detect patterns.

## Fuses

| Condition | Exit |
|---|---|
| Goal met | `ULTRAQA COMPLETE: goal met after N cycles` |
| 5 cycles reached | `ULTRAQA STOPPED: max cycles. Diagnosis: ...` |
| Same failure 3x | `ULTRAQA STOPPED: same failure 3x. Root cause: ...` — stop, surface, do not loop |
| Environment error (missing dep, port, tmux) | `ULTRAQA ERROR: ...` — fix the environment or escalate, never paper over it |

## Observability

One line per step, every cycle:

```
[ULTRAQA Cycle 1/5] Running tests... FAILED - 3 failing
[ULTRAQA Cycle 1/5] Architect diagnosing...
[ULTRAQA Cycle 1/5] Fixing: auth.test.ts - missing mock
[ULTRAQA Cycle 2/5] Running tests... PASSED
```

## State

Track in `.omc/state/ultraqa-state.json`: `{active, goal_type, goal_pattern, cycle, max_cycles, failures[], started_at}`. **Delete the file on every exit path** — completion, fuse, or error. No stale state left behind.

## Position in the flow

- Inside `$spec-apply`: converge working checks green after implementation dispatches, before ending the phase.
- Inside `$spec-loop` rounds: converge the round's self-checks. The round's acceptance audit stays with the loop driver — ultraqa never marks a round accepted.
- Standalone: fine for a bare "make it green" request outside a spec change.
