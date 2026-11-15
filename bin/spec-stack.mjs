#!/usr/bin/env node
// spec-stack bootstrap CLI — zero dependencies, Node >= 18.
// Usage: npx github:effinrich/spec-stack            (install for detected agents)
//        npx github:effinrich/spec-stack doctor     (pre-flight checks)
//        npx github:effinrich/spec-stack map        (print the layer map)
//        npx github:effinrich/spec-stack codex-install  (run the vendored Codex installer)

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const HOME = os.homedir();
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

function terseInstall() {
  const claudeDir = path.join(HOME, ".claude");
  const terseDir = path.join(claudeDir, "terse");
  const scriptSrc = path.join(ROOT, "extras", "terse", "terse-enforcer.mjs");
  const scriptDst = path.join(terseDir, "terse-enforcer.mjs");

  if (!fs.existsSync(scriptSrc)) {
    console.error(`Hook source not found: ${scriptSrc}`);
    return 1;
  }

  // 1. Copy the enforcer script.
  fs.mkdirSync(terseDir, { recursive: true });
  fs.copyFileSync(scriptSrc, scriptDst);

  // 2. Write limits config.
  const limits = { maxWords: 60, maxParas: 2, maxHeaders: 0, maxBullets: 4 };
  const arg = (name) => {
    const i = args.indexOf(name);
    return i !== -1 && args[i + 1] ? Number(args[i + 1]) : undefined;
  };
  if (arg("--max-words")) limits.maxWords = arg("--max-words");
  if (arg("--max-paras")) limits.maxParas = arg("--max-paras");
  if (arg("--max-headers")) limits.maxHeaders = arg("--max-headers");
  if (arg("--max-bullets")) limits.maxBullets = arg("--max-bullets");
  fs.writeFileSync(path.join(claudeDir, "terse.json"), JSON.stringify(limits, null, 2) + "\n");

  // 3. Register the Stop hook in settings.json (idempotent).
  const settingsPath = path.join(claudeDir, "settings.json");
  let settings = {};
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch {
    /* create fresh */
  }
  settings.hooks ??= {};
  settings.hooks.Stop ??= [];
  const hookCommand = `node "${scriptDst}"`;
  const already = settings.hooks.Stop.some((group) =>
    (group.hooks || []).some((h) => h.command === hookCommand)
  );
  if (!already) {
    settings.hooks.Stop.push({ hooks: [{ type: "command", command: hookCommand, timeout: 15 }] });
  }
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");

  console.log(`terse hook installed.`);
  console.log(`  script:  ${scriptDst}`);
  console.log(`  config:  ${path.join(claudeDir, "terse.json")} ${JSON.stringify(limits)}`);
  console.log(`  hook:    Stop -> ${hookCommand} in ${settingsPath}`);
  console.log(`\nEvery reply is now mechanically capped: over the limits, the stop is blocked and`);
  console.log(`the reply is rewritten flat and short. One rewrite per turn; the session fuse`);
  console.log(`passes after 2 blocks so a stubborn model can never loop. Remove:`);
  console.log(`  npx spec-stack terse remove`);
  return 0;
}

function terseRemove() {
  const claudeDir = path.join(HOME, ".claude");
  const scriptDst = path.join(claudeDir, "terse", "terse-enforcer.mjs");
  const hookCommand = `node "${scriptDst}"`;
  const settingsPath = path.join(claudeDir, "settings.json");

  let removed = 0;
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    if (settings.hooks?.Stop) {
      settings.hooks.Stop = settings.hooks.Stop
        .map((group) => ({
          ...group,
          hooks: (group.hooks || []).filter((h) => {
            if (h.command === hookCommand) {
              removed++;
              return false;
            }
            return true;
          }),
        }))
        .filter((group) => (group.hooks || []).length > 0);
      if (settings.hooks.Stop.length === 0) delete settings.hooks.Stop;
      if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    }
  } catch {
    /* no settings file -> nothing to unregister */
  }
  for (const p of [path.join(claudeDir, "terse.json"), path.join(claudeDir, "terse-state.json")]) {
    try {
      fs.rmSync(p);
    } catch {
      /* already gone */
    }
  }
  try {
    fs.rmSync(path.join(claudeDir, "terse"), { recursive: true, force: true });
  } catch {
    /* already gone */
  }
  console.log(`terse hook removed (${removed} hook entr${removed === 1 ? "y" : "ies"} unregistered).`);
  return 0;
}

function terseStatus() {
  const claudeDir = path.join(HOME, ".claude");
  const scriptDst = path.join(claudeDir, "terse", "terse-enforcer.mjs");
  const installed = fs.existsSync(scriptDst);
  console.log(`terse hook: ${installed ? "INSTALLED" : "not installed"}`);
  if (installed) {
    try {
      console.log(`  limits:  ${fs.readFileSync(path.join(claudeDir, "terse.json"), "utf8").trim()}`);
    } catch {
      /* defaults in effect */
    }
  }
  return 0;
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
  case "terse":
    process.exit(
      args[1] === "remove" ? terseRemove() : args[1] === "status" ? terseStatus() : terseInstall()
    );
  case "help":
  case "--help":
    console.log(`spec-stack — bootstrap for the ${REPO} multi-agent harness\n\ncommands: init (default) | doctor | map | codex-install\n          terse install|remove|status [--max-words N --max-paras N --max-headers N --max-bullets N]\nflags:   --claude (skip codex) | --codex (skip claude)`);
    process.exit(0);
  case "init":
  default:
    process.exit(install());
}
