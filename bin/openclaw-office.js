#!/usr/bin/env node

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { readFile, access } from "node:fs/promises";
import { resolve, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces, homedir } from "node:os";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const distDir = resolve(__dirname, "..", "dist");

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
});
const configScript = `<script>window.__OPENCLAW_CONFIG__=${runtimeConfig};</script>`;

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

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

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
