# HARNESS.md — the spec-stack stack

One plugin, four layers. The design goal: fast autonomous execution that cannot silently derail, because every authority that matters is mechanical, not prompt-level.

## Layer map

| Layer | Component | Enforcement |
|---|---|---|
| Gates | spec-workflow hooks: `check-tbd.sh`, `check-gate.sh`, `check-archive.sh`, `check-verify-reminder.sh`, `loop-driver.sh` | Shell scripts on UserPromptSubmit / Stop events. The model cannot talk its way past them |
| Execution | `/spec:ultrawork` → `spec:executor` agents | Directive: fire independent Task dispatches simultaneously, tier-routed (haiku / sonnet / opus), long ops backgrounded |
| Per-task quality | `skills/tdd` (red → green, pre-agreed seams) | Directive carried in every executor dispatch prompt |
| QA convergence | `/spec:ultraqa` → `spec:qa-tester` / `spec:architect` / `spec:executor` | Bounded cycle: max 5, fuse on 3x same failure, state file deleted on every exit |
| Final authority | `/spec:verify` → `spec-verifier` (fresh context, no Write/Edit) + archive audit | Independent agent + hooks. Nothing the harness stack does certifies done |

## Phase mapping

```
/spec:research → /spec:ask → /spec:propose
        │  (hooks: TBD scan, gate prerequisites)
        ▼
HARD GATE (user approves proposal)
        ▼
/spec:apply
        ├─ independent tasks → /spec:ultrawork parallel dispatch
        ├─ each behavior-changing task → TDD red → green (skills/tdd)
        ├─ checks failing repeatedly → /spec:ultraqa convergence cycle
        ▼
/spec:verify (fresh-context verifier, evidence or drop)
        ▼
/spec:archive (hook audits the whole flow)
```

`/spec:loop` (goal known, path unknown) runs the same gates at the goal level. **Inside loop rounds the harness stack is off** — rounds are self-run working checks by design; independent eyes come once, at the final acceptance audit. This is listed in loop.md's anti-patterns.

## Why the split works

- The hooks are the only Stop-event authority. Ultraqa is bounded in-conversation cycling, never a Stop-driven looper, so nothing competes with `loop-driver.sh`.
- Ultrawork parallelizes only within an approved scope — the proposal/tasks are already behind the HARD GATE.
- TDD is per-task, so parallel executors don't share test-writing state.
- The verifier is unchanged and terminal: the conversation that implemented cannot audit itself, no matter how fast the implementation went.

## Install

```sh
claude plugin marketplace add effinrich/spec-stack
claude plugin install spec@spec-stack
```

Windows: the gate hooks run under Git Bash — without it they fail open, so install Git Bash first.

## Commands added on top of spec-workflow

- `/spec:ultrawork` — parallel tier-routed dispatch (also invoked by saying "ultrawork" / "ulw" during apply)
- `/spec:ultraqa` — `--tests | --build | --lint | --typecheck | --custom "pattern" | --interactive`

## Provenance

See NOTICE. Base: kamioj/spec-workflow (MIT). TDD skill: mattpocock/skills (MIT). Ultrawork/ultraqa adapted from the oh-my-claudecode family.
