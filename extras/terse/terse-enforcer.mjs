#!/usr/bin/env node
// terse-enforcer — mechanical reply-length gate for Claude Code.
// Stop hook: reads the turn's transcript, measures the last assistant reply,
// and BLOCKS the stop when the reply is too long or too structured.
// Prose cannot bind an agent; a word count can.
//
// Install/limits: `npx spec-stack terse install --max-words 60 --max-paras 2`
// Limits: env TERSE_MAX_WORDS / TERSE_MAX_PARAS > ~/.claude/terse.json > defaults.
// Loop safety: passes immediately when stop_hook_active (Claude Code's own
// one-rewrite-per-turn contract) plus a per-session fuse as belt and braces.
// Fails open: any parse error, missing transcript, or no assistant text -> exit 0.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOME = os.homedir();
const CONFIG_PATH = path.join(HOME, ".claude", "terse.json");
const STATE_PATH = path.join(HOME, ".claude", "terse-state.json");

const defaults = { maxWords: 60, maxParas: 2, maxHeaders: 0, maxBullets: 4 };

function loadConfig() {
  let cfg = { ...defaults };
  try {
    cfg = { ...cfg, ...JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) };
  } catch {
    /* no config file -> defaults */
  }
  const env = (k) => Number(process.env[k]);
  if (env("TERSE_MAX_WORDS")) cfg.maxWords = env("TERSE_MAX_WORDS");
  if (env("TERSE_MAX_PARAS")) cfg.maxParas = env("TERSE_MAX_PARAS");
  if (env("TERSE_MAX_HEADERS")) cfg.maxHeaders = env("TERSE_MAX_HEADERS");
  if (env("TERSE_MAX_BULLETS")) cfg.maxBullets = env("TERSE_MAX_BULLETS");
  return cfg;
}

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
  });
}

function lastAssistantText(transcriptPath) {
  const lines = fs.readFileSync(transcriptPath, "utf8").split("\n").filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    let entry;
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (entry.type !== "assistant" || !entry.message || !Array.isArray(entry.message.content)) continue;
    const text = entry.message.content
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (text) return text;
  }
  return null;
}

// Measure prose only: fenced code blocks are the answer, not prose.
function measure(text) {
  const withoutCode = text.replace(/```[\s\S]*?```/g, "\n");
  const paras = withoutCode.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const words = withoutCode.split(/\s+/).filter(Boolean).length;
  const headers = withoutCode.split("\n").filter((l) => /^\s*#{1,6}\s/.test(l)).length;
  const bullets = withoutCode.split("\n").filter((l) => /^\s*([-*+]|\d+\.)\s/.test(l)).length;
  return { words, paras: paras.length, headers, bullets };
}

function block(reason) {
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
}

const event = JSON.parse(await readStdin().catch(() => "{}"));

// Loop guard 1: Claude Code's own contract — if this stop is already a
// continuation caused by a Stop hook, pass.
if (event.stop_hook_active) process.exit(0);

// Loop guard 2: per-session fuse (max 2 blocks per 90s window).
let state = {};
try {
  state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
} catch {
  /* fresh */
}
const now = Date.now();
if (state.session_id !== event.session_id || now - (state.ts || 0) > 90_000) {
  state = { session_id: event.session_id, count: 0, ts: now };
}
state.count += 1;
state.ts = now;
try {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state));
} catch {
  /* state is best-effort */
}
if (state.count > 2) process.exit(0);

// No transcript or no reply text -> nothing to enforce.
if (!event.transcript_path || !fs.existsSync(event.transcript_path)) process.exit(0);
const text = lastAssistantText(event.transcript_path);
if (!text) process.exit(0);

const cfg = loadConfig();
const m = measure(text);
const over = [];
if (m.words > cfg.maxWords) over.push(`${m.words} words (limit ${cfg.maxWords})`);
if (m.paras > cfg.maxParas) over.push(`${m.paras} paragraphs (limit ${cfg.maxParas})`);
if (m.headers > cfg.maxHeaders) over.push(`${m.headers} markdown headers (limit ${cfg.maxHeaders})`);
if (m.bullets > cfg.maxBullets) over.push(`${m.bullets} list lines (limit ${cfg.maxBullets})`);

if (over.length === 0) process.exit(0);

block(
  `FLAT SHORT REPLY REQUIRED. This reply: ${over.join("; ")}. ` +
    `Rewrite the SAME content as a very flat, short reply: plain sentences, no headers, ` +
    `no bold, bullets only if the list is itself the answer, code fences only for code. ` +
    `Do not restate the task, do not apologize, do not add caveats beyond one short line of real risk.`
);
