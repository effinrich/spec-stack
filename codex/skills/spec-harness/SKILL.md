---
name: spec-harness
description: Bootstrap and orientation. Prints the harness layer map, the phase mapping, the full command index, and the current install state (gates present, agents available, optional tools detected). Read-only. Run this first in a new project or when returning to the stack after a break.
---
<!-- GENERATED from core/commands/harness.md — edit the core file and run node tools/generate.mjs; hand edits will be overwritten -->

# $spec-harness

Orientation and pre-flight for the spec-stack. Read-only: this command prints the map and the state; it never writes, never starts a loop, never dispatches agents.

## 1. Print the layer map

```
GATES (mechanical, hook-enforced — the model cannot talk past them)
  check-tbd.sh        UserPromptSubmit   $spec-propose blocked while research.md has [TBD-N]
  check-gate.sh       UserPromptSubmit   $spec-apply blocked without a complete proposal
  check-archive.sh    UserPromptSubmit   $spec-archive blocked if the flow was bypassed
  loop-driver.sh      Stop               re-injects $spec-loop rounds, fuses on caps/no-progress
  check-verify-reminder.sh  Stop        nudges back if an approved change lacks a verify ledger

EXECUTION (directive, inside $spec-apply)
  $spec-ultrawork     parallel tier-routed dispatch: spec:executor (haiku/sonnet/opus)
  skills/tdd          red → green per behavior-changing task, pre-agreed seams only

QA CONVERGENCE (bounded, never Stop-driven)
  $spec-ultraqa       check → spec:architect diagnosis → spec:executor fix
                      max 5 cycles, fuse on 3x same failure, state deleted on every exit

FINAL AUTHORITY (unchanged by the stack)
  $spec-verify        fresh-context spec-verifier, evidence or drop
  $spec-archive       flow audit before anything closes
```

## 2. Print the phase map

```
$spec-research → $spec-ask → $spec-propose
      │  (hooks: TBD scan, gate prerequisites)
      ▼
HARD GATE (user approves)
      ▼
$spec-apply ── ultrawork parallel dispatch
      │        TDD per task
      │        ultraqa convergence if checks stay red
      ▼
$spec-verify (fresh-context verifier) → $spec-archive
```

And the positioning line: `$spec-workflow` = plan known, one pass. `$spec-loop` = goal known, path unknown, N rounds. Inside loop rounds the stack is OFF — rounds are self-run by design.

## 3. Command index

| Command | Role |
|---|---|
| `$spec-research` → `$spec-ask` → `$spec-propose` | intake, clarification, proposal (hook-gated) |
| `$spec-revise`, `$spec-design`, `$spec-chat` | proposal refinement |
| `$spec-apply` | implementation (host of the stack) |
| `$spec-ultrawork` | parallel tier-routed dispatch |
| `$spec-ultraqa` | QA cycling with fuses |
| `$spec-verify` | independent verification, terminal authority |
| `$spec-ship`, `$spec-archive`, `$spec-fix`, `$spec-stash`, `$spec-status`, `$spec-view`, `$spec-resume`, `$spec-knowledge`, `$spec-workflow`, `$spec-loop` | flow control, delivery, ledger, loop |
| `$spec-harness` | this command |

## 4. Pre-flight checks (run, report, do not fix)

1. **Hooks present**: `ls ${CLAUDE_PLUGIN_ROOT}/hooks/` — expect the 5 gate scripts + hooks.json. Missing → the plugin install is broken; reinstall before running any spec flow.
2. **Agents available**: `ls ${CLAUDE_PLUGIN_ROOT}/agents/` — expect spec-dev, spec-verifier, spec-reflector, executor, architect, qa-tester.
3. **Optional tooling**: `ast-grep` on PATH → machine pass over `rules/dirty-data/` during verify; absent → verifier falls back to manual review and says so in Evidence. Git Bash present (Windows) → gates run; absent → gates fail open, fix before relying on them.
4. **Project state**: does `spec/` exist? Active changes (list them), current pointer, any `loop.md` / `.loop-state` (a live loop → do NOT start flows that compete with it).

## 5. Close with

- The one recommended next step given the project state found in step 4 (e.g., "no spec/ tree → `$spec-research <intent>`"; "active change with approved proposal → `$spec-apply`"; "fuse-stopped loop → resume is your call, `$spec-loop`").
- A one-line reminder of the iron boundary: the stack accelerates; hooks and the verifier certify.
