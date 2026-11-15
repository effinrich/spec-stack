#!/usr/bin/env node
// spec-stack bootstrap CLI — zero dependencies, Node >= 18.
// Usage: npx github:effinrich/spec-stack            (install for detected agents)
//        npx github:effinrich/spec-stack doctor     (pre-flight checks)
//        npx github:effinrich/spec-stack map        (print the layer map)
//        npx github:effinrich/spec-stack codex-install  (run the vendored Codex installer)

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REPO = "effinrich/spec-stack";
const args = process.argv.slice(2);
const command = args[0] && !args[0].startsWith("--") ? args[0] : "init";
const flags = new Set(args.filter((a) => a.startsWith("--")));
const wantClaude = !flags.has("--codex");
const wantCodex = !flags.has("--claude");

function has(cmd) {
  const probe = process.platform === "win32" ? spawnSync("where", [cmd]) : spawnSync("which", [cmd]);
  return probe.status === 0;
}

function run(cmd, argv) {
  console.log(`  $ ${cmd} ${argv.join(" ")}`);
  const res = spawnSync(cmd, argv, { stdio: "inherit", shell: process.platform === "win32" });
  return res.status === 0;
}

function layerMap() {
  console.log(`
GATES (mechanical, hook-enforced)
  check-tbd / check-gate / check-archive    UserPromptSubmit
  loop-driver / check-verify-reminder      Stop

EXECUTION   /spec:ultrawork   parallel tier-routed executor dispatch
PER-TASK    TDD skill         red -> green, pre-agreed seams
QA          /spec:ultraqa     bounded cycle, max 5, fuse on 3x same failure
AUTHORITY   /spec:verify      fresh-context verifier, evidence or drop

  research -> ask -> propose -> HARD GATE -> apply (ultrawork + tdd + ultraqa)
  -> verify -> archive        |  loop: goal-driven rounds (stack off inside rounds)
`);
}

function doctor() {
  console.log("spec-stack doctor\n");
  let fail = 0;

  const checks = [
    ["node >= 18", process.version >= "v18", process.version],
    ["git", has("git"), "required for the plugin marketplace"],
    [
      "claude (Claude Code CLI)",
      has("claude"),
      wantClaude ? "required for the Claude install path" : "(--codex: not required)",
    ],
    [
      "codex (Codex CLI)",
      has("codex"),
      wantCodex ? "required for the Codex install path" : "(--claude: not required)",
    ],
    [
      "sh (POSIX shell / Git Bash)",
      process.platform !== "win32" || has("sh"),
      "Windows gate hooks run under Git Bash; without it gates fail open",
    ],
    ["ast-grep (optional)", has("ast-grep"), "absent -> verifier falls back to manual review"],
  ];

  for (const [name, ok, note] of checks) {
    if (name.startsWith("claude") && !wantClaude) continue;
    if (name.startsWith("codex") && !wantCodex) continue;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}  —  ${note}`);
    if (!ok && !name.includes("optional")) fail++;
  }

  const specDir = path.join(process.cwd(), "spec");
  console.log(`  INFO   spec/ tree in cwd: ${fs.existsSync(specDir) ? "present" : "absent (fresh project)"}`);
  console.log(`\n${fail === 0 ? "All required checks pass." : `${fail} required check(s) failed — fix before installing.`}`);
  return fail;
}

function install() {
  let installed = 0;

  if (wantClaude) {
    if (has("claude")) {
      console.log("\n[claude] registering marketplace and installing plugin...\n");
      if (run("claude", ["plugin", "marketplace", "add", REPO]) && run("claude", ["plugin", "install", "spec@spec-stack"])) {
        installed++;
        console.log("\n[claude] installed. Verify: /spec:harness inside Claude Code.");
      }
    } else {
      console.log("\n[claude] CLI not found. Manual install:\n");
      console.log("  claude plugin marketplace add effinrich/spec-stack");
      console.log("  claude plugin install spec@spec-stack");
    }
  }

  if (wantCodex) {
    if (has("codex")) {
      console.log("\n[codex] registering marketplace and installing plugin...\n");
      run("codex", ["plugin", "marketplace", "add", REPO]);
      // `codex plugin add` exists on codex-cli 0.142+; older CLIs only have
      // `plugin marketplace`. Fall back to the vendored file-copy installer.
      const probe = spawnSync("codex", ["plugin", "add", "--help"], { encoding: "utf8" });
      const pluginAddOk = probe.status === 0;
      if (pluginAddOk) {
        if (run("codex", ["plugin", "add", "spec@spec-stack"])) {
          installed++;
          console.log("\n[codex] installed. Hooks must be trusted once in the Codex TUI hooks browser.");
        }
      } else {
        console.log("\n[codex] this codex-cli lacks `plugin add` — using the vendored file installer:\n");
        if (codexInstall() === 0) installed++;
      }
    } else {
      console.log("\n[codex] CLI not found. Manual install:\n");
      console.log("  codex plugin marketplace add effinrich/spec-stack");
      console.log("  codex plugin add spec@spec-stack        # codex-cli 0.142+");
      console.log("  npx github:effinrich/spec-stack codex-install   # older codex-cli");
    }
  }

  console.log(`\n${installed > 0 ? `Installed for ${installed} agent(s).` : "No agent installed — see manual steps above."}`);
  layerMap();
  console.log("Orientation inside the agent: /spec:harness (Claude) · $spec-harness (Codex).\n");
  return installed > 0 ? 0 : 1;
}

function codexInstall() {
  const isWin = process.platform === "win32";
  const script = isWin ? path.join(ROOT, "codex", "install.ps1") : path.join(ROOT, "codex", "install.sh");
  if (!fs.existsSync(script)) {
    console.error(`Installer not found at ${script} (trimmed npm package?). Clone ${REPO} and run it from there.`);
    return 1;
  }
  if (isWin) {
    const res = spawnSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", script], { stdio: "inherit" });
    return res.status ?? 1;
  }
  const res = spawnSync("sh", [script], { stdio: "inherit" });
  return res.status ?? 1;
}

switch (command) {
  case "doctor":
    process.exit(doctor());
  case "map":
    layerMap();
    process.exit(0);
  case "codex-install":
    process.exit(codexInstall());
  case "help":
  case "--help":
    console.log(`spec-stack — bootstrap for the ${REPO} multi-agent harness\n\ncommands: init (default) | doctor | map | codex-install\nflags:   --claude (skip codex) | --codex (skip claude)`);
    process.exit(0);
  case "init":
  default:
    process.exit(install());
}
