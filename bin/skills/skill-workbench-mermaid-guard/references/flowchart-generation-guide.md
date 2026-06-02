# 流程图生成指南（FLOWCHART.md）

本文件是 `skill-workbench-mermaid-guard` 生成 / 修复 Mermaid 工作流程图的完整规程。
**只在处理流程图任务时按需加载。** 语法易错点的快速对照见
`mermaid-normalization-checklist.md`。

## 颜色规范（必须应用于所有流程图）

**所有流程图必须着色，不允许输出纯灰白单色图。** 每个 Mermaid 代码块都必须在
`flowchart TD` / `flowchart LR` 声明之后、第一个节点之前，**原样**声明以下全部 6 个
`classDef`（下文称「CLASSDEF 区块」）：

```
classDef startNode fill:#22c55e,stroke:#16a34a,color:#fff,font-weight:bold
classDef endOk     fill:#3b82f6,stroke:#1d4ed8,color:#fff,font-weight:bold
classDef endErr    fill:#ef4444,stroke:#b91c1c,color:#fff,font-weight:bold
classDef decision  fill:#f59e0b,stroke:#d97706,color:#fff,font-weight:bold
classDef process   fill:#dbeafe,stroke:#3b82f6,color:#1e40af
classDef phase     fill:#ede9fe,stroke:#7c3aed,color:#4c1d95,font-weight:bold
```

> 下方多图模板用 `%% << CLASSDEF 区块 >>` 作为占位以节省篇幅；实际输出时**每个**
> Mermaid 块都要把上面 6 行完整粘贴进去，不能用占位符代替。

**语义映射规则：**

| 节点类型 | classDef | 颜色含义 | 使用场景 |
|----------|----------|----------|----------|
| 开始节点 | `startNode` | 绿色 | 流程入口，通常命名含 `START` |
| 成功结束 | `endOk` | 蓝色 | 正常/成功出口，命名含 `END_OK`、`SUCCESS` |
| 失败/错误结束 | `endErr` | 红色 | 错误/拒绝出口，命名含 `END_ERR`、`FAIL`、`ERROR` |
| 决策节点 | `decision` | 琥珀色 | 菱形判断节点 `{...}` |
| 普通步骤 | `process` | 浅蓝 | 执行步骤、操作、处理节点 |
| 阶段节点 | `phase` | 紫色 | 总览图中的阶段块，命名含 `PHASE_` 或代表整体阶段 |

**应用方式**（使用 `:::` 内联语法）：

```
START["开始：接收请求"]:::startNode
STEP_1["步骤 1：处理"]:::process
DECIDE_1{"条件判断？"}:::decision
END_OK["结束：成功"]:::endOk
END_ERR["结束：失败"]:::endErr
PHASE_A["阶段 A"]:::phase
```

## 强制输出格式

最终回复只能有两部分，且顺序固定：

1. FLOWCHART.md 的主要章节，包含一个或多个 ```mermaid 代码块；每个代码块前必须有一个
   `##` 二级标题说明该图的用途。第一个代码块必须是总览流程图（flowchart TD）。
2. 一句中文状态说明，说明已读取现有 FLOWCHART.md 或已写入目标 FLOWCHART.md。

禁止输出：

- 在 `##` 小节之外夹带的自然语言摘要或条目列表
- 分析过程、自检过程、草稿、中间版本
- 只有子图而缺失总览图
- 子图与子图之间通过 Mermaid 代码引用对方的节点 ID（每个图必须各自完整、独立渲染）
- 缺少 `classDef` 声明的单色流程图

## 何时使用单图 vs 多图

- **单图（默认）**：Skill 逻辑线性、分支不多、一个 flowchart TD 即可清晰表达时，只输出 1 个
  Mermaid 块 + 1 个 `##` 总览标题。
- **多图（复杂 Skill）**：当 SKILL.md 含有明显的阶段划分（Phase A / B / C）、并行分支、降级
  策略、独立子流程等，总览图之后再用若干 `##` 小节分别描述每个阶段 / 子流程。子图建议 ≤ 6 个。

## 标准输出模板（单图模式）

## 总览流程

```mermaid
flowchart TD
    classDef startNode fill:#22c55e,stroke:#16a34a,color:#fff,font-weight:bold
    classDef endOk     fill:#3b82f6,stroke:#1d4ed8,color:#fff,font-weight:bold
    classDef endErr    fill:#ef4444,stroke:#b91c1c,color:#fff,font-weight:bold
    classDef decision  fill:#f59e0b,stroke:#d97706,color:#fff,font-weight:bold
    classDef process   fill:#dbeafe,stroke:#3b82f6,color:#1e40af
    classDef phase     fill:#ede9fe,stroke:#7c3aed,color:#4c1d95,font-weight:bold

    START["开始：接收请求"]:::startNode --> STEP_1["步骤 1：读取关键输入"]:::process
    STEP_1 --> DECIDE_1{"是否满足执行条件？"}:::decision
    DECIDE_1 -->|是| STEP_2["步骤 2：执行主流程"]:::process
    DECIDE_1 -->|否| END_ERR["结束：返回限制说明"]:::endErr
    STEP_2 --> STEP_3["步骤 3：生成结果"]:::process
    STEP_3 --> END_OK["结束：输出结果"]:::endOk
```

## 标准输出模板（多图模式，示例骨架）

> 下列 `%% << CLASSDEF 区块 >>` 仅为示例占位，实际输出请替换为完整的 6 行 classDef。

## 总览流程

```mermaid
flowchart TD
    %% << CLASSDEF 区块 >>
    START["开始"]:::startNode --> PHASE_A["阶段 A"]:::phase
    PHASE_A --> PHASE_B["阶段 B"]:::phase
    PHASE_B --> PHASE_C["阶段 C"]:::phase
    PHASE_C --> END_OK["结束"]:::endOk
```

## 阶段 A：数据采集

```mermaid
flowchart TD
    %% << CLASSDEF 区块 >>
    A_START["阶段 A 开始"]:::startNode --> A_1["读取输入"]:::process
    A_1 --> A_2["清洗数据"]:::process
    A_2 --> A_END["阶段 A 结束"]:::endOk
```

## 阶段 B：并行处理

```mermaid
flowchart LR
    %% << CLASSDEF 区块 >>
    B_START["阶段 B 开始"]:::startNode --> B_1["分支 1"]:::process
    B_START --> B_2["分支 2"]:::process
    B_1 --> B_MERGE["合并结果"]:::process
    B_2 --> B_MERGE
    B_MERGE --> B_END["阶段 B 结束"]:::endOk
```

## 降级策略

```mermaid
flowchart TD
    %% << CLASSDEF 区块 >>
    FAIL{"执行失败？"}:::decision -->|是| DEG["降级路径"]:::process
    FAIL -->|否| NORMAL["正常继续"]:::process
    DEG --> RESUME["继续执行"]:::endOk
    NORMAL --> RESUME
```

## 语法归一化规则

1. 总览流程图必须放在第一个 Mermaid 代码块，布局固定使用 `flowchart TD`；后续子图允许使用
   `flowchart TD` 或 `flowchart LR`（其他语法如 `sequenceDiagram`、`stateDiagram-v2` 仅在
   SKILL.md 本身明显描述该类图时才使用）。
2. 节点 ID 只能使用 ASCII 字母、数字、下划线，例如 `START`、`STEP_1`、`DECIDE_1`。不同 Mermaid
   块之间的节点 ID 允许同名，但不得跨块引用。
3. 任何包含中文、空格、斜杠、括号、问号、冒号、箭头、emoji、尖括号的节点文本，都必须放进双引号。
4. 子图标题如果包含中文或特殊符号，也必须写成 `subgraph PHASE_A["阶段 1：结构感知"]`。
5. 节点内换行只能使用 `<br/>`，不要直接换行。
6. 分支边标签只允许短标签：是、否、成功、失败、存在、不存在、通过、不通过。较长说明改写为节点，
   不要塞进边标签。
7. 如果一个标签的写法可能触发语法问题，优先简化标签文本，不要为了保留冗长文案牺牲 Mermaid 稳定性。
8. 每个 Mermaid 代码块必须以 ```mermaid 开头、``` 结尾，严格闭合；禁止在同一围栏内混写多种
   diagram type。
9. 每个 Mermaid 代码块前都必须有一个且仅一个 `##` 二级标题。不要使用 `#` 一级标题或 `###`
   三级标题作为图的标题。
10. **颜色规则**：每个 Mermaid 代码块内，`flowchart` 声明行之后、第一条连线或节点定义之前，
    必须完整声明上方「颜色规范」中全部 6 个 `classDef`。所有节点（除纯中转/合并节点外）都必须
    通过 `:::className` 语法应用对应颜色类。
11. **颜色语义一致性**：同一语义的节点类型在所有图中保持相同颜色类；不得随意给无语义区分的
    节点混用颜色类。

## 易错点（Gotchas）

这些是渲染失败的高频根因，违反约定就会直接报错或丢色——务必先看再写：

- **占位符不能进最终输出**：模板里的 `%% << CLASSDEF 区块 >>` 只是示意；真正写入时每个 Mermaid
  块都要展开成 6 行完整 `classDef`，否则节点全是灰白默认色。
- **`:::className` 与 classDef 名称必须逐字一致**：只有 `startNode / endOk / endErr / decision
  / process / phase` 六个；写成 `:::start` 或 `:::ok` 会被 Mermaid 忽略而不报错，导致静默丢色。
- **菱形节点也要加颜色类**：`DECIDE_1{"..."}:::decision`，不能因为是判断节点就漏掉 `:::decision`。
- **边标签里不要放标点/斜杠/长句**：`-->|读取 SKILL.md / 判断| X` 会破坏解析；把它改写成中间节点。
- **节点文本含中文/空格/括号/问号/冒号时必须双引号**，菱形也是 `{"中文？"}` 而非 `{中文?}`。
- **不要跨 Mermaid 块复用节点 ID**：每张图各自独立渲染，A 图的 `STEP_1` 不能在 B 图里被引用。
- **一个围栏只放一种 diagram type**：不要在同一 ```mermaid 块里混写 `flowchart` 与 `sequenceDiagram`。
- **图与图之间不写自然语言摘要**：除每张图前的一个 `##` 标题与结尾一句状态说明外，回复里不应出现
  分析/条目列表。

> 当用户指出某张图渲染失败时，把失败原因补进本节，是迭代改进本技能最直接的方式。

## 输出前自检清单

逐项确认，全部通过才能输出：

1. 每个 Mermaid 围栏代码块的 ```mermaid 与 ``` 都闭合。
2. 第一个 Mermaid 块首行是 `flowchart TD`。
3. 同一 Mermaid 块内所有节点 ID 唯一。
4. 所有带中文或特殊符号的节点标签都使用双引号。
5. 节点标签中没有原生换行，只有 `<br/>`。
6. 每个 Mermaid 块前面都有一个 `##` 标题；没有图之外的自然语言摘要段落。
7. 子图数量 ≤ 6；如果超过，考虑合并或简化。
8. 没有跨 Mermaid 块引用节点 ID 的情况。
9. **每个 Mermaid 块都包含完整的 6 个 `classDef` 声明**（startNode / endOk / endErr / decision
   / process / phase）。
10. **所有节点都正确应用了 `:::className` 颜色标注**，没有遗漏的无色节点（纯合并节点除外）。

## 执行策略

1. 如果现有 FLOWCHART.md 已经可用，优先做最小修订，尽量保留已有结构（包括已有的多图分块）；同时
   补齐缺失的 `classDef` 和 `:::className` 颜色标注。
2. 如果现有 FLOWCHART.md 结构混乱或仅含片段 Mermaid，先在脑内整理章节划分，再按"总览 + 若干
   子图"的顺序写出来，所有图均附带完整颜色。
3. 如果 SKILL.md 表达的工作流非常简单，直接输出单图即可；不要为了"凑多图"而硬拆。
4. 如果 SKILL.md 含有复杂阶段 / 分支 / 降级策略等，主动拆成多图并在每个 `##` 标题里点明主题，
   每张子图均包含完整 `classDef`。
5. 最终回复时直接回显将要写入或已经写入 FLOWCHART.md 的全部内容（标题 + Mermaid 代码块）；末尾
   追加一句中文状态说明。
