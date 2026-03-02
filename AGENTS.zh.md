# OpenClaw Office — Agent 开发指南

> [English](./AGENTS.md)

本文档为 AI 编码助手（Codex、Claude、Cursor Agent 等）提供项目开发的上下文和规则。

## 项目概述

OpenClaw Office 是 [OpenClaw](https://github.com/openclaw/openclaw) Multi-Agent 系统的可视化监控与管理前端。它通过 WebSocket 连接 OpenClaw Gateway，将 Agent 协作具象化为"数字办公室"，同时提供完整的控制台管理界面。

## 技术栈

| 类别     | 技术                                        |
| -------- | ------------------------------------------- |
| 语言     | TypeScript (ESM, strict mode)               |
| UI 框架  | React 19                                    |
| 构建工具 | Vite 6                                      |
| 状态管理 | Zustand 5 + Immer                           |
| 样式     | Tailwind CSS 4                              |
| 2D 渲染  | SVG + CSS Animations                        |
| 3D 渲染  | React Three Fiber (R3F) + @react-three/drei |
| 路由     | React Router 7                              |
| 图表     | Recharts                                    |
| 国际化   | i18next + react-i18next                     |
| 测试     | Vitest + @testing-library/react             |
| 实时通信 | 原生 WebSocket API                          |

## 功能模块

### Office 视图（`/`）

等距风格的 2D/3D 虚拟办公室，实时展示 Agent 工作状态：

- **2D 平面图** — SVG 渲染的办公室场景，含工位、家具（桌椅/沙发/植物/咖啡杯）、Agent 头像和状态动画
- **3D 场景** — R3F 渲染的 3D 办公室，含角色模型、技能全息面板、传送门特效
- **Agent 头像** — 基于 agentId 确定性生成的 SVG 头像，支持状态指示（idle/working/speaking/error）
- **协作连线** — Agent 间的消息传递可视化
- **气泡面板** — Markdown 文本流、工具调用展示
- **右侧面板** — Agent 详情、指标图表（Token 折线图/成本饼图/活跃热力图）、子 Agent 关系图、事件时间轴

### Chat 功能

底部停靠的聊天栏，支持与 Agent 实时对话：

- Agent 选择器、流式消息展示、Markdown 渲染
- 聊天历史抽屉、发送/中止控制

### 控制台（`/dashboard`、`/agents`、`/channels`、`/skills`、`/cron`、`/settings`）

完整的系统管理界面：

- **Dashboard** — 概览统计卡片、告警横幅、Channel/Skill 概览、快捷导航
- **Agents** — Agent 列表/创建/删除，详情多 Tab（Overview/Channels/Cron/Skills/Tools/Files）
- **Channels** — 渠道卡片、配置对话框、统计、WhatsApp QR 绑定流程
- **Skills** — 技能市场、安装选项、技能详情
- **Cron** — 定时任务管理、统计栏
- **Settings** — Provider 管理（添加/编辑/模型编辑器）、外观/Gateway/开发者/高级/关于/更新

## 目录结构

```
src/
├── main.tsx / App.tsx          # 入口与路由
├── i18n/                       # 国际化（zh/en 双语）
├── gateway/                    # Gateway 通信层
│   ├── ws-client.ts / ws-adapter.ts  # WebSocket 客户端 + 认证 + 重连
│   ├── rpc-client.ts           # RPC 请求封装
│   ├── event-parser.ts         # 事件解析 + 状态映射
│   ├── adapter.ts / adapter-provider.ts  # 适配器模式（真实/Mock 切换）
│   └── mock-adapter.ts         # Mock 模式适配器
├── store/                      # Zustand Store
│   ├── office-store.ts         # 主 Store（Agent 状态、连接、UI）
│   ├── agent-reducer.ts / metrics-reducer.ts / meeting-manager.ts
│   └── console-stores/         # 控制台各页面 Store
│       ├── agents-store.ts / channels-store.ts / skills-store.ts
│       ├── cron-store.ts / dashboard-store.ts / settings-store.ts
│       ├── chat-dock-store.ts / config-store.ts
│       └── ...
├── components/
│   ├── layout/                 # AppShell / ConsoleLayout / Sidebar / TopBar
│   ├── office-2d/              # 2D SVG 平面图 + 家具组件
│   ├── office-3d/              # 3D R3F 场景
│   ├── overlays/               # SpeechBubble 等 HTML Overlay
│   ├── panels/                 # 详情/指标/图表面板
│   ├── chat/                   # Chat 停靠栏组件
│   ├── console/                # 控制台各功能页组件
│   │   ├── dashboard/ / agents/ / channels/
│   │   ├── skills/ / cron/ / settings/ / shared/
│   │   └── ...
│   ├── pages/                  # 控制台路由页面
│   └── shared/                 # 公共组件（Avatar/LanguageSwitcher 等）
├── hooks/                      # 自定义 Hooks
├── lib/                        # 工具函数库
└── styles/                     # 全局样式
```

## 开发命令

```bash
pnpm install              # 安装依赖
pnpm dev                  # 启动开发服务器 (port 5180)
pnpm build                # 构建生产版本
pnpm test                 # 运行测试
pnpm test:watch           # 测试 watch 模式
pnpm typecheck            # TypeScript 类型检查
pnpm lint                 # Oxlint 检查
pnpm format               # Oxfmt 格式化
pnpm check                # lint + format 检查
```

## 编码规范

- TypeScript strict 模式，**不用 `any`**
- 文件不超过 500 行，超过则拆分
- 组件命名 PascalCase，hook 命名 useCamelCase
- 使用 Oxlint + Oxfmt 规范
- 注释仅用于解释非显而易见的逻辑

## OpenClaw Gateway 集成

### 连接与认证

前端通过 WebSocket 连接 Gateway（默认 `ws://localhost:18789`），以 `openclaw-control-ui` 身份认证，请求 `operator.admin` scope。

**认证前提配置：**

1. **Gateway Token** — 写入 `.env.local`（在 `.gitignore` 中）：

   ```bash
   openclaw config get gateway.auth.token
   # 将 token 写入 .env.local 的 VITE_GATEWAY_TOKEN
   ```

2. **Device Auth Bypass** — Gateway 2026.2.15+ 要求 device identity，Web 端需 bypass：

   ```bash
   openclaw config set gateway.controlUi.dangerouslyDisableDeviceAuth true
   # 需重启 Gateway
   ```

3. **确保 Gateway 运行** — 本项目不负责启动 Gateway

### 认证流程

1. WebSocket 连接 → Gateway 发送 `connect.challenge`（含 nonce）
2. 前端发送 `connect`（含 client.id、scopes、auth.token）
3. Gateway 验证后返回 `hello-ok`

### 事件与 RPC

**实时事件：** `agent`（生命周期/工具/文本/错误）、`presence`、`health`、`heartbeat`

**RPC 方法：** `agents.list`、`sessions.list`、`usage.status`、`tools.catalog`、`chat.send`、`chat.abort`、`chat.history`

### Agent 事件 Payload

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

### Chat 协议

| 方法/事件      | 方向  | 说明                                                        |
| -------------- | ----- | ----------------------------------------------------------- |
| `chat.send`    | RPC   | 发送消息 `{ sessionKey, message, deliver, idempotencyKey }` |
| `chat.abort`   | RPC   | 中止当前 run `{ sessionKey }`                               |
| `chat.history` | RPC   | 获取历史 `{ sessionKey }`                                   |
| `chat`         | Event | 流式事件，state: `delta` / `final` / `error` / `aborted`    |

## Agent 状态映射

| Gateway stream | data 关键字段    | 前端状态       | 视觉表现      |
| -------------- | ---------------- | -------------- | ------------- |
| `lifecycle`    | `phase: "start"` | `working`      | 加载动画      |
| `lifecycle`    | `phase: "end"`   | `idle`         | 休闲状态      |
| `tool`         | `name: "xxx"`    | `tool_calling` | 工具面板弹出  |
| `assistant`    | `text: "..."`    | `speaking`     | Markdown 气泡 |
| `error`        | `message: "..."` | `error`        | 红色叹号      |

## 国际化（i18n）

**所有用户可见的文本必须通过 i18n 翻译。**

- 命名空间：`common`、`layout`、`office`、`panels`、`chat`、`console`
- React 组件用 `useTranslation(ns)` + `t("key")`
- 非 React 文件用 `import i18n from "@/i18n"; i18n.t("ns:key")`
- 中英文 JSON 必须保持 key 结构一致
- 不由 i18n 管理：技术标识符、CSS 类名、import 路径

## Mock 模式

`VITE_MOCK=true` 可在不连接 Gateway 的情况下使用模拟数据开发。

## 测试要求

- `store/` 和 `gateway/event-parser.ts` **必须**有单元测试
- 组件使用 `@testing-library/react` 测试关键交互
- 关键数据流必须有测试

## Git 约定

- Conventional Commits 格式（中英均可）
- 不提交 `.env` 文件、`node_modules`、`dist` 目录

## 关键参考文件（OpenClaw 主项目）

以下文件位于 OpenClaw 主仓库，包含 Gateway 协议和类型的权威定义：

- `src/infra/agent-events.ts` — AgentEventPayload 类型
- `src/gateway/protocol/schema/frames.ts` — WS 帧格式
- `src/gateway/server/ws-connection.ts` — WS 认证流程
- `src/gateway/server-methods-list.ts` — 所有 Gateway 事件/方法名
- `src/config/types.agents.ts` — Agent 配置类型
