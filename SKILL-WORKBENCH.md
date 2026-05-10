# Skill Workbench — Skills 开发平台使用指南

> 一个面向 OpenClaw Skills 的可视化开发平台，集成在 OpenClaw Office 控制台中。
> 发布版本：`2026.5.10-beta.1` 起正式提供。

---

## 1. 定位

**Skill Workbench** 把"Skill 开发"从写 Markdown 的纯文本工作流，升级为一个**聊天驱动 + 可视预览 + 一键生成流程图**的开发平台：

- 所有产物都是普通的 Markdown / YAML 文件，落盘在 `~/.openclaw/workspace/skills/<skill-slug>/` 下
- 聊天侧边栏直接挂载到 OpenClaw Gateway，借助 AI 与本地 Skill 文件工具完成增删改
- 详情页提供 `SKILL.md`、`FLOWCHART.md` 及其它自定义文件的切换浏览与原地编辑
- 流程图走纯 Markdown 渲染链路，天然支持**一份 FLOWCHART.md 内多个 Mermaid 代码块**

可以把它理解为 "OpenClaw Skills 版的 Notion + VS Code"：写作在前，文件在后。

---

## 2. 入口与路由

工作台采用**嵌套路由三页面**结构：

| 路径                                | 页面             | 作用                                                           |
| ----------------------------------- | ---------------- | -------------------------------------------------------------- |
| `/skill-workbench`                  | 列表首页         | 展示本地已安装的 Skills，提供创建入口和搜索                    |
| `/skill-workbench/create`           | 创建向导         | 与 AI 对话，基于需求描述生成全新的 Skill 骨架与 `SKILL.md`     |
| `/skill-workbench/:slug`            | 详情页           | 浏览 / 编辑某个 Skill 的全部文件；默认展示 `FLOWCHART.md` 预览 |

从控制台左侧导航即可进入；子路由之间通过 `AppShell` 内部的 `Outlet` 切换，不会打断底部 Chat Dock 的会话状态。

---

## 3. 创建一个新 Skill

1. 进入 `/skill-workbench`，点击 **"新建 Skill"**。
2. 在创建向导页的侧边栏与 AI 对话描述你的需求（例如"帮我生成一个能把长文章总结成三点摘要的 Skill"）。
3. AI 会基于内置 [`skill-workbench-creator`] 默认技能，产出：
   - 规范的 `SKILL.md`（带 YAML frontmatter：`name`、`description`）
   - 初版工作流程描述
4. 保存后 Skill 立即落盘到 `~/.openclaw/workspace/skills/<slug>/`，并在列表页可见。
5. 首次保存后通常**紧接着让 AI 生成 `FLOWCHART.md`**（见第 5 节）。

---

## 4. 编辑已有 Skill

在 `/skill-workbench/:slug` 详情页：

- **左侧文件树** — 列出该 Skill 目录下所有文件，点击即可浏览；`FLOWCHART.md` 始终排在最上方
- **中间主视图** — 根据选中项切换：
  - 选中 `FLOWCHART.md` → 进入纯 Markdown 多图预览
  - 选中其它文件 → 进入 `SkillFileViewer` 的原地编辑器
- **右侧聊天栏（可折叠）** — 点击 "修改此 Skill" 开启专用会话：
  - 会话 key 会带时间戳，保证与历史对话隔离
  - 会话启动时会注入当前 Skill 目录与默认守卫技能作为 system 上下文
  - 用自然语言描述修改点，AI 会直接用 `read` / `write` / `edit` 工具改盘

所有变更都是**即时落盘**的——刷新页面即可看到最新内容；不需要保存按钮。

---

## 5. 流程图：FLOWCHART.md 一键生成

### 交互

在详情页选中 **FLOWCHART.md**：

- 若该 Skill 尚未有 `FLOWCHART.md`，预览区会显示 **"一键生成流程图"** 按钮
- 点击后工作台会：
  1. 自动发送符合 `skill-workbench-mermaid-guard` 规范的生成指令
  2. 流式写出 Mermaid 源
  3. 把完整的 `FLOWCHART.md` 写回到磁盘
  4. 预览区自动刷新为最终渲染结果

### 纯 Markdown 多图预览

预览面板不再做特殊裁剪：**整份 `FLOWCHART.md` 作为 Markdown 文档渲染**，内部的每一个 ```mermaid 代码块都会各自被 `MermaidPreview` 渲染成独立 SVG。这意味着：

- 一个 Skill 可以拥有一张总览图 + 若干分阶段子图
- 每个代码块前可以加 `##` 二级标题，互相之间可以穿插文字说明
- 预览体验与 GitHub / VS Code 等 Markdown 预览保持一致

### 颜色 / 结构规范

流程图生成严格遵循内置守卫技能 `skill-workbench-mermaid-guard`：

| 节点类型       | classDef    | 颜色含义 | 使用场景                                          |
| -------------- | ----------- | -------- | ------------------------------------------------- |
| 开始节点       | `startNode` | 绿色     | 流程入口                                          |
| 成功结束       | `endOk`     | 蓝色     | 正常/成功出口                                     |
| 失败/错误结束  | `endErr`    | 红色     | 错误/拒绝出口                                     |
| 决策节点       | `decision`  | 琥珀色   | `{...}` 菱形判断                                  |
| 普通步骤       | `process`   | 浅蓝     | 执行 / 操作节点                                   |
| 阶段节点       | `phase`     | 紫色     | 总览图中代表一个阶段（内部可能展开为一张子流程图）|

---

## 6. 默认技能的自动安装

工作台依赖两个"默认技能"注入到 AI 的 system 上下文：

| Skill slug                           | 作用                                                  |
| ------------------------------------ | ----------------------------------------------------- |
| `skill-workbench-creator`            | 引导 AI 生成规范的 `SKILL.md` 骨架                    |
| `skill-workbench-mermaid-guard` ✨   | 保障 `FLOWCHART.md` 输出的格式 / 颜色 / 规范           |

从 `2026.5.10-beta.1` 起：

- `skill-workbench-mermaid-guard` 的完整源码随 npm 包一起发布（放在 `bin/skills/` 目录下）
- 嵌入式 Node 服务端新增 `POST /api/workspace-skills/ensure-defaults` 端点
- 前端在每次打开 / 修改工作台（调用 `enterWorkbench()`）之前，都会先调一次该端点
- 如果 `~/.openclaw/workspace/skills/<slug>/SKILL.md` 不存在，服务端会**自动递归拷贝**内置版本到用户工作区
- 已存在则不做任何事（幂等）；整个过程对用户无感

如果你手动删掉了 `~/.openclaw/workspace/skills/skill-workbench-mermaid-guard/`，下一次进入工作台会被重新生成。

---

## 7. 与 OpenClaw Gateway 的协作关系

工作台的数据流如下：

```
Browser ── /api/workspace-skills/*  ──►  Embedded Node server (bin/openclaw-office.js)
    │                                           │
    │                                           └─► Local FS: ~/.openclaw/workspace/skills/
    │
    └── WebSocket /gateway-ws ─────────►  OpenClaw Gateway (chat & tool calls)
```

- **文件 CRUD** 直接走嵌入式服务端，读写 `~/.openclaw/workspace/skills/`；完全不经 Gateway
- **聊天 / 工具调用** 走 Gateway WebSocket；AI 使用 Gateway 提供的 `read` / `write` / `edit` 等工具直接改本地文件
- **Git 提交**（可选）由嵌入式服务端 `commit` 端点完成，默认提交消息为 `chore(skill): update <slug>/<file> via OpenClaw Office`

---

## 8. 常见问题

**Q: 流程图生成一直卡在 "生成中…"？**
A: 检查 Gateway 连接状态（顶部应为 Connected），并确认所选 Agent 有可用的模型 Provider。生成完成的标志是 `FLOWCHART.md` 被写入磁盘；若 AI 只是回复了解释文字但没有真正写文件，请再次点击 "一键生成"，守卫技能会强制直接调用 write 工具。

**Q: 自动安装默认技能失败怎么办？**
A: 进入工作台时浏览器控制台会打印 `[skill-workbench] ensure default skills failed:` 警告。失败不会阻塞工作台本身；你可以手动从本项目的 `bin/skills/skill-workbench-mermaid-guard/` 拷贝到 `~/.openclaw/workspace/skills/` 作为 fallback。

**Q: 我想用我自己的守卫技能替换默认的，行吗？**
A: 可以。只要在 `~/.openclaw/workspace/skills/skill-workbench-mermaid-guard/SKILL.md` 存在自定义实现，`ensure-defaults` 就不会覆盖——它只在缺失时安装。

**Q: 文件跟不上磁盘变化？**
A: 详情页的文件树与 FLOWCHART 预览会在每一轮聊天流结束时自动刷新；若仍有偏差，切换选中的文件或返回列表页再进入即可强制重新拉取。

---

## 9. 相关文件

- 前端入口：[src/components/pages/SkillWorkbenchPage.tsx](./src/components/pages/)、`SkillWorkbenchCreatePage.tsx`、`SkillWorkbenchDetailPage.tsx`
- 工作台状态：[src/store/console-stores/skill-workbench-store.ts](./src/store/console-stores/skill-workbench-store.ts)
- 嵌入式 API：[bin/openclaw-office.js](./bin/openclaw-office.js) 中的 `handleWorkspaceSkillsApi`
- 内置默认技能：[bin/skills/skill-workbench-mermaid-guard/](./bin/skills/skill-workbench-mermaid-guard/)
- 前端客户端：[src/gateway/workspace-skills-client.ts](./src/gateway/workspace-skills-client.ts)

---

## 10. 版本记录

- **2026.5.10-beta.1** — 首次对外发布 Skill Workbench
  - 三页面嵌套路由
  - FLOWCHART.md 纯 Markdown 多图预览
  - 内置 `skill-workbench-mermaid-guard` 并提供 `ensure-defaults` 自动安装
  - 创建模式首轮 session & skill 注入修复

[`skill-workbench-creator`]: https://github.com/openclaw/openclaw
