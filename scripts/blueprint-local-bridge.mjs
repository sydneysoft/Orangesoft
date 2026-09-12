#!/usr/bin/env node

import http from "node:http";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

const HOST = "127.0.0.1";
const PORT = Number(process.env.BLUEPRINT_BRIDGE_PORT || 8787);
const MODEL = String(process.env.BLUEPRINT_LOCAL_MODEL || "blueprint-local").trim();
const OLLAMA = String(process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
const WORKSPACE = path.resolve(process.env.BLUEPRINT_WORKSPACE || path.join(os.homedir(), "blueprint-workspace"));
const TOKEN_FILE = path.join(os.homedir(), ".blueprint-bridge-token");
const MAX_BODY = 1_000_000;
const MAX_FILE_BYTES = 1_000_000;
const MAX_READ_CHARS = 30_000;
const MAX_FIND_FILES = 5_000;
const MAX_FIND_MATCHES = 50;

const REPOS = Object.freeze({
  orangesoft: "Orangesoft",
  storylingo: "hellboychronicles",
  hellboychronicles: "hellboychronicles",
});

const IGNORE_DIRS = new Set([".git", "node_modules", ".next", "dist", "build", "coverage", ".vercel", ".turbo", ".cache"]);
const TEXT_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".json", ".md", ".txt", ".css", ".scss", ".html", ".yml", ".yaml",
  ".py", ".go", ".rs", ".java", ".kt", ".swift", ".c", ".h", ".cpp", ".hpp", ".sh", ".zsh", ".toml", ".xml", ".sql",
]);

function isSecretName(name) {
  const lower = String(name || "").toLowerCase();
  return lower.startsWith(".env") || lower.endsWith(".pem") || lower.endsWith(".key") || lower === "id_rsa" || lower.includes("credentials") || lower.includes("secret");
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function token() {
  return (await fs.readFile(TOKEN_FILE, "utf8")).trim();
}

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error("REQUEST TOO LARGE");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function cleanBody(value) {
  let text = String(value || "").trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) text = text.slice(1, -1);
  return text.trim();
}

function repoRoot(alias) {
  const key = String(alias || "").trim().toLowerCase();
  const folder = REPOS[key];
  if (!folder) throw new Error(`UNKNOWN LOCAL REPOSITORY: ${alias}. AVAILABLE: orangesoft, storylingo`);
  return path.join(WORKSPACE, folder);
}

function assertInside(root, target) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error("PATH ESCAPES LOCAL REPOSITORY");
  return resolvedTarget;
}

function parseInspectTarget(body) {
  const text = cleanBody(body);
  if (!text) return { alias: "orangesoft", relative: "" };
  const colon = text.indexOf(":");
  if (colon > 0) return { alias: text.slice(0, colon).trim().toLowerCase(), relative: text.slice(colon + 1).trim().replace(/^\/+/, "") };
  if (REPOS[text.toLowerCase()]) return { alias: text.toLowerCase(), relative: "" };
  return { alias: "orangesoft", relative: text.replace(/^\/+/, "") };
}

function parseFindTarget(body) {
  const text = cleanBody(body);
  const colon = text.indexOf(":");
  if (colon > 0 && REPOS[text.slice(0, colon).trim().toLowerCase()]) {
    return { aliases: [text.slice(0, colon).trim().toLowerCase()], query: cleanBody(text.slice(colon + 1)) };
  }
  return { aliases: ["orangesoft", "storylingo"], query: text };
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), options.timeout || 4_000);
    child.stdout.on("data", d => { if (stdout.length < 20_000) stdout += d; });
    child.stderr.on("data", d => { if (stderr.length < 8_000) stderr += d; });
    child.on("close", code => { clearTimeout(timer); resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }); });
    child.on("error", error => { clearTimeout(timer); resolve({ code: -1, stdout, stderr: String(error.message || error) }); });
  });
}

async function ensureRepo(alias) {
  const root = repoRoot(alias);
  const stat = await fs.stat(root).catch(() => null);
  if (!stat?.isDirectory()) throw new Error(`LOCAL REPOSITORY NOT FOUND: ${root}. CLONE IT INTO ${WORKSPACE}.`);
  return root;
}

async function listDirectory(root, dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter(entry => !IGNORE_DIRS.has(entry.name) && !isSecretName(entry.name))
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
    .slice(0, 120)
    .map(entry => `${entry.isDirectory() ? "DIR " : "FILE"}  ${path.relative(root, path.join(dir, entry.name)) || entry.name}`)
    .join("\n");
}

async function inspectLocal(body) {
  const { alias, relative } = parseInspectTarget(body);
  const root = await ensureRepo(alias);
  const target = assertInside(root, path.join(root, relative));
  const basename = path.basename(target);
  if (isSecretName(basename)) throw new Error("SECRET OR CREDENTIAL FILES ARE BLOCKED");

  const realRoot = await fs.realpath(root);
  const realTarget = await fs.realpath(target).catch(() => null);
  if (!realTarget) throw new Error(`PATH NOT FOUND: ${alias}:${relative || "/"}`);
  assertInside(realRoot, realTarget);

  const stat = await fs.stat(realTarget);
  const git = await run("git", ["-C", root, "status", "--short", "--branch"], { timeout: 3_000 });
  const gitStatus = git.code === 0 ? git.stdout : "git status unavailable";

  if (stat.isDirectory()) {
    const listing = await listDirectory(root, realTarget);
    return `LOCAL INSPECT · ${alias}:${relative || "/"}\n\nGIT\n${gitStatus || "clean"}\n\nCONTENTS\n${listing || "(empty)"}`;
  }

  if (!stat.isFile()) throw new Error("ONLY FILES AND DIRECTORIES CAN BE INSPECTED");
  if (stat.size > MAX_FILE_BYTES) throw new Error("FILE TOO LARGE TO INSPECT");
  const ext = path.extname(realTarget).toLowerCase();
  if (ext && !TEXT_EXTENSIONS.has(ext)) throw new Error("BINARY OR UNSUPPORTED FILE TYPE");
  const text = await fs.readFile(realTarget, "utf8");
  if (text.includes("\0")) throw new Error("BINARY FILE BLOCKED");
  const numbered = text.slice(0, MAX_READ_CHARS).split("\n").map((line, i) => `${String(i + 1).padStart(4, " ")} | ${line}`).join("\n");
  return `LOCAL INSPECT · ${alias}:${relative}\n\nGIT\n${gitStatus || "clean"}\n\nFILE\n${numbered}${text.length > MAX_READ_CHARS ? "\n…TRUNCATED" : ""}`;
}

async function walkTextFiles(root) {
  const files = [];
  const queue = [root];
  while (queue.length && files.length < MAX_FIND_FILES) {
    const dir = queue.shift();
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name) || isSecretName(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) queue.push(full);
      else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!ext || TEXT_EXTENSIONS.has(ext)) files.push(full);
      }
      if (files.length >= MAX_FIND_FILES) break;
    }
  }
  return files;
}

async function findLocal(body) {
  const { aliases, query } = parseFindTarget(body);
  if (query.length < 2 || query.length > 200) throw new Error("FIND QUERY MUST BE 2–200 CHARACTERS");
  const needle = query.toLowerCase();
  const matches = [];

  for (const alias of aliases) {
    const root = await ensureRepo(alias);
    const files = await walkTextFiles(root);
    for (const file of files) {
      if (matches.length >= MAX_FIND_MATCHES) break;
      const stat = await fs.stat(file).catch(() => null);
      if (!stat || stat.size > MAX_FILE_BYTES) continue;
      const text = await fs.readFile(file, "utf8").catch(() => "");
      if (!text || text.includes("\0")) continue;
      const lines = text.split("\n");
      for (let i = 0; i < lines.length && matches.length < MAX_FIND_MATCHES; i++) {
        if (lines[i].toLowerCase().includes(needle)) {
          matches.push(`${alias}:${path.relative(root, file)}:${i + 1}  ${lines[i].trim().slice(0, 240)}`);
        }
      }
    }
  }

  return `LOCAL FIND · ${query}\n\n${matches.length ? matches.join("\n") : "NO MATCHES"}${matches.length >= MAX_FIND_MATCHES ? "\n\nRESULT LIMIT REACHED" : ""}`;
}

function stripReasoning(text) {
  const value = String(text || "");
  const index = value.lastIndexOf("</think>");
  return (index >= 0 ? value.slice(index + 8) : value).trim();
}

async function askOllama(prompt, context = "") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const content = context ? `${prompt}\n\nLOCAL TOOL CONTEXT:\n${context.slice(0, 35_000)}` : prompt;
    const response = await fetch(`${OLLAMA}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content }],
        think: false,
        stream: false,
        keep_alive: "30s",
        options: { num_ctx: 2048, num_predict: 512, temperature: 0.2 },
      }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || `OLLAMA HTTP ${response.status}`);
    return stripReasoning(data?.message?.content || "");
  } finally {
    clearTimeout(timer);
  }
}

async function executePlan(raw, plan) {
  const activity = [];
  const outputs = [];
  const steps = Array.isArray(plan) && plan.length ? plan : [{ type: "reflect", body: raw }];

  for (const step of steps) {
    const type = String(step?.type || "").toLowerCase();
    const body = cleanBody(step?.body || raw);

    if (type === "inspect") {
      const output = await inspectLocal(body);
      outputs.push(output);
      activity.push({ tool: "inspect_local", ok: true, target: body });
      continue;
    }

    if (type === "find") {
      const output = await findLocal(body);
      outputs.push(output);
      activity.push({ tool: "find_local", ok: true, query: body });
      continue;
    }

    if (type === "reflect") {
      const context = outputs.join("\n\n");
      const output = await askOllama(body || raw, context);
      outputs.push(output);
      activity.push({ tool: "ollama_chat", ok: true, model: MODEL });
      continue;
    }

    throw Object.assign(new Error("LOCAL WRITE/DEPLOY TOOLS ARE NOT ENABLED YET. USE CLOUD FOR zdrobic(...), modify(...), AND deploy(...)."), { status: 409 });
  }

  return { output: outputs.join("\n\n"), activity };
}

const server = http.createServer(async (req, res) => {
  try {
    const expected = await token();
    const supplied = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!expected || !safeEqual(supplied, expected)) return json(res, 401, { ok: false, error: "UNAUTHORIZED" });

    if (req.method === "GET" && req.url === "/health") {
      const repos = {};
      for (const [alias, folder] of Object.entries(REPOS)) repos[alias] = fsSync.existsSync(path.join(WORKSPACE, folder));
      return json(res, 200, { ok: true, model: MODEL, tools: ["reflect", "inspect", "find"], workspace: WORKSPACE, repos });
    }

    if (req.method === "POST" && req.url === "/command") {
      const payload = await readJson(req);
      const raw = String(payload?.raw || "").trim();
      if (!raw || raw.length > 30_000) return json(res, 400, { ok: false, error: "COMMAND IS EMPTY OR TOO LARGE" });
      const result = await executePlan(raw, payload?.plan);
      return json(res, 200, { ok: true, output: result.output || "LOCAL AGENT COMPLETED", model: MODEL, activity: result.activity });
    }

    return json(res, 404, { ok: false, error: "NOT FOUND" });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return json(res, status, { ok: false, error: error instanceof Error ? error.message : String(error), model: MODEL });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`BLUEPRINT LOCAL BRIDGE ONLINE :${PORT}`);
  console.log(`MODEL ${MODEL}`);
  console.log(`WORKSPACE ${WORKSPACE}`);
  console.log("TOOLS reflect, inspect, find");
});
