# OpenClaw Office

> [English](./README.en.md)

> 将 AI 智能体的协作逻辑具象化为实时的数字孪生办公室。

**OpenClaw Office** 是 [OpenClaw](https://github.com/openclaw/openclaw) Multi-Agent 系统的可视化监控与管理前端。它通过等距投影（Isometric）风格的虚拟办公室场景，实时展示 Agent 的工作状态、协作链路、工具调用和资源消耗，同时提供完整的控制台管理界面和 Chat 对话工作区。

**核心隐喻：** Agent = 数字员工 | 办公室 = Agent 运行时 | 工位 = Session | 会议室 = 协作上下文

---

## 功能概览

### 虚拟办公室

- **2D 平面图** — SVG 渲染的等距办公室场景，包含工位区、临时工位、会议区和丰富的家具（桌椅/沙发/植物/咖啡杯）
- **Agent 头像** — 基于 agentId 确定性生成的 SVG 头像，支持实时状态动画（空闲/工作中/发言/工具调用/错误）
- **协作连线** — Agent 间消息传递的可视化连接
- **气泡面板** — 实时 Markdown 文本流和工具调用展示
- **侧边面板** — Agent 详情、Token 折线图、成本饼图、活跃热力图、子 Agent 关系图、事件时间轴

![office](./assets/office.png)

### Chat 对话工作区

- 顶部导航可直达的独立 Chat 工作区（`/#/chat`），底部停靠栏保留为快捷入口
- 会话管理 — 创建新会话、切换历史会话、按 Agent 路由，支持多 Agent 并行对话
- 实时流式转录 — 流式展示 AI 回复，支持中止/重发
- 聊天历史持久化 — 服务端按天分片缓存聊天记录（`~/.openclaw/office-cache/chat/`），跨浏览器/设备/刷新稳定可见
- 工具调用可视化 — 在对话流中嵌入 Agent 工具调用状态（调用中/已完成），可折叠查看
- 斜杠命令 — `/help`、`/new`、`/reset`、`/model`、`/think`、`/export` 等快捷指令
- 附件支持 — 支持图片及任意文件附件
- 辅助功能 — 搜索、导出 Markdown、专注模式、消息置顶引用

### 控制台

完整的系统管理界面：

| 页面          | 功能                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Dashboard** | 概览统计卡片、告警横幅、Channel/Skill 概览、快捷导航                                                                 |
| **Agents**    | Agent 列表/创建/删除，详情多 Tab（Overview/Channels/Cron/Skills/Tools/Files）                                        |
| **Channels**  | 渠道卡片、配置对话框、统计、WhatsApp QR 绑定流程                                                                     |
| **Skills**    | 技能市场、安装选项、技能详情                                                                                         |
| **Cron**      | 定时任务管理和统计                                                                                                   |
| **Settings**  | Provider 管理（添加/编辑/模型编辑器）、外观/Gateway/开发者/高级/关于/更新                                            |

![console-dashboard](./assets/console-dashboard.png)

![console-agent](./assets/console-agent.png)

![console-setting](./assets/console-setting.png)

### 其他特性

- **国际化** — 完整的中英文双语支持，运行时语言切换
- **Mock 模式** — 无需连接 Gateway 即可开发
- **响应式** — 移动端优化，自动切换 2D 模式

---

## 技术栈

| 层       | 技术                                        |
| -------- | ------------------------------------------- |
| 构建工具 | Vite 6                                      |
| UI 框架  | React 19                                    |
| 2D 渲染  | SVG + CSS Animations                        |
| 状态管理 | Zustand 5 + Immer                           |
| 样式     | Tailwind CSS 4                              |
| 路由     | React Router 7                              |
| 图表     | Recharts                                    |
| 国际化   | i18next + react-i18next                     |
| 实时通信 | 原生 WebSocket（对接 OpenClaw Gateway）     |

---

## 前提条件

- **Node.js 22+**
- **pnpm**（包管理器）
- **[OpenClaw](https://github.com/openclaw/openclaw)** 已安装并配置

OpenClaw Office 是一个配套前端，连接到正在运行的 OpenClaw Gateway。它**不会**启动或管理 Gateway。

---

## 快捷启动

无需克隆仓库，最快速的运行方式：

```bash
# 直接运行（一次性使用）
npx @ww-ai-lab/openclaw-office

# 或全局安装
npm install -g @ww-ai-lab/openclaw-office
openclaw-office
```

### Gateway Token 自动检测

如果本地已安装 [OpenClaw](https://github.com/openclaw/openclaw)，Gateway 认证 token 会从 `~/.openclaw/openclaw.json` **自动读取**，无需手动配置。

也可以手动指定 token：

```bash
openclaw-office --token <你的-gateway-token>
# 或通过环境变量
OPENCLAW_GATEWAY_TOKEN=<token> openclaw-office
```

### CLI 参数

| 参数                  | 说明                   | 默认值                 |
| --------------------- | ---------------------- | ---------------------- |
| `-t, --token <token>` | Gateway 认证 token     | 自动检测               |
| `-g, --gateway <url>` | Gateway WebSocket 地址 | `ws://localhost:18789` |
| `-p, --port <port>`   | 服务端口               | `5180`                 |
| `--host <host>`       | 绑定地址               | `0.0.0.0`              |
| `-h, --help`          | 显示帮助               | —                      |

> **说明：** 此方式运行的是预构建的生产版本。如需热重载开发，请参见下方 [开发](#开发) 部分。

---

## 快速开始（从源码）

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置 Gateway 连接

创建 `.env.local` 文件（已在 `.gitignore` 中，不会被提交），填入 Gateway 连接信息：

```bash
cat > .env.local << 'EOF'
VITE_GATEWAY_URL=ws://localhost:18789
VITE_GATEWAY_TOKEN=<你的 gateway token>
EOF
```

获取 Gateway token：

```bash
openclaw config get gateway.auth.token
```

### 3. 启动 Gateway

确保 OpenClaw Gateway 在配置的地址上运行（默认 `localhost:18789`）。可通过以下方式启动：

- OpenClaw macOS 应用
- `openclaw gateway run` CLI 命令
- 其他部署方式（参见 [OpenClaw 文档](https://github.com/openclaw/openclaw)）

### 4. 启动开发服务器

```bash
pnpm dev
```

在浏览器中打开 `http://localhost:5180`。

### 环境变量

| 变量                    | 必须                      | 默认值                 | 说明                             |
| ----------------------- | ------------------------- | ---------------------- | -------------------------------- |
| `VITE_GATEWAY_URL`      | 否                        | `ws://localhost:18789` | Gateway WebSocket 地址           |
| `VITE_GATEWAY_WS_PATH`  | 否                        | `/gateway-ws`          | 浏览器侧反向代理 WS 路径        |
| `VITE_GATEWAY_TOKEN`    | 是（连接真实 Gateway 时） | —                      | Gateway 认证 token               |
| `VITE_MOCK`             | 否                        | `false`                | 启用 Mock 模式（不需要 Gateway） |

### Mock 模式（无需 Gateway）

如需在没有运行中的 Gateway 的情况下开发，启用 Mock 模式：

```bash
VITE_MOCK=true pnpm dev
```

这会使用模拟的 Agent 数据进行 UI 开发。

In the current bootstrap, mock mode also loads the framework-generated projection packet sample and seeds the office scene plus the first-batch projection panels from that packet. This is still a mock/dev path only; it does not change the live Gateway contract.

### Operator-Facing Projection Bootstrap (Real Gateway + bootstrap feed)

A controlled non-mock/operator path is also available when you want Office to connect to the **real Gateway** while still seeding the first projection panels from a framework-generated packet.

1. Generate or copy a packet such as:
   - `/home/ubuntu/projects/_department/work/openclaw-office-projection-feed-bootstrap-20260325/fixtures/openclaw_office_projection_packet_v0.json`
2. Serve it from the Office app origin, for example:

```bash
mkdir -p public/bootstrap
cp /path/to/openclaw_office_projection_packet_v0.json public/bootstrap/projection-packet.json
```

3. Start Office against the real Gateway and point the operator bootstrap to that URL:

```bash
VITE_GATEWAY_URL=ws://127.0.0.1:18789 \
VITE_GATEWAY_TOKEN=<your-token> \
VITE_PROJECTION_BOOTSTRAP_URL=/bootstrap/projection-packet.json \
pnpm dev
```

Behavior boundary:
- the real Gateway connection path remains intact
- bootstrap loading is optional and guarded by env vars
- this does **not** introduce a new live Gateway protocol message
- this supports operator-facing rollout progress, but does **not** by itself claim upstream merge

---

## 开发

### 命令

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

### 架构

OpenClaw Office 通过 WebSocket 连接 Gateway，数据流如下：

```
OpenClaw Gateway  ──WebSocket──>  ws-client.ts  ──>  event-parser.ts  ──>  Zustand Store  ──>  React 组件
     │                                                                          │
     └── RPC (agents.list, chat.send, ...)  ──>  rpc-client.ts  ──────────────>─┘
```

Gateway 广播实时事件（`agent`、`presence`、`health`、`heartbeat`）并响应 RPC 请求。前端将 Agent 生命周期事件映射为可视化状态（idle/working/speaking/tool_calling/error），在办公室场景中渲染。

### Session 同步策略

- Agent 与子 Agent 的实时状态、2D 办公室小人走动和会议区移动效果，默认由 WebSocket `agent` 事件直接驱动
- `sessions.list` 不再用于高频实时驱动，而是作为连接建立后的立即同步和 **60 秒一次** 的低频 reconciliation，用于修复漏事件、断线恢复后的 session 漂移，并复用同一响应构建 token 统计
- 该策略用于降低 Gateway CPU 压力，避免高频全量扫描影响其他 RPC probe

---

## 微信交流群

**微信养虾技术交流群**：欢迎扫码加群，与大家一起交流养虾实践、技术心得与实际真实的业务应用等。

<img src="./assets/weixin.png" alt="微信养虾技术交流群二维码" width="300" />

---

## 贡献

欢迎任何贡献！无论是新的可视化效果、控制台功能还是性能优化。

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/cool-effect`)
3. 提交更改（使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式）
4. 开启 Pull Request

---

## 许可证

[MIT](./LICENSE)
