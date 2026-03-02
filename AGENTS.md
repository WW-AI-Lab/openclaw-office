# OpenClaw Office — Agent Development Guide

> [中文版](./AGENTS.zh.md)

This document provides context and rules for AI coding assistants (Codex, Claude, Cursor Agent, etc.) working on this project.

## Project Overview

OpenClaw Office is the visual monitoring and management frontend for the [OpenClaw](https://github.com/openclaw/openclaw) Multi-Agent system. It connects to the OpenClaw Gateway via WebSocket to visualize Agent collaboration as a "digital office" and provides a full console management interface.

## Tech Stack

| Category         | Technology                                  |
| ---------------- | ------------------------------------------- |
| Language         | TypeScript (ESM, strict mode)               |
| UI Framework     | React 19                                    |
| Build Tool       | Vite 6                                      |
| State Management | Zustand 5 + Immer                           |
| Styling          | Tailwind CSS 4                              |
| 2D Rendering     | SVG + CSS Animations                        |
| 3D Rendering     | React Three Fiber (R3F) + @react-three/drei |
| Routing          | React Router 7                              |
| Charts           | Recharts                                    |
| i18n             | i18next + react-i18next                     |
| Testing          | Vitest + @testing-library/react             |
| Real-time        | Native WebSocket API                        |

## Feature Modules

### Office View (`/`)

Isometric-style 2D/3D virtual office for real-time Agent status visualization:

- **2D Floor Plan** — SVG office scene with desks, furniture (desk/chair/sofa/plant/coffee cup), Agent avatars, and status animations
- **3D Scene** — R3F-rendered 3D office with character models, skill holograms, spawn portal effects
- **Agent Avatars** — Deterministically generated SVG avatars from agentId with status indicators (idle/working/speaking/error)
- **Collaboration Lines** — Visual connections for inter-Agent messaging
- **Bubble Panels** — Markdown text stream and tool call display
- **Side Panels** — Agent details, metrics charts (Token line chart/cost pie chart/activity heatmap), SubAgent graphs, event timeline

### Chat

Bottom-docked chat bar for real-time Agent conversations:

- Agent selector, streaming message display, Markdown rendering
- Chat history drawer, send/abort controls

### Console (`/dashboard`, `/agents`, `/channels`, `/skills`, `/cron`, `/settings`)

Full system management interface:

- **Dashboard** — Overview stat cards, alert banners, Channel/Skill overview, quick navigation
- **Agents** — Agent list/create/delete, detail tabs (Overview/Channels/Cron/Skills/Tools/Files)
- **Channels** — Channel cards, config dialogs, stats, WhatsApp QR binding flow
- **Skills** — Skill marketplace, install options, skill details
- **Cron** — Scheduled task management and stats bar
- **Settings** — Provider management (add/edit/model editor), appearance/Gateway/developer/advanced/about/update

## Directory Structure

```
src/
├── main.tsx / App.tsx          # Entry point and routing
├── i18n/                       # Internationalization (zh/en)
├── gateway/                    # Gateway communication layer
│   ├── ws-client.ts / ws-adapter.ts  # WebSocket client + auth + reconnect
│   ├── rpc-client.ts           # RPC request wrapper
│   ├── event-parser.ts         # Event parsing + state mapping
│   ├── adapter.ts / adapter-provider.ts  # Adapter pattern (real/mock switch)
│   └── mock-adapter.ts         # Mock mode adapter
├── store/                      # Zustand stores
│   ├── office-store.ts         # Main store (Agent state, connection, UI)
│   ├── agent-reducer.ts / metrics-reducer.ts / meeting-manager.ts
│   └── console-stores/         # Per-page console stores
├── components/
│   ├── layout/                 # AppShell / ConsoleLayout / Sidebar / TopBar
│   ├── office-2d/              # 2D SVG floor plan + furniture components
│   ├── office-3d/              # 3D R3F scene
│   ├── overlays/               # SpeechBubble and other HTML overlays
│   ├── panels/                 # Detail/metrics/chart panels
│   ├── chat/                   # Chat dock bar components
│   ├── console/                # Console feature page components
│   │   ├── dashboard/ / agents/ / channels/
│   │   ├── skills/ / cron/ / settings/ / shared/
│   │   └── ...
│   ├── pages/                  # Console route pages
│   └── shared/                 # Shared components (Avatar/LanguageSwitcher etc.)
├── hooks/                      # Custom React hooks
├── lib/                        # Utility library
└── styles/                     # Global styles
```

## Development Commands

```bash
pnpm install              # Install dependencies
pnpm dev                  # Start dev server (port 5180)
pnpm build                # Production build
pnpm test                 # Run tests
pnpm test:watch           # Test watch mode
pnpm typecheck            # TypeScript type check
pnpm lint                 # Oxlint check
pnpm format               # Oxfmt format
pnpm check                # lint + format check
```

## Coding Standards

- TypeScript strict mode; **no `any`**
- Files must not exceed 500 lines; split when longer
- Components: PascalCase; hooks: useCamelCase
- Oxlint + Oxfmt formatting (consistent with OpenClaw main project)
- Comments only for non-obvious logic

## OpenClaw Gateway Integration

### Connection & Authentication

The frontend connects to Gateway via WebSocket (default `ws://localhost:18789`), authenticating as `openclaw-control-ui` and requesting `operator.admin` scope.

**Prerequisites:**

1. **Gateway Token** — Write to `.env.local` (gitignored):

   ```bash
   openclaw config get gateway.auth.token
   # Write token to VITE_GATEWAY_TOKEN in .env.local
   ```

2. **Device Auth Bypass** — Gateway 2026.2.15+ requires device identity; web clients need bypass:

   ```bash
   openclaw config set gateway.controlUi.dangerouslyDisableDeviceAuth true
   # Restart Gateway after this
   ```

3. **Ensure Gateway is running** — This project does not start/stop Gateway

### Auth Flow

1. WebSocket connect → Gateway sends `connect.challenge` (with nonce)
2. Frontend sends `connect` (with client.id, scopes, auth.token)
3. Gateway validates and returns `hello-ok`

### Events & RPC

**Real-time events:** `agent` (lifecycle/tool/text/error), `presence`, `health`, `heartbeat`

**RPC methods:** `agents.list`, `sessions.list`, `usage.status`, `tools.catalog`, `chat.send`, `chat.abort`, `chat.history`

### Agent Event Payload

```typescript
type AgentEventPayload = {
  runId: string;
  seq: number;
  stream: "lifecycle" | "tool" | "assistant" | "error";
  ts: number;
  data: Record<string, unknown>;
  sessionKey?: string;
};
```

### Chat Protocol

| Method/Event   | Direction | Description                                                     |
| -------------- | --------- | --------------------------------------------------------------- |
| `chat.send`    | RPC       | Send message `{ sessionKey, message, deliver, idempotencyKey }` |
| `chat.abort`   | RPC       | Abort current run `{ sessionKey }`                              |
| `chat.history` | RPC       | Get history `{ sessionKey }`                                    |
| `chat`         | Event     | Streaming event, state: `delta` / `final` / `error` / `aborted` |

## Agent State Mapping

| Gateway stream | Key data field   | Frontend state | Visual            |
| -------------- | ---------------- | -------------- | ----------------- |
| `lifecycle`    | `phase: "start"` | `working`      | Loading animation |
| `lifecycle`    | `phase: "end"`   | `idle`         | Idle state        |
| `tool`         | `name: "xxx"`    | `tool_calling` | Tool panel popup  |
| `assistant`    | `text: "..."`    | `speaking`     | Markdown bubble   |
| `error`        | `message: "..."` | `error`        | Red exclamation   |

## Internationalization (i18n)

**All user-visible text must go through i18n translation.**

- Namespaces: `common`, `layout`, `office`, `panels`, `chat`, `console`
- React components: `useTranslation(ns)` + `t("key")`
- Non-React files: `import i18n from "@/i18n"; i18n.t("ns:key")`
- zh/en JSON files must have identical key structure
- Not managed by i18n: technical identifiers, CSS class names, import paths

## Mock Mode

Set `VITE_MOCK=true` to develop with simulated data without connecting to Gateway.

## Testing Requirements

- `store/` and `gateway/event-parser.ts` **must** have unit tests
- Components: test key interactions with `@testing-library/react`
- Critical data flows must be tested

## Git Conventions

- Conventional Commits format
- Do not commit `.env` files, `node_modules`, or `dist`

## Key Reference Files (OpenClaw Main Repo)

The following files in the OpenClaw main repository contain authoritative Gateway protocol and type definitions:

- `src/infra/agent-events.ts` — AgentEventPayload types
- `src/gateway/protocol/schema/frames.ts` — WS frame format
- `src/gateway/server/ws-connection.ts` — WS auth flow
- `src/gateway/server-methods-list.ts` — All Gateway events/methods
- `src/config/types.agents.ts` — Agent config types
