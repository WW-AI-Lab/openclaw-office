# OpenClaw Office

> [中文文档](./README.md)

> Visualize AI agent collaboration as a real-time digital twin office.

**OpenClaw Office** is the visual monitoring and management frontend for the [OpenClaw](https://github.com/openclaw/openclaw) Multi-Agent system. It renders Agent work status, collaboration links, tool calls, and resource consumption through an isometric-style virtual office scene, along with a full-featured console for system management and a Chat workspace for real-time Agent conversations.

**Core Metaphor:** Agent = Digital Employee | Office = Agent Runtime | Desk = Session | Meeting Pod = Collaboration Context

## SitioUno Fork Scope

This fork owns the graphical/product surface of OpenClaw Office: React UI, visual office, console, chat, assets, i18n, and frontend service scripts. GCP infrastructure, node runbooks, MCP routing, Zeus/Hermes, MiroFish, and the software factory live in their own repositories. See [SITIOUNO-REPO-MAP.md](SITIOUNO-REPO-MAP.md).

---

## Features

### Virtual Office

- **2D Floor Plan** — SVG-rendered isometric office with desk zones, hot desks, meeting areas, and rich furniture (desks, chairs, sofas, plants, coffee cups)
- **Agent Avatars** — Deterministically generated SVG avatars from agent IDs with real-time status animations (idle, working, speaking, tool calling, error)
- **Collaboration Lines** — Visual connections showing inter-Agent message flow
- **Speech Bubbles** — Live Markdown text streaming and tool call display
- **Side Panels** — Agent details, Token line charts, cost pie charts, activity heatmaps, SubAgent relationship graphs, event timelines

![office](./assets/office.png)

### Chat Workspace

- Dedicated Chat workspace accessible via top navigation (`/#/chat`), with the dock bar retained as a quick-entry surface
- Session management — create new sessions, switch history, route by Agent, support multi-Agent parallel conversations
- Real-time streaming — stream AI responses with abort/resend support
- Persistent chat history — server-side per-day sharded cache (`~/.openclaw/office-cache/chat/`), stable across browsers, devices, and refreshes
- Tool call visualization — inline Agent tool call status (calling/completed), collapsible for detail viewing
- Slash commands — `/help`, `/new`, `/reset`, `/model`, `/think`, `/export` and more
- Attachments — support for images and arbitrary file attachments
- Utilities — search, Markdown export, focus mode, pinned-reference workflows

### Console

Full system management interface with dedicated pages:

| Page          | Features                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| **Dashboard** | Overview stats, alert banners, Channel/Skill overview, quick navigation                                        |
| **Agents**    | Agent list/create/delete, detail tabs (Overview, Channels, Cron, Skills, Tools, Files)                         |
| **Channels**  | Channel cards, configuration dialogs, stats, WhatsApp QR binding                                               |
| **Skills**    | Skill marketplace, install options, skill detail dialogs                                                       |
| **Cron**      | Scheduled task management and statistics                                                                       |
| **Settings**  | Provider management (add/edit/model editor), appearance, Gateway, developer, advanced, about, update            |

![console-dashboard](./assets/console-dashboard.png)

![console-agent](./assets/console-agent.png)

![console-setting](./assets/console-setting.png)

### Other

- **i18n** — Full Chinese/English bilingual support with runtime language switching
- **Mock Mode** — Develop without a live Gateway connection
- **Responsive** — Mobile-optimized with automatic 2D fallback

---

## Tech Stack

| Layer            | Technology                                      |
| ---------------- | ----------------------------------------------- |
| Build Tool       | Vite 6                                          |
| UI Framework     | React 19                                        |
| 2D Rendering     | SVG + CSS Animations                            |
| State Management | Zustand 5 + Immer                               |
| Styling          | Tailwind CSS 4                                  |
| Routing          | React Router 7                                  |
| Charts           | Recharts                                        |
| i18n             | i18next + react-i18next                         |
| Real-time        | Native WebSocket (connects to OpenClaw Gateway) |

---

## Prerequisites

- **Node.js 22+**
- **pnpm** (package manager)
- **[OpenClaw](https://github.com/openclaw/openclaw)** installed and configured

OpenClaw Office is a companion frontend that connects to a running OpenClaw Gateway. It does **not** start or manage the Gateway itself.

---

## Quick Launch

The fastest way to run OpenClaw Office — no cloning required:

```bash
# Run directly (one-time)
npx @ww-ai-lab/openclaw-office

# Or install globally
npm install -g @ww-ai-lab/openclaw-office
openclaw-office
```

### Gateway Token Auto-Detection

If [OpenClaw](https://github.com/openclaw/openclaw) is installed locally, the Gateway auth token is **automatically detected** from `~/.openclaw/openclaw.json` — no manual configuration needed.

You can also provide the token explicitly:

```bash
openclaw-office --token <your-gateway-token>
# or via environment variable
OPENCLAW_GATEWAY_TOKEN=<token> openclaw-office
```

### CLI Options

| Flag                  | Description           | Default                |
| --------------------- | --------------------- | ---------------------- |
| `-t, --token <token>` | Gateway auth token    | auto-detected          |
| `-g, --gateway <url>` | Gateway WebSocket URL | `ws://localhost:18789` |
| `-p, --port <port>`   | Server port           | `5180`                 |
| `--host <host>`       | Bind address          | `0.0.0.0`              |
| `-h, --help`          | Show help             | —                      |

> **Note:** This serves the pre-built production bundle. For development with hot reload, see [Development](#development) below.

---

## Install as a System Service (Background Mode)

Register OpenClaw Office as a system service so it starts automatically on boot/login — no manual command needed. Supported on macOS (launchd) and Linux (systemd --user).

### Install the Service

```bash
# Install as system service (token auto-detected, or specify manually)
openclaw-office service install

# Specify token and port
openclaw-office service install --token <your-token> --port 3000
```

Once installed, the service **starts immediately** and runs in the background. It will be automatically launched on every subsequent boot/login.

### Service Management Commands

```bash
openclaw-office service status              # Check service status
openclaw-office service stop                # Stop the service
openclaw-office service start               # Start the service
openclaw-office service restart             # Restart the service
openclaw-office service log                 # Show service logs
openclaw-office service log --follow        # Follow log output in real time
openclaw-office service uninstall           # Remove the system service
```

> **Tip:** After installing as a service, you can also view Gateway status and perform operations like restart from the Settings page "Service Management" panel.

---

## Windows (WSL2) One-Click Launch

> **Requirements:** Windows 10 21H2 / Windows 11 with WSL2 enabled, and a Linux distribution (e.g., Ubuntu).

For Windows users, OpenClaw Office provides a WSL2-based one-click deployment — no manual WSL dependency setup required:

**Double-click `start-openclaw-office.cmd`** — it handles everything automatically:

1. **Auto-detects** your WSL distribution (skips docker-desktop)
2. **Auto-installs** Node.js 22+ and OpenClaw in WSL (if not already installed)
3. **Initializes** OpenClaw Gateway config (auto-generates token on first run)
4. **Starts the Gateway** service in WSL via systemd
5. **Starts the Office Server** natively in Windows via Node.js
6. **Opens the browser** at `http://127.0.0.1:5180`

You can also invoke the PowerShell script directly with custom options:

```powershell
# Specify OpenClaw version and ports
.\scripts\start-openclaw-office.ps1 -OpenClawVersion "2026.3.28" -OfficePort 5180 -GatewayPort 18789

# Use a specific WSL distribution
.\scripts\start-openclaw-office.ps1 -Distro "Ubuntu-22.04"
```

| Parameter          | Description                                      | Default       |
| ------------------ | ------------------------------------------------ | ------------- |
| `-Distro`          | WSL distribution name (empty = auto-detect)      | `""` (auto)   |
| `-OpenClawVersion` | OpenClaw version to install                      | `2026.3.28`   |
| `-OfficePort`      | Office Server port                               | `5180`        |
| `-GatewayPort`     | Gateway port                                     | `18789`       |

> **Note:** Runtime logs and PID files are stored in the `.runtime/` directory at the repository root, which is already listed in `.gitignore`.

---

## Quick Start (from source)

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Gateway Connection

Create a `.env.local` file (gitignored) with your Gateway connection details:

```bash
cat > .env.local << 'EOF'
VITE_GATEWAY_URL=ws://localhost:18789
VITE_GATEWAY_TOKEN=<your-gateway-token>
EOF
```

Get your Gateway token:

```bash
openclaw config get gateway.auth.token
```

### 3. Start the Gateway

Ensure the OpenClaw Gateway is running on the configured address (default `localhost:18789`). You can start it via:

- The OpenClaw macOS app
- `openclaw gateway run` CLI command
- Other deployment methods (see [OpenClaw documentation](https://github.com/openclaw/openclaw))

### 4. Start the Dev Server

```bash
pnpm dev
```

Open `http://localhost:5180` in your browser.

### Environment Variables

| Variable                | Required                              | Default                | Description                          |
| ----------------------- | ------------------------------------- | ---------------------- | ------------------------------------ |
| `VITE_GATEWAY_URL`      | No                                    | `ws://localhost:18789` | Gateway WebSocket address            |
| `VITE_GATEWAY_WS_PATH`  | No                                    | `/gateway-ws`          | Browser-side reverse proxy WS path   |
| `VITE_GATEWAY_TOKEN`    | Yes (when connecting to real Gateway) | —                      | Gateway auth token                   |
| `VITE_MOCK`             | No                                    | `false`                | Enable mock mode (no Gateway needed) |

### Mock Mode (No Gateway)

To develop without a running Gateway, enable mock mode:

```bash
VITE_MOCK=true pnpm dev
```

This uses simulated Agent data for UI development.

---

## Development

### Commands

```bash
pnpm install              # Install dependencies
pnpm dev                  # Start dev server (port 5180)
pnpm build                # Production build
pnpm test                 # Run tests
pnpm test:watch           # Test watch mode
pnpm typecheck            # TypeScript type check
pnpm lint                 # Oxlint linting
pnpm format               # Oxfmt formatting
pnpm check                # lint + format check
```

### Architecture

OpenClaw Office connects to the Gateway via WebSocket and follows this data flow:

```
OpenClaw Gateway  ──WebSocket──>  ws-client.ts  ──>  event-parser.ts  ──>  Zustand Store  ──>  React Components
     │                                                                          │
     └── RPC (agents.list, chat.send, ...)  ──>  rpc-client.ts  ──────────────>─┘
```

The Gateway broadcasts real-time events (`agent`, `presence`, `health`, `heartbeat`) and responds to RPC requests. The frontend maps Agent lifecycle events to visual states (idle, working, speaking, tool_calling, error) and renders them in the office scene.

### Session Synchronization Strategy

- Real-time Agent and SubAgent state, 2D office walking animation, and meeting-zone movement are driven directly by WebSocket `agent` events
- `sessions.list` is no longer used as a high-frequency real-time driver; it is used for immediate sync after connection and a **60-second** low-frequency reconciliation pass to recover from missed events and reconnect drift, while reusing the same response for token aggregation
- This strategy reduces Gateway CPU pressure and avoids letting high-frequency full-session scans interfere with other RPC probes

---

## Contributing

Contributions are welcome! Whether it's new visualization effects, console features, or performance optimizations.

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/cool-effect`)
3. Commit your changes (use [Conventional Commits](https://www.conventionalcommits.org/))
4. Open a Pull Request

---

## License

[MIT](./LICENSE)
