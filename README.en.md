# OpenClaw Office

> [中文文档](./README.md)

> Visualize AI agent collaboration as a real-time digital twin office.

**OpenClaw Office** is the visual monitoring and management frontend for the [OpenClaw](https://github.com/openclaw/openclaw) Multi-Agent system. It renders Agent work status, collaboration links, tool calls, and resource consumption through an isometric-style virtual office scene, along with a full-featured console for system management and a Chat workspace for real-time Agent conversations.

**Core Metaphor:** Agent = Digital Employee | Office = Agent Runtime | Desk = Session | Meeting Pod = Collaboration Context

---

## Feature Highlights

### ✨ Skill Workbench — Skills Development Platform

Skill Workbench is the core differentiator of OpenClaw Office — a full **AI-assisted development environment** that unifies skill creation, editing, flowchart generation, and A2UI input forms:

- **Nested three-page routing**: `/skill-workbench` (list) → `/skill-workbench/create` (wizard) → `/skill-workbench/:slug` (detail)
- **Chat-side-panel driven development**: create and modify Skills through a conversation; file changes are flushed to disk in real time
- **Automated FLOWCHART.md generation**: a built-in guard skill (`skill-workbench-mermaid-guard`) produces compliant, colored Mermaid flowcharts (single- or multi-chart mode) on demand
- **Pure-Markdown multi-chart preview**: the flowchart panel renders multiple Mermaid fenced blocks directly through the Markdown pipeline
- **A2UI visual input forms**: declarative form schema — ` ```a2ui ` fenced blocks inside chat messages are automatically rendered as interactive forms; a dedicated "A2UI Debug" tab on the detail page enables one-click generation, preview, and debugging
- **Zero-setup default skill install**: on first entry, the embedded server copies bundled default skills from the npm package into `~/.openclaw/workspace/skills/` — no manual install required

See the full guide in [SKILL-WORKBENCH.md](./SKILL-WORKBENCH.md).

![Workflow](./assets/Workflow.png)

![A2UI](./assets/A2UI.png)

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
- Persistent chat history — server-side per-day sharded cache, stable across browsers, devices, and refreshes
- Tool call visualization — inline Agent tool call status, collapsible for detail viewing
- Slash commands — `/help`, `/new`, `/reset`, `/model`, `/think`, `/export` and more
- Attachments — support for images and arbitrary file attachments
- Utilities — search, Markdown export, focus mode, pinned-reference workflows
- Dynamic form interaction (A2UI) — ` ```a2ui ` fenced blocks in AI responses are automatically rendered as structured forms supporting text, select, file upload and more; submissions are sent back to the Agent as structured messages

![chat-a2ui](./assets/chat-a2ui.png)

### Console

Full system management interface with dedicated pages:

| Page                  | Features                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Dashboard**         | Overview stats, alert banners, Channel/Skill overview, quick navigation                                        |
| **Agents**            | Agent list/create/delete, detail tabs (Overview, Channels, Cron, Skills, Tools, Files)                         |
| **Channels**          | Channel cards, configuration dialogs, stats, WhatsApp QR binding                                               |
| **Skills**            | Skill marketplace, install options, skill detail dialogs                                                       |
| **Skill Workbench** ✨ | Skills development platform (see detailed introduction above)                                                  |
| **Cron**              | Scheduled task management and statistics                                                                       |
| **Settings**          | Provider management (add/edit/model editor), appearance, Gateway, developer, advanced, about, update           |

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
- **[OpenClaw](https://github.com/openclaw/openclaw)** installed and running

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

### Gateway Authentication

After launching, the browser displays the OpenClaw Office **login screen**, where you need to enter your Gateway credentials to authenticate:

1. **Gateway URL** — the Gateway WebSocket address, defaults to `ws://localhost:18789` (pre-filled from the server-injected configuration)
2. **Access Token** — the Gateway authentication token (found in the OpenClaw config file `~/.openclaw/openclaw.json` under `gateway.auth.token`)
3. **Password** (optional) — Gateway password if password-based authentication is enabled

Fill in the fields and click **Connect** to enter the system.

> **Note:** For a local deployment without authentication enabled, leave the Gateway URL at its default and the Token field empty, then click **Connect** directly.

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

---

## Quick Start (from source)

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start the Gateway

Ensure the OpenClaw Gateway is running on the default address (`localhost:18789`). You can start it via:

- The OpenClaw macOS app
- `openclaw gateway run` CLI command
- Other deployment methods (see [OpenClaw documentation](https://github.com/openclaw/openclaw))

> **Tip:** No need to pre-configure an auth token — you will enter it on the login screen in your browser after launching.

### 3. Start the Dev Server

```bash
pnpm dev
```

Open `http://localhost:5180` in your browser and enter the Gateway Token on the login screen to connect.

If you need to connect to a non-default Gateway (e.g., a remote server), create a `.env.local` file (gitignored):

```bash
cat > .env.local << 'EOF'
VITE_GATEWAY_URL=ws://192.168.1.100:18789
EOF
```

### Environment Variables

| Variable                | Required | Default                | Description                                          |
| ----------------------- | -------- | ---------------------- | ---------------------------------------------------- |
| `VITE_GATEWAY_URL`      | No       | `ws://localhost:18789` | Gateway WebSocket address                            |
| `VITE_GATEWAY_WS_PATH`  | No       | `/gateway-ws`          | Browser-side reverse proxy WS path                   |
| `VITE_GATEWAY_TOKEN`    | No       | —                      | Pre-fill the login form Token (optional; auth happens at login) |
| `VITE_MOCK`             | No       | `false`                | Enable mock mode (no Gateway needed)                  |

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
- `sessions.list` is no longer used as a high-frequency real-time driver; it is used for immediate sync after connection and a **60-second** low-frequency reconciliation pass to recover from missed events and reconnect drift
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
