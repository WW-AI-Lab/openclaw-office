import { resolve, join, dirname, relative } from "node:path";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile, readdir, unlink, access, mkdir, rmdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { execFile } from "node:child_process";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
const rootDir = fileURLToPath(new URL(".", import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf-8"));
const rawGatewayUrl = process.env.OPENCLAW_GATEWAY_URL || process.env.VITE_GATEWAY_URL || "ws://localhost:18789";
const gatewayUrl = new URL(rawGatewayUrl);
const gatewayTarget = `${gatewayUrl.protocol === "wss:" ? "https:" : gatewayUrl.protocol === "ws:" ? "http:" : gatewayUrl.protocol}//${gatewayUrl.host}`;
const gatewayPath = `${gatewayUrl.pathname}${gatewayUrl.search}` || "/";
// --- Per-day sharded chat cache helpers (shared with bin/openclaw-office.js) ---
const CHAT_CACHE_DIR = join(homedir(), ".openclaw", "office-cache", "chat");
const WORKSPACE_SKILLS_DIR = join(homedir(), ".openclaw", "workspace", "skills");
const MAX_DAY_FILES = 90;
function ensureCacheDir() {
    if (!existsSync(CHAT_CACHE_DIR)) {
        mkdirSync(CHAT_CACHE_DIR, { recursive: true });
    }
}
function safeSessionDirName(sessionKey) {
    return sessionKey.replace(/[^a-zA-Z0-9_-]/g, "_");
}
function dateStringFromTimestamp(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isDayFile(name) {
    return /^\d{4}-\d{2}-\d{2}\.json$/u.test(name);
}
async function readJsonFile(filePath) {
    try {
        await access(filePath);
        const raw = await readFile(filePath, "utf-8");
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
async function writeJsonFile(filePath, data) {
    await writeFile(filePath, JSON.stringify(data), "utf-8");
}
async function safeReaddir(dir) {
    try {
        return await readdir(dir);
    }
    catch {
        return [];
    }
}
async function readSessionMessages(sessionDir) {
    const files = (await safeReaddir(sessionDir)).filter(isDayFile).sort();
    const all = [];
    for (const f of files) {
        const data = await readJsonFile(join(sessionDir, f));
        if (Array.isArray(data))
            all.push(...data);
    }
    all.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    return all;
}
async function writeSessionMessages(sessionDir, sessionKey, agentId, messages) {
    await mkdir(sessionDir, { recursive: true });
    await writeJsonFile(join(sessionDir, "_meta.json"), {
        sessionKey, agentId, cachedAt: Date.now(), messageCount: messages.length,
    });
    const byDay = new Map();
    for (const msg of messages) {
        const day = dateStringFromTimestamp(msg.timestamp ?? Date.now());
        if (!byDay.has(day))
            byDay.set(day, []);
        byDay.get(day).push(msg);
    }
    for (const [day, dayMsgs] of byDay) {
        await writeJsonFile(join(sessionDir, `${day}.json`), dayMsgs);
    }
    const dayFiles = (await safeReaddir(sessionDir)).filter(isDayFile).sort();
    if (dayFiles.length > MAX_DAY_FILES) {
        for (const f of dayFiles.slice(0, dayFiles.length - MAX_DAY_FILES)) {
            try {
                await unlink(join(sessionDir, f));
            }
            catch { /* ok */ }
        }
    }
}
async function deleteSessionDir(sessionDir) {
    for (const f of await safeReaddir(sessionDir)) {
        try {
            await unlink(join(sessionDir, f));
        }
        catch { /* ok */ }
    }
    try {
        await rmdir(sessionDir);
    }
    catch { /* ok */ }
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
        }
        catch {
            /* not here, walk up */
        }
        const parent = dirname(current);
        if (parent === current)
            return null;
        current = parent;
    }
    return null;
}
function runGit(repoRoot, args) {
    return new Promise((resolveRun) => {
        execFile("git", ["-C", repoRoot, ...args], { timeout: 5000, encoding: "utf-8" }, (err, stdout, stderr) => {
            const code = err && typeof err.code === "number"
                ? (err.code)
                : err
                    ? 1
                    : 0;
            resolveRun({ stdout: String(stdout ?? ""), stderr: String(stderr ?? ""), code });
        });
    });
}
async function commitWorkspaceSkillFile(skillSlug, name, message) {
    const skillDir = ensureInside(WORKSPACE_SKILLS_DIR, join(WORKSPACE_SKILLS_DIR, skillSlug));
    const filePath = ensureInside(skillDir, join(skillDir, name));
    const repoRoot = await findGitRoot(dirname(filePath));
    if (!repoRoot)
        return { committed: false, reason: "not_a_git_repo" };
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
    const sha = rev.stdout.trim();
    return { committed: true, commit: sha };
}
function chatCacheMiddleware() {
    ensureCacheDir();
    const SESSIONS_FILE = join(CHAT_CACHE_DIR, "_sessions.json");
    return {
        name: "chat-cache-api",
        configureServer(server) {
            server.middlewares.use(async (incomingReq, res, next) => {
                const req = incomingReq;
                const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
                const pathname = url.pathname;
                if (!pathname.startsWith("/api/chat-cache/")) {
                    next();
                    return;
                }
                const sendJson = (statusCode, data) => {
                    const body = JSON.stringify(data);
                    res.writeHead(statusCode, {
                        "Content-Type": "application/json; charset=utf-8",
                        "Access-Control-Allow-Origin": "*",
                    });
                    res.end(body);
                };
                const readBody = () => new Promise((resolve, reject) => {
                    const parts = [];
                    req.on("data", (chunk) => parts.push(String(chunk)));
                    req.on("end", () => {
                        try {
                            const raw = parts.join("");
                            resolve(raw ? JSON.parse(raw) : {});
                        }
                        catch (err) {
                            reject(err);
                        }
                    });
                    req.on("error", (err) => reject(err));
                });
                try {
                    if (req.method === "OPTIONS") {
                        res.writeHead(204, {
                            "Access-Control-Allow-Origin": "*",
                            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                            "Access-Control-Allow-Headers": "Content-Type",
                        });
                        res.end();
                        return;
                    }
                    if (pathname === "/api/chat-cache/sessions" && req.method === "GET") {
                        const data = await readJsonFile(SESSIONS_FILE);
                        sendJson(200, { sessions: data?.sessions ?? [], cachedAt: data?.cachedAt ?? null });
                        return;
                    }
                    if (pathname === "/api/chat-cache/sessions" && req.method === "PUT") {
                        const body = await readBody();
                        await writeJsonFile(SESSIONS_FILE, { sessions: Array.isArray(body.sessions) ? body.sessions : [], cachedAt: Date.now() });
                        sendJson(200, { ok: true });
                        return;
                    }
                    if (pathname === "/api/chat-cache/messages" && req.method === "GET") {
                        const sessionKey = url.searchParams.get("sessionKey");
                        if (!sessionKey) {
                            sendJson(400, { error: "Missing sessionKey" });
                            return;
                        }
                        const sessionDir = join(CHAT_CACHE_DIR, safeSessionDirName(sessionKey));
                        const meta = await readJsonFile(join(sessionDir, "_meta.json"));
                        const messages = await readSessionMessages(sessionDir);
                        sendJson(200, { messages, sessionKey: meta?.sessionKey ?? sessionKey, agentId: meta?.agentId ?? null, cachedAt: meta?.cachedAt ?? null });
                        return;
                    }
                    if (pathname === "/api/chat-cache/messages" && req.method === "PUT") {
                        const body = await readBody();
                        const sessionKey = body.sessionKey;
                        if (!sessionKey) {
                            sendJson(400, { error: "Missing sessionKey" });
                            return;
                        }
                        const sessionDir = join(CHAT_CACHE_DIR, safeSessionDirName(sessionKey));
                        await writeSessionMessages(sessionDir, sessionKey, body.agentId ?? null, Array.isArray(body.messages) ? body.messages : []);
                        sendJson(200, { ok: true });
                        return;
                    }
                    if (pathname === "/api/chat-cache/all-messages" && req.method === "GET") {
                        const entries = await safeReaddir(CHAT_CACHE_DIR);
                        const result = [];
                        for (const entry of entries) {
                            if (entry.startsWith("_") || entry.endsWith(".json"))
                                continue;
                            const meta = await readJsonFile(join(CHAT_CACHE_DIR, entry, "_meta.json"));
                            if (meta?.sessionKey) {
                                result.push({ sessionKey: meta.sessionKey, agentId: meta.agentId ?? null, messageCount: meta.messageCount ?? 0, cachedAt: meta.cachedAt ?? null });
                            }
                        }
                        sendJson(200, { sessions: result });
                        return;
                    }
                    if (pathname === "/api/chat-cache/messages" && req.method === "DELETE") {
                        const sessionKey = url.searchParams.get("sessionKey");
                        if (!sessionKey) {
                            sendJson(400, { error: "Missing sessionKey" });
                            return;
                        }
                        await deleteSessionDir(join(CHAT_CACHE_DIR, safeSessionDirName(sessionKey)));
                        sendJson(200, { ok: true });
                        return;
                    }
                    next();
                }
                catch (err) {
                    sendJson(500, { error: String(err) });
                }
            });
        },
    };
}
function workspaceSkillsMiddleware() {
    return {
        name: "workspace-skills-api",
        configureServer(server) {
            server.middlewares.use(async (incomingReq, res, next) => {
                const req = incomingReq;
                const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
                const pathname = url.pathname;
                if (!pathname.startsWith("/api/workspace-skills/")) {
                    next();
                    return;
                }
                const sendJson = (statusCode, data) => {
                    const body = JSON.stringify(data);
                    res.writeHead(statusCode, {
                        "Content-Type": "application/json; charset=utf-8",
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                        "Access-Control-Allow-Headers": "Content-Type",
                    });
                    res.end(body);
                };
                const readBody = () => new Promise((resolvePromise, rejectPromise) => {
                    const parts = [];
                    req.on("data", (chunk) => parts.push(String(chunk)));
                    req.on("end", () => {
                        try {
                            const raw = parts.join("");
                            resolvePromise(raw ? JSON.parse(raw) : {});
                        }
                        catch (err) {
                            rejectPromise(err);
                        }
                    });
                    req.on("error", (err) => rejectPromise(err));
                });
                try {
                    if (req.method === "OPTIONS") {
                        res.writeHead(204, {
                            "Access-Control-Allow-Origin": "*",
                            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                            "Access-Control-Allow-Headers": "Content-Type",
                        });
                        res.end();
                        return;
                    }
                    if (req.method === "GET" && pathname === "/api/workspace-skills/list") {
                        const skillSlug = url.searchParams.get("slug");
                        if (!skillSlug) {
                            sendJson(400, { error: "Missing slug" });
                            return;
                        }
                        const files = await listWorkspaceSkillFiles(skillSlug);
                        sendJson(200, {
                            agentId: skillSlug,
                            workspace: "~/.openclaw/workspace/skills",
                            files,
                        });
                        return;
                    }
                    if (req.method === "GET" && pathname === "/api/workspace-skills/file") {
                        const skillSlug = url.searchParams.get("slug");
                        const name = url.searchParams.get("name");
                        if (!skillSlug || !name) {
                            sendJson(400, { error: "Missing slug or name" });
                            return;
                        }
                        const file = await readWorkspaceSkillFile(skillSlug, name);
                        sendJson(200, {
                            agentId: skillSlug,
                            workspace: "~/.openclaw/workspace/skills",
                            file,
                        });
                        return;
                    }
                    if (req.method === "POST" && pathname === "/api/workspace-skills/save") {
                        const body = await readBody();
                        const skillSlug = typeof body.slug === "string" ? body.slug : "";
                        const name = typeof body.name === "string" ? body.name : "";
                        const content = typeof body.content === "string" ? body.content : null;
                        if (!skillSlug || !name || content === null) {
                            sendJson(400, { error: "Missing slug, name or content" });
                            return;
                        }
                        const info = await writeWorkspaceSkillFile(skillSlug, name, content);
                        sendJson(200, { agentId: skillSlug, file: info });
                        return;
                    }
                    if (req.method === "POST" && pathname === "/api/workspace-skills/commit") {
                        const body = await readBody();
                        const skillSlug = typeof body.slug === "string" ? body.slug : "";
                        const name = typeof body.name === "string" ? body.name : "";
                        const message = typeof body.message === "string" && body.message.trim().length > 0
                            ? body.message
                            : `chore(skill): update ${skillSlug}/${name} via OpenClaw Office`;
                        if (!skillSlug || !name) {
                            sendJson(400, { error: "Missing slug or name" });
                            return;
                        }
                        const result = await commitWorkspaceSkillFile(skillSlug, name, message);
                        sendJson(200, result);
                        return;
                    }
                    next();
                }
                catch (error) {
                    sendJson(500, { error: String(error) });
                }
            });
        },
    };
}
export default defineConfig({
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [react(), tailwindcss(), chatCacheMiddleware(), workspaceSkillsMiddleware()],
    resolve: {
        alias: {
            "@": resolve(rootDir, "./src"),
        },
    },
    server: {
        port: 5180,
        proxy: {
            "/gateway-ws": {
                target: gatewayTarget,
                ws: true,
                changeOrigin: true,
                rewrite: () => gatewayPath,
                configure: (proxy) => {
                    proxy.on("error", () => { });
                    proxy.on("proxyReqWs", (_proxyReq, _req, socket) => {
                        socket.on("error", () => { });
                    });
                },
            },
            "/api/gateway/ws": {
                target: gatewayTarget,
                ws: true,
                changeOrigin: true,
                rewrite: () => gatewayPath,
                configure: (proxy) => {
                    proxy.on("error", () => { });
                    proxy.on("proxyReqWs", (_proxyReq, _req, socket) => {
                        socket.on("error", () => { });
                    });
                },
            },
        },
    },
});
