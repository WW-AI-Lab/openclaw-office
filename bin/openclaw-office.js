#!/usr/bin/env node

import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile, access, readdir, unlink, mkdir, stat } from "node:fs/promises";
import { resolve, join, extname, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces, homedir } from "node:os";
import { execFile } from "node:child_process";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const distDir = resolve(__dirname, "..", "dist");

// --- Service subcommand routing ---
// If argv[2] is "service", delegate to the service manager module.
if (process.argv[2] === "service") {
  const { runService } = await import("./service.js");
  await runService();
  process.exit(0);
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
};

// --- Argument parsing ---

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { token: "", gatewayUrl: "", port: 0, host: "" };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if ((arg === "--token" || arg === "-t") && next) {
      result.token = next; i++;
    } else if ((arg === "--gateway" || arg === "-g") && next) {
      result.gatewayUrl = next; i++;
    } else if ((arg === "--port" || arg === "-p") && next) {
      result.port = parseInt(next, 10); i++;
    } else if (arg === "--host" && next) {
      result.host = next; i++;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return result;
}

function printHelp() {
  console.log(`
  \x1b[36mOpenClaw Office\x1b[0m — Visual monitoring frontend for OpenClaw

  \x1b[1mUsage:\x1b[0m
    openclaw-office [options]

  \x1b[1mOptions:\x1b[0m
    -t, --token <token>      Gateway auth token
    -g, --gateway <url>      Gateway WebSocket URL (default: ws://localhost:18789)
    -p, --port <port>        Server port (default: 5180, or PORT env)
    --host <host>            Bind address (default: 0.0.0.0)
    -h, --help               Show this help

  \x1b[1mToken auto-detection:\x1b[0m
    The token is resolved in this order:
    1. --token flag
    2. OPENCLAW_GATEWAY_TOKEN environment variable
    3. Auto-read from ~/.openclaw/openclaw.json

  \x1b[1mExamples:\x1b[0m
    openclaw-office
    openclaw-office --token my-secret-token
    openclaw-office --gateway ws://192.168.1.100:18789
    PORT=3000 openclaw-office

  \x1b[1mService management:\x1b[0m
    openclaw-office service install --token <token>    # Auto-start on login/boot
    openclaw-office service status                     # Check service status
    openclaw-office service stop                       # Stop the service
    openclaw-office service uninstall                  # Remove the service
    openclaw-office service help                       # Show service help
`);
}

// --- Token auto-detection from openclaw config file ---

function readTokenFromConfig() {
  const candidates = [
    join(homedir(), ".openclaw", "openclaw.json"),
    join(homedir(), ".clawdbot", "clawdbot.json"),
  ];
  for (const filePath of candidates) {
    try {
      const raw = readFileSync(filePath, "utf-8");
      const config = JSON.parse(raw);
      const token = config?.gateway?.auth?.token;
      if (token && typeof token === "string" && token.length > 0) {
        return { token, source: filePath };
      }
    } catch {
      // file not found or parse error
    }
  }
  return null;
}

// --- Config resolution ---

function resolveConfig() {
  const args = parseArgs();

  let token = "";
  let tokenSource = "";

  if (args.token) {
    token = args.token;
    tokenSource = "command line --token";
  } else if (process.env.OPENCLAW_GATEWAY_TOKEN) {
    token = process.env.OPENCLAW_GATEWAY_TOKEN;
    tokenSource = "OPENCLAW_GATEWAY_TOKEN env";
  } else {
    const fromFile = readTokenFromConfig();
    if (fromFile) {
      token = fromFile.token;
      tokenSource = fromFile.source;
    }
  }

  const gatewayUrl = args.gatewayUrl || process.env.OPENCLAW_GATEWAY_URL || "ws://localhost:18789";
  const port = args.port || parseInt(process.env.PORT || "5180", 10);
  const host = args.host || process.env.HOST || "0.0.0.0";

  return { token, tokenSource, gatewayUrl, port, host };
}

// --- HTTP Server ---

const config = resolveConfig();

const runtimeConfig = JSON.stringify({
  gatewayUrl: config.gatewayUrl,
  gatewayToken: config.token,
  gatewayWsPath: "/gateway-ws",
});
const configScript = `<script>window.__OPENCLAW_CONFIG__=${runtimeConfig};</script>`;
const gatewayWsPrefixes = new Set(["/gateway-ws", "/api/gateway/ws"]);
const WORKSPACE_SKILLS_DIR = join(homedir(), ".openclaw", "workspace", "skills");
const BUNDLED_SKILLS_DIR = resolve(__dirname, "skills");
const DEFAULT_BUNDLED_SKILL_SLUGS = ["skill-workbench-mermaid-guard"];

async function tryReadFile(filePath) {
  try {
    await access(filePath);
    return await readFile(filePath);
  } catch {
    return null;
  }
}

let indexHtmlCache = null;

async function getIndexHtml() {
  if (indexHtmlCache) return indexHtmlCache;
  const raw = await readFile(join(distDir, "index.html"), "utf-8");
  indexHtmlCache = raw.replace("</head>", `${configScript}\n</head>`);
  return indexHtmlCache;
}

function toHttpUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol === "ws:") {
    url.protocol = "http:";
  } else if (url.protocol === "wss:") {
    url.protocol = "https:";
  }
  return url;
}

function serializeUpgradeResponse(res) {
  const lines = [`HTTP/1.1 ${res.statusCode} ${res.statusMessage}`];
  for (const [key, value] of Object.entries(res.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        lines.push(`${key}: ${item}`);
      }
    } else if (typeof value !== "undefined") {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push("\r\n");
  return lines.join("\r\n");
}

function writeSocketError(socket, statusCode, message) {
  if (socket.destroyed) {
    return;
  }
  socket.write(
    `HTTP/1.1 ${statusCode} ${message}\r\nConnection: close\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`,
  );
  socket.destroy();
}

function proxyWsUpgrade(req, downstreamSocket, downstreamHead) {
  const upstreamUrl = toHttpUrl(config.gatewayUrl);
  const headers = {
    host: upstreamUrl.host,
    connection: "Upgrade",
    upgrade: "websocket",
    origin: upstreamUrl.origin,
    "sec-websocket-version": req.headers["sec-websocket-version"] || "13",
    "sec-websocket-key": req.headers["sec-websocket-key"],
  };
  if (req.headers["sec-websocket-protocol"]) {
    headers["sec-websocket-protocol"] = req.headers["sec-websocket-protocol"];
  }

  const doRequest = upstreamUrl.protocol === "https:" ? httpsRequest : httpRequest;
  const upstreamReq = doRequest(upstreamUrl, { method: "GET", headers });
  let settled = false;
  let upgraded = false;

  const fail = (statusCode, message) => {
    if (settled) {
      return;
    }
    settled = true;
    writeSocketError(downstreamSocket, statusCode, message);
  };

  upstreamReq.on("upgrade", (upstreamRes, upstreamSocket, upstreamHead) => {
    if (settled) {
      upstreamSocket.destroy();
      return;
    }
    settled = true;
    upgraded = true;

    if (downstreamSocket.destroyed) {
      upstreamSocket.destroy();
      return;
    }

    downstreamSocket.write(serializeUpgradeResponse(upstreamRes));

    if (downstreamHead.length > 0) {
      upstreamSocket.write(downstreamHead);
    }
    if (upstreamHead.length > 0) {
      downstreamSocket.write(upstreamHead);
    }

    downstreamSocket.pipe(upstreamSocket, { end: false });
    upstreamSocket.pipe(downstreamSocket, { end: false });

    const closeBoth = () => {
      if (!downstreamSocket.destroyed) {
        downstreamSocket.destroy();
      }
      if (!upstreamSocket.destroyed) {
        upstreamSocket.destroy();
      }
    };

    downstreamSocket.on("error", closeBoth);
    upstreamSocket.on("error", closeBoth);
    downstreamSocket.on("close", closeBoth);
    upstreamSocket.on("close", closeBoth);
  });

  upstreamReq.on("response", (upstreamRes) => {
    upstreamRes.resume();
    fail(upstreamRes.statusCode || 502, upstreamRes.statusMessage || "Bad Gateway");
  });
  upstreamReq.on("error", () => {
    fail(502, "Bad Gateway");
  });
  downstreamSocket.on("error", () => {
    if (!upgraded) {
      upstreamReq.destroy();
    }
  });
  downstreamSocket.on("close", () => {
    if (!upgraded) {
      upstreamReq.destroy();
    }
  });

  upstreamReq.end();
}

// --- Chat history file-based cache (per-day sharded) ---
//
// Directory layout:
//   ~/.openclaw/office-cache/chat/
//     _sessions.json                         — session list index
//     {safe-session-key}/                    — one dir per session
//       _meta.json                           — { sessionKey, agentId, cachedAt }
//       2026-03-27.json                      — messages for that day
//       2026-03-26.json
//       ...
//
// On read  → scan all day-files in the session dir, merge & sort by timestamp
// On write → only append/overwrite the current-day file with today's messages

const CHAT_CACHE_DIR = join(homedir(), ".openclaw", "office-cache", "chat");
const SESSIONS_FILE = join(CHAT_CACHE_DIR, "_sessions.json");
const MAX_DAY_FILES = 90;

function ensureCacheDir() {
  if (!existsSync(CHAT_CACHE_DIR)) {
    mkdirSync(CHAT_CACHE_DIR, { recursive: true });
  }
}

ensureCacheDir();

function safeSessionDirName(sessionKey) {
  return sessionKey.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function todayDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateStringFromTimestamp(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isDayFile(name) {
  return /^\d{4}-\d{2}-\d{2}\.json$/u.test(name);
}

async function readJsonFile(filePath) {
  try {
    await access(filePath);
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath, data) {
  await writeFile(filePath, JSON.stringify(data), "utf-8");
}

async function ensureDir(dir) {
  try {
    await mkdir(dir, { recursive: true });
  } catch { /* already exists */ }
}

async function safeReaddir(dir) {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

function ensureInside(baseDir, targetPath) {
  const normalizedBase = `${resolve(baseDir)}/`;
  const normalizedTarget = resolve(targetPath);
  if (normalizedTarget !== resolve(baseDir) && !normalizedTarget.startsWith(normalizedBase)) {
    throw new Error("Invalid workspace skill path");
  }
  return normalizedTarget;
}

async function listWorkspaceSkillFiles(skillSlug) {
  const skillDir = ensureInside(WORKSPACE_SKILLS_DIR, join(WORKSPACE_SKILLS_DIR, skillSlug));
  const entries = await readdir(skillDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(skillDir, entry.name);
    if (entry.isDirectory()) {
      const childFiles = await listWorkspaceSkillFiles(join(skillSlug, entry.name));
      files.push(...childFiles.map((file) => ({
        ...file,
        name: `${entry.name}/${file.name}`,
      })));
      continue;
    }

    const info = await stat(fullPath);
    files.push({
      name: entry.name,
      size: info.size,
      modifiedAt: info.mtimeMs,
    });
  }

  return files.sort((left, right) => left.name.localeCompare(right.name));
}

async function readWorkspaceSkillFile(skillSlug, name) {
  const skillDir = ensureInside(WORKSPACE_SKILLS_DIR, join(WORKSPACE_SKILLS_DIR, skillSlug));
  const filePath = ensureInside(skillDir, join(skillDir, name));
  const [content, info] = await Promise.all([
    readFile(filePath, "utf-8"),
    stat(filePath),
  ]);

  return {
    name,
    content,
    size: info.size,
    modifiedAt: info.mtime.toISOString(),
  };
}

async function writeWorkspaceSkillFile(skillSlug, name, content) {
  const skillDir = ensureInside(WORKSPACE_SKILLS_DIR, join(WORKSPACE_SKILLS_DIR, skillSlug));
  const filePath = ensureInside(skillDir, join(skillDir, name));
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
  const info = await stat(filePath);
  return { name, size: info.size, modifiedAt: info.mtime.toISOString() };
}

async function findGitRoot(startDir) {
  let current = resolve(startDir);
  for (let i = 0; i < 10; i++) {
    try {
      await access(join(current, ".git"));
      return current;
    } catch {
      /* walk up */
    }
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return null;
}

function runGit(repoRoot, args) {
  return new Promise((resolveRun) => {
    execFile(
      "git",
      ["-C", repoRoot, ...args],
      { timeout: 5000, encoding: "utf-8" },
      (err, stdout, stderr) => {
        const code = err && typeof err.code === "number" ? err.code : err ? 1 : 0;
        resolveRun({ stdout: String(stdout ?? ""), stderr: String(stderr ?? ""), code });
      },
    );
  });
}

async function copyDirRecursive(srcDir, destDir) {
  await mkdir(destDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      const data = await readFile(srcPath);
      await writeFile(destPath, data);
    }
  }
}

async function ensureBundledSkillInstalled(skillSlug) {
  const targetDir = ensureInside(WORKSPACE_SKILLS_DIR, join(WORKSPACE_SKILLS_DIR, skillSlug));
  const targetSkillMd = join(targetDir, "SKILL.md");
  try {
    await access(targetSkillMd);
    return { slug: skillSlug, status: "present" };
  } catch {
    // Not installed yet — attempt to install from bundled source.
  }

  const bundledDir = resolve(BUNDLED_SKILLS_DIR, skillSlug);
  const bundledSkillMd = join(bundledDir, "SKILL.md");
  try {
    await access(bundledSkillMd);
  } catch {
    return { slug: skillSlug, status: "missing_bundle" };
  }

  try {
    await copyDirRecursive(bundledDir, targetDir);
    return { slug: skillSlug, status: "installed" };
  } catch (err) {
    return { slug: skillSlug, status: "error", error: String(err?.message ?? err) };
  }
}

async function commitWorkspaceSkillFile(skillSlug, name, message) {
  const skillDir = ensureInside(WORKSPACE_SKILLS_DIR, join(WORKSPACE_SKILLS_DIR, skillSlug));
  const filePath = ensureInside(skillDir, join(skillDir, name));
  const repoRoot = await findGitRoot(dirname(filePath));
  if (!repoRoot) return { committed: false, reason: "not_a_git_repo" };

  const rel = relative(repoRoot, filePath);
  const add = await runGit(repoRoot, ["add", "--", rel]);
  if (add.code !== 0) {
    return { committed: false, reason: "failure", error: add.stderr || add.stdout };
  }
  const commit = await runGit(repoRoot, ["commit", "--only", "--", rel, "-m", message]);
  if (commit.code !== 0) {
    const out = `${commit.stdout}\n${commit.stderr}`.toLowerCase();
    if (out.includes("nothing to commit") || out.includes("no changes added")) {
      return { committed: false, reason: "nothing_to_commit" };
    }
    return { committed: false, reason: "failure", error: commit.stderr || commit.stdout };
  }
  const rev = await runGit(repoRoot, ["rev-parse", "--short", "HEAD"]);
  return { committed: true, commit: rev.stdout.trim() };
}

async function readSessionMessages(sessionDir) {
  const files = await safeReaddir(sessionDir);
  const dayFiles = files.filter(isDayFile).sort();
  const allMessages = [];
  for (const file of dayFiles) {
    const data = await readJsonFile(join(sessionDir, file));
    if (Array.isArray(data)) {
      allMessages.push(...data);
    }
  }
  allMessages.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
  return allMessages;
}

async function writeSessionMessages(sessionDir, sessionKey, agentId, messages) {
  await ensureDir(sessionDir);

  // Write meta
  await writeJsonFile(join(sessionDir, "_meta.json"), {
    sessionKey,
    agentId,
    cachedAt: Date.now(),
    messageCount: messages.length,
  });

  // Group messages by day
  const byDay = new Map();
  for (const msg of messages) {
    const day = dateStringFromTimestamp(msg.timestamp ?? Date.now());
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(msg);
  }

  // Write each day file
  for (const [day, dayMsgs] of byDay) {
    await writeJsonFile(join(sessionDir, `${day}.json`), dayMsgs);
  }

  // Prune old day files beyond MAX_DAY_FILES
  const files = await safeReaddir(sessionDir);
  const dayFiles = files.filter(isDayFile).sort();
  if (dayFiles.length > MAX_DAY_FILES) {
    const toRemove = dayFiles.slice(0, dayFiles.length - MAX_DAY_FILES);
    for (const file of toRemove) {
      try { await unlink(join(sessionDir, file)); } catch { /* ok */ }
    }
  }
}

async function deleteSessionDir(sessionDir) {
  const files = await safeReaddir(sessionDir);
  for (const file of files) {
    try { await unlink(join(sessionDir, file)); } catch { /* ok */ }
  }
  try {
    const { rmdir } = await import("node:fs/promises");
    await rmdir(sessionDir);
  } catch { /* ok */ }
}

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf-8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

async function handleChatCacheApi(req, res, pathname) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return true;
  }

  // GET /api/chat-cache/sessions
  if (pathname === "/api/chat-cache/sessions" && req.method === "GET") {
    const data = await readJsonFile(SESSIONS_FILE);
    sendJson(res, 200, { sessions: data?.sessions ?? [], cachedAt: data?.cachedAt ?? null });
    return true;
  }

  // PUT /api/chat-cache/sessions
  if (pathname === "/api/chat-cache/sessions" && req.method === "PUT") {
    const body = await readRequestBody(req);
    const sessions = Array.isArray(body.sessions) ? body.sessions : [];
    await writeJsonFile(SESSIONS_FILE, { sessions, cachedAt: Date.now() });
    sendJson(res, 200, { ok: true });
    return true;
  }

  // GET /api/chat-cache/messages?sessionKey=xxx
  if (pathname === "/api/chat-cache/messages" && req.method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const sessionKey = url.searchParams.get("sessionKey");
    if (!sessionKey) {
      sendJson(res, 400, { error: "Missing sessionKey" });
      return true;
    }
    const sessionDir = join(CHAT_CACHE_DIR, safeSessionDirName(sessionKey));
    const meta = await readJsonFile(join(sessionDir, "_meta.json"));
    const messages = await readSessionMessages(sessionDir);
    sendJson(res, 200, {
      messages,
      sessionKey: meta?.sessionKey ?? sessionKey,
      agentId: meta?.agentId ?? null,
      cachedAt: meta?.cachedAt ?? null,
    });
    return true;
  }

  // PUT /api/chat-cache/messages
  if (pathname === "/api/chat-cache/messages" && req.method === "PUT") {
    const body = await readRequestBody(req);
    const sessionKey = body.sessionKey;
    if (!sessionKey || typeof sessionKey !== "string") {
      sendJson(res, 400, { error: "Missing sessionKey" });
      return true;
    }
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const agentId = body.agentId ?? null;
    const sessionDir = join(CHAT_CACHE_DIR, safeSessionDirName(sessionKey));
    await writeSessionMessages(sessionDir, sessionKey, agentId, messages);
    sendJson(res, 200, { ok: true });
    return true;
  }

  // GET /api/chat-cache/all-messages
  if (pathname === "/api/chat-cache/all-messages" && req.method === "GET") {
    ensureCacheDir();
    const entries = await safeReaddir(CHAT_CACHE_DIR);
    const result = [];
    for (const entry of entries) {
      if (entry.startsWith("_") || entry.endsWith(".json")) continue;
      const sessionDir = join(CHAT_CACHE_DIR, entry);
      const meta = await readJsonFile(join(sessionDir, "_meta.json"));
      if (meta?.sessionKey) {
        result.push({
          sessionKey: meta.sessionKey,
          agentId: meta.agentId ?? null,
          messageCount: meta.messageCount ?? 0,
          cachedAt: meta.cachedAt ?? null,
        });
      }
    }
    sendJson(res, 200, { sessions: result });
    return true;
  }

  // DELETE /api/chat-cache/messages?sessionKey=xxx
  if (pathname === "/api/chat-cache/messages" && req.method === "DELETE") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const sessionKey = url.searchParams.get("sessionKey");
    if (!sessionKey) {
      sendJson(res, 400, { error: "Missing sessionKey" });
      return true;
    }
    const sessionDir = join(CHAT_CACHE_DIR, safeSessionDirName(sessionKey));
    await deleteSessionDir(sessionDir);
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}

async function handleWorkspaceSkillsApi(req, res, pathname) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return true;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (pathname === "/api/workspace-skills/list" && req.method === "GET") {
    const skillSlug = url.searchParams.get("slug");
    if (!skillSlug) {
      sendJson(res, 400, { error: "Missing slug" });
      return true;
    }

    const files = await listWorkspaceSkillFiles(skillSlug);
    sendJson(res, 200, {
      agentId: skillSlug,
      workspace: "~/.openclaw/workspace/skills",
      files,
    });
    return true;
  }

  if (pathname === "/api/workspace-skills/file" && req.method === "GET") {
    const skillSlug = url.searchParams.get("slug");
    const name = url.searchParams.get("name");
    if (!skillSlug || !name) {
      sendJson(res, 400, { error: "Missing slug or name" });
      return true;
    }

    const file = await readWorkspaceSkillFile(skillSlug, name);
    sendJson(res, 200, {
      agentId: skillSlug,
      workspace: "~/.openclaw/workspace/skills",
      file,
    });
    return true;
  }

  if (pathname === "/api/workspace-skills/save" && req.method === "POST") {
    const body = await readRequestBody(req);
    const skillSlug = typeof body.slug === "string" ? body.slug : "";
    const name = typeof body.name === "string" ? body.name : "";
    const content = typeof body.content === "string" ? body.content : null;
    if (!skillSlug || !name || content === null) {
      sendJson(res, 400, { error: "Missing slug, name or content" });
      return true;
    }
    const info = await writeWorkspaceSkillFile(skillSlug, name, content);
    sendJson(res, 200, { agentId: skillSlug, file: info });
    return true;
  }

  if (pathname === "/api/workspace-skills/commit" && req.method === "POST") {
    const body = await readRequestBody(req);
    const skillSlug = typeof body.slug === "string" ? body.slug : "";
    const name = typeof body.name === "string" ? body.name : "";
    const message =
      typeof body.message === "string" && body.message.trim().length > 0
        ? body.message
        : `chore(skill): update ${skillSlug}/${name} via OpenClaw Office`;
    if (!skillSlug || !name) {
      sendJson(res, 400, { error: "Missing slug or name" });
      return true;
    }
    const result = await commitWorkspaceSkillFile(skillSlug, name, message);
    sendJson(res, 200, result);
    return true;
  }

  if (pathname === "/api/workspace-skills/ensure-defaults" && req.method === "POST") {
    const body = await readRequestBody(req);
    const rawSlugs = Array.isArray(body.slugs) ? body.slugs : null;
    const slugs = (rawSlugs && rawSlugs.length > 0 ? rawSlugs : DEFAULT_BUNDLED_SKILL_SLUGS)
      .filter((s) => typeof s === "string" && s.length > 0 && !s.includes("/") && !s.includes(".."));
    await mkdir(WORKSPACE_SKILLS_DIR, { recursive: true });
    const results = [];
    for (const slug of slugs) {
      try {
        results.push(await ensureBundledSkillInstalled(slug));
      } catch (err) {
        results.push({ slug, status: "error", error: String(err?.message ?? err) });
      }
    }
    sendJson(res, 200, { results });
    return true;
  }

  return false;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  // Chat cache REST API
  if (pathname.startsWith("/api/chat-cache/")) {
    try {
      const handled = await handleChatCacheApi(req, res, pathname);
      if (handled) return;
    } catch (err) {
      sendJson(res, 500, { error: String(err) });
      return;
    }
  }

  if (pathname.startsWith("/api/workspace-skills/")) {
    try {
      const handled = await handleWorkspaceSkillsApi(req, res, pathname);
      if (handled) return;
    } catch (err) {
      sendJson(res, 500, { error: String(err) });
      return;
    }
  }

  // Serve injected index.html for root and SPA routes
  if (pathname === "/" || pathname === "/index.html") {
    const html = await getIndexHtml();
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  // Try serving static file
  const filePath = join(distDir, pathname);
  const content = await tryReadFile(filePath);

  if (content) {
    const ext = extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    res.end(content);
    return;
  }

  // SPA fallback for client-side routes
  const html = await getIndexHtml();
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});

server.on("upgrade", (req, socket, head) => {
  const pathname = new URL(req.url || "/", "http://localhost").pathname;
  if (!gatewayWsPrefixes.has(pathname)) {
    writeSocketError(socket, 404, "Not Found");
    return;
  }
  proxyWsUpgrade(req, socket, head);
});

server.listen(config.port, config.host, () => {
  console.log();
  console.log("  \x1b[36m\u{1F3E2} OpenClaw Office\x1b[0m");
  console.log();
  console.log(`  \x1b[32m\u{27A1}\x1b[0m  Local:   \x1b[36mhttp://localhost:${config.port}\x1b[0m`);
  if (config.host === "0.0.0.0") {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === "IPv4" && !net.internal) {
          console.log(`  \x1b[32m\u{27A1}\x1b[0m  Network: \x1b[36mhttp://${net.address}:${config.port}\x1b[0m`);
        }
      }
    }
  }
  console.log();
  console.log(`  \x1b[32m\u{27A1}\x1b[0m  Gateway: \x1b[33m${config.gatewayUrl}\x1b[0m`);
  if (config.token) {
    console.log(`  \x1b[32m\u{2713}\x1b[0m  Token:   \x1b[32mloaded\x1b[0m \x1b[90m(from ${config.tokenSource})\x1b[0m`);
  } else {
    console.log(`  \x1b[33m\u{26A0}\x1b[0m  Token:   \x1b[33mnot found\x1b[0m`);
    console.log();
    console.log("  \x1b[90mTo connect to Gateway, provide a token:\x1b[0m");
    console.log("  \x1b[90m  openclaw-office --token <your-token>\x1b[0m");
    console.log("  \x1b[90m  or install openclaw CLI and the token will be auto-detected\x1b[0m");
  }
  console.log();
  console.log("  Press \x1b[1mCtrl+C\x1b[0m to stop");
  console.log();
});
