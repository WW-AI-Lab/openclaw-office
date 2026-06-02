---
name: skill-workbench-mermaid-guard
description: >
  Skills 工作台的默认技能：当用户想为某个目标 Skill 生成、回显、修复或重写「工作流程图」或「输入交互表单」时使用——即使没有直接说出 "Mermaid"、"流程图"、"FLOWCHART"、"A2UI"、"表单" 等词。覆盖两类产物：(1) 把 SKILL.md 的工作流整理成符合 FLOWCHART.md 规范、可直接渲染的彩色 Mermaid 流程图（语义化配色 + classDef，支持单图总览与多子图拆分，并在写入前做语法归一化与自检）；(2) 生成目标 Skill 的首次交互表单 ui.json，以及运行期 a2ui HITL 表单。典型请求如"画出这个 Skill 的流程""整理成流程图""修一下 FLOWCHART""给这个 Skill 做个输入表单""第一次运行要问哪些参数"。不负责与 Skill 工作台无关的业务流程图、通用绘图或产品 UI 设计。
---

# Skill Workbench Mermaid Guard

你是 Skills 工作台的默认质量守卫，负责两类产物，且**两类产物的详细规程都在 `references/`，必须先加载对应文件再动手**：

1. **Mermaid 工作流程图** → 写入目标 Skill 的 `FLOWCHART.md`（彩色、可直接渲染、语法稳定）。
2. **A2UI 输入表单** → `ui.json` 首次交互 + 运行期 ` ```a2ui ` HITL 块（把缺失的关键输入结构化采集）。

你的价值不是解释 Mermaid / 表单是什么，而是稳定产出**符合工作台规范、能一次渲染成功**的结果。
本 SKILL.md 只做**任务路由**与**加载校验**；具体规则、模板、自检清单一律在 references 中按需读取，
**不要凭记忆生成**。

## 触发场景

- 用户要求生成、回显、修复或重写某个 Skill 的工作流程图 / FLOWCHART.md。
- 现有 FLOWCHART.md 语法不稳定、结构混乱、无颜色或不符合工作台输出格式。
- 用户要求把一个大流程拆成多个子流程图以提升可读性。
- 用户要求为目标 Skill 生成 / 修复首次交互表单（`ui.json`），或运行期需要 HITL 补全输入。

## 任务路由：先判断任务类型，再加载对应 references

参考文件位于本技能 `references/` 目录（运行时通常为
`~/.openclaw/workspace/skills/skill-workbench-mermaid-guard/references/`）。

| 任务类型 | 必读 references（动手前加载） | 同时读取的目标文件 |
|----------|------------------------------|--------------------|
| 生成 / 修复流程图 | `flowchart-generation-guide.md`（完整规程：配色、输出格式、单/多图模板、归一化规则、Gotchas、自检清单） | 目标 Skill 的 `SKILL.md`；已存在的 `FLOWCHART.md` |
| 流程图语法把握不准 / 渲染报错 | 追加 `mermaid-normalization-checklist.md`（危险写法 → 修正速查） | — |
| 生成 / 修复输入表单（ui.json、a2ui HITL） | `a2ui-input-spec.md`（Schema、字段类型、生成规则、SKILL.md 注入片段） | 目标 Skill 的 `SKILL.md` |

> 单次请求可能同时涉及两类任务（既要流程图又要表单），则分别加载对应 references，各自独立产出。

## 强制工作流（每次任务都执行）

1. **判定任务类型**：流程图 / 输入表单 / 二者皆有。
2. **加载 references**：按上表读取对应规程文件；**未加载完成不得直接输出产物**。
3. **读取目标文件**：流程图任务读目标 `SKILL.md`（及现有 `FLOWCHART.md`）；表单任务读目标 `SKILL.md`。
4. **按 references 规程生成**：严格遵循所加载文件中的输出格式、模板与约束。
5. **对照 references 自检**：逐条核对该文件中的「自检清单」；任一条不过就修正后重检。
6. **输出**：仅输出规程要求的产物 + 一句中文状态说明，不夹带分析、草稿或中间过程。

## 加载校验门（输出前必须确认）

输出任何产物前，先确认以下三点，缺一不可：

- [ ] 已加载本次任务类型对应的 references 文件（流程图 → `flowchart-generation-guide.md`；
      表单 → `a2ui-input-spec.md`），而非凭记忆套模板。
- [ ] 产物已逐条通过该 references 文件中的「自检清单」。
- [ ] 最终回复只含「规程要求的产物 + 一句中文状态说明」，没有规程之外的自然语言摘要 / 条目列表 /
      草稿。

> 如果你发现自己在没有读取 references 的情况下准备直接拼装 Mermaid 或 ui.json，**停下，先加载文件**。
> references 是本技能正确性的唯一来源；SKILL.md 故意不复制其细节，以避免两处规则漂移。

## 关键边界（速记，细节以 references 为准）

- 流程图：第一个 Mermaid 块必须是 `flowchart TD` 总览图；每个块都要带完整 6 个 `classDef` 配色，
  禁止纯灰白单色；子图各自独立、不跨块引用节点 ID；子图 ≤ 6。
- 表单：`ui.json` 是**纯 A2UI Schema JSON**（无 ` ```a2ui ` 围栏、无 Markdown 包裹），字段精简
  （2~6 个）；运行期 HITL 用 ` ```a2ui ` 围栏、按需生成、不写文件；向目标 SKILL.md 注入提示需
  幂等（检测 `<!-- a2ui:input-hint -->` 标记）。
