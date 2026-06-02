# A2UI 输入表单规范（ui.json 与运行期 a2ui 块）

本文件定义 Skills 工作台中 A2UI（Agent-to-UI）输入表单的 Schema、字段约定、生成规则与目标
Skill 提示注入方式。A2UI 用于把"首次触发 Skill 时缺失的关键信息"或"Skill 执行过程中的 HITL
确认/补充"以结构化表单形式呈现给用户，替代纯自然语言追问。

A2UI 有两种载体，二者使用同一套 Schema 与同一个解析器：

1. **`ui.json`（稳定首次交互）**：作为目标 Skill 目录下的产物文件（与 `FLOWCHART.md` 同级），
   保存该 Skill 第一次交互需要采集的输入表单。由工作台「A2UI 调试」选项卡读取并渲染。
2. **运行期 ` ```a2ui ` 代码块（按需 HITL）**：当 Skill 执行过程中确实需要用户补充信息或确认时，
   助手直接在回复里输出一个 ` ```a2ui ` 围栏 JSON 代码块，chat 会动态渲染为可交互表单。
   运行期表单**按需动态生成，不预先写入文件**。

## A2UI Schema

A2UI 表单是一段 JSON 对象，顶层字段：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `version` | number | 否 | Schema 版本，固定为 `1`（缺省按 1 处理）|
| `skill` | string | 否 | 目标 Skill 标识（slug）|
| `title` | string | 否 | 表单标题 |
| `description` | string | 否 | 表单说明 |
| `fields` | array | **是** | 字段列表，至少 1 项；为空则整张表单降级为代码块 |
| `submit` | object | 否 | `{ "label": "提交按钮文案" }` |

每个 `fields` 元素：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `key` | string | **是** | 字段名，提交时作为键；缺失该字段会被丢弃 |
| `label` | string | 否 | 显示标签（缺省回退为 `key`）|
| `type` | string | 否 | 控件类型，见下表；未知类型降级为 `text` |
| `required` | boolean | 否 | 是否必填 |
| `value` | string \| string[] \| boolean \| object \| object[] | 否 | 预填值（见「预填 value 来源」）|
| `placeholder` | string | 否 | 占位提示 |
| `options` | array | 选项类必填 | `[{ "label": "...", "value": "..." }]` 或字符串数组 |
| `accept` | string | 否 | 仅 `file` 类型；MIME 过滤，如 `".pdf,.docx"` 或 `"image/*"` |
| `multiple` | boolean | 否 | 仅 `file` 类型；为 `true` 时允许选择多个文件 |

### 支持的字段类型

| type | 控件 | value 形态 |
|------|------|-----------|
| `text` | 单行文本 | string |
| `textarea` | 多行文本 | string |
| `number` | 数字输入 | string |
| `select` | 下拉单选 | string（option.value）|
| `radio` | 单选按钮组 | string（option.value）|
| `checkbox` | 单个勾选 | boolean |
| `multiselect` | 多选框组 | string[]（多个 option.value）|
| `file` | 文件上传 | `{ name, mimeType, dataUrl }` 或其数组（`multiple` 为 true 时）|

`select` / `radio` / `multiselect` 必须提供 `options`；缺失时该字段降级为 `text`。

`file` 类型字段提交时，文件数据会作为聊天附件一并发送给 Agent；文本消息中仅包含文件名摘要。
可通过 `accept` 限制可选文件类型（如 `".pdf,.docx"`、`"image/*"`），通过 `multiple: true` 启用多文件选择。

### 何时优先使用 `file` 类型（强制语义识别）

以下任意一种字段语义出现时，**必须**使用 `type: "file"`，不要使用 `text` 或 `textarea` 让用户手填路径或粘贴内容：

- 字段标签或说明含「数据来源 / 数据文件 / 数据集 / 上传 / 附件 / 导入」等关键词。
- 字段需要 CSV / Excel(xlsx, xls) / JSON / TSV / Parquet / PDF / Word / PPT / 图片 / 音视频 等二进制或半结构化文件。
- 占位符示例提到「文件路径」「文件 URL」「上传 ...」「拖入 ...」。
- Skill 的 SKILL.md 描述要求用户提供本地文件、附件、原始素材等。

配套要求：

- 必须设置 `accept`，准确列出该 Skill 支持的扩展名或 MIME（例如数据分析类设为 `".csv,.xlsx,.xls,.json,.tsv,.parquet"`）。
- 当业务确实可能需要多个文件（多份数据集、批量素材）时设置 `multiple: true`，否则保持单文件。
- 反例：`{"key":"data_source","type":"text","placeholder":"CSV 文件路径"}` ❌——必须改为 `type: "file"` + `accept`。

如果同一字段同时可能是文件**或**字符串（如「数据库连接串 OR CSV 文件」），请拆成两个字段：一个 `file`、一个 `text`，并通过 `placeholder`/`label` 区分；不要混在一个 `text` 里。

## 预填 value 来源

生成表单前，先从上下文中尽可能识别已知信息并写入 `value`，减少用户输入成本：

- 用户已经在对话里提供的内容（如已粘贴的正文、已说明的目标）。
- 目标 Skill 的 SKILL.md 中的默认值或推荐选项。
- 合理的常用默认（如条数默认 3、语言默认"中文"）。

只把**确有依据**的值写入 `value`；不要臆造。`required` 字段即使已预填也保留必填校验。

## 生成期规则：写入 `ui.json`

当任务是"为目标 Skill 生成首次交互表单"时：

1. 通读目标 Skill 的 SKILL.md，识别其第一次运行真正需要用户提供的关键输入（通常 2~6 个字段）。
2. 产出**纯 A2UI Schema JSON**（不要包裹 ` ```a2ui ` 围栏，不要附加 Markdown），写入目标 Skill
   目录下的 `ui.json`。
3. `skill` 字段填目标 Skill 的 slug；为每个字段设置合理的 `type`、`required`、`label` 与可用的
   `value` 预填。
4. 保持字段精简：只采集"不问就无法开始"的信息，过程性细节留给运行期 HITL。

## 运行期规则：输出 ` ```a2ui ` 块

当 Skill 执行过程中需要 HITL（用户补充/确认）时：

1. 在助手回复中直接输出一个 ` ```a2ui ` 围栏代码块，块内为符合上述 Schema 的 JSON。
2. 只在**真正需要用户输入**时输出表单；不要为纯通知性内容生成表单。
3. 表单提交后用户会收到一条结构化文字消息（人类可读摘要 + 一段 `[a2ui-data] {json}` 机器可读
   键值），据此继续执行即可。
4. 运行期表单**不写入文件**，随用随生成。

## 目标 Skill 提示注入片段（幂等）

为让目标 Skill 在合适位置主动使用 A2UI，向其 SKILL.md 注入下述片段。注入需**幂等**：若已存在
`<!-- a2ui:input-hint -->` 标记则跳过，不重复追加。

```markdown
<!-- a2ui:input-hint -->
## 输入交互（A2UI）

- 本 Skill 已有 `ui.json` 首次交互表单。**首次被用户触发时，必须先读取 ui.json 并将其内容原样输出为一个 ```a2ui 代码块**，等待用户填写提交后再继续执行。这是强制性要求，不要跳过表单直接开始任务。
- 执行过程中如需用户补充或确认信息（HITL），也输出一个 ```a2ui 代码块（字段含
  key/label/type/required/value/options），用户提交后据其结构化回复继续执行。
- 禁止用纯文字追问替代表单；禁止将表单改写为其他格式（Markdown 卡片、HTML 等）。
- A2UI Schema 与字段约定见 references/a2ui-input-spec.md。
<!-- /a2ui:input-hint -->
```

## 自检清单

写入 `ui.json` 或输出 ` ```a2ui ` 块前逐项确认：

1. 顶层是合法 JSON 对象，含非空 `fields` 数组。
2. 每个字段都有唯一 `key`；选项类字段都带 `options`。
3. `type` 均为受支持类型；预填 `value` 形态与 `type` 匹配（checkbox→boolean，multiselect→string[]，file→object）。
4. 仅采集首次/HITL 真正必需的信息，字段数量克制。
5. `file` 类型字段设置了合理的 `accept` 限制；不需要多文件时不设置 `multiple`。
6. `ui.json` 为纯 JSON，无 Markdown / 围栏包裹；运行期表单使用 ` ```a2ui ` 围栏。
7. 向目标 SKILL.md 注入提示时检测 `<!-- a2ui:input-hint -->` 标记，避免重复注入。
