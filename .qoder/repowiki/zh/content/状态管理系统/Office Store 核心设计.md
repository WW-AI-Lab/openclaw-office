# Office Store 核心设计

<cite>
**本文档引用的文件**
- [office-store.ts](file://src/store/office-store.ts)
- [types.ts](file://src/gateway/types.ts)
- [constants.ts](file://src/lib/constants.ts)
- [position-allocator.ts](file://src/lib/position-allocator.ts)
- [movement-animator.ts](file://src/lib/movement-animator.ts)
- [AgentAvatar.tsx](file://src/components/office-2d/AgentAvatar.tsx)
- [ConnectionLine.tsx](file://src/components/office-2d/ConnectionLine.tsx)
- [agent-reducer.ts](file://src/store/agent-reducer.ts)
- [meeting-manager.ts](file://src/store/meeting-manager.ts)
- [assistant-collaboration-hints.ts](file://src/lib/assistant-collaboration-hints.ts)
- [local-persistence.ts](file://src/lib/local-persistence.ts)
- [metrics-reducer.ts](file://src/store/metrics-reducer.ts)
- [event-parser.ts](file://src/gateway/event-parser.ts)
- [office-store.test.ts](file://src/store/__tests__/office-store.test.ts)
- [position-allocator.test.ts](file://src/lib/__tests__/position-allocator.test.ts)
- [meeting-manager.test.ts](file://src/store/__tests__/meeting-manager.test.ts)
</cite>

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考虑](#性能考虑)
8. [故障排查指南](#故障排查指南)
9. [结论](#结论)
10. [附录](#附录)

## 简介
本文件面向 Office Store 核心设计，系统性阐述以下主题：
- 智能体状态管理架构：VisualAgent 数据结构、智能体生命周期管理、状态转换逻辑
- 协作关系维护机制：CollaborationLink 的设计、agent-to-agent 配置、协作热力图计算
- 2D 办公室渲染状态管理：AgentAvatar 组件状态、ConnectionLine 连线状态、移动动画状态
- 位置分配算法：allocatePosition、allocateMeetingPositions、calculateLoungePositions 的实现原理
- 事件历史记录机制：EVENT_HISTORY_LIMIT 限制、EventHistoryItem 结构、调试和监控功能
- 状态持久化策略、性能优化技巧、内存管理最佳实践

## 项目结构
Office Store 采用 Zustand + Immer 的状态管理方案，结合自研的路径规划与位置分配算法，支撑 2D 办公室场景中的智能体可视化与交互。

```mermaid
graph TB
subgraph "状态层"
OS["OfficeStore<br/>Zustand + Immer"]
AR["agent-reducer.ts<br/>事件应用"]
MM["meeting-manager.ts<br/>会议编排"]
MR["metrics-reducer.ts<br/>全局指标"]
end
subgraph "算法层"
PA["position-allocator.ts<br/>位置分配"]
MA["movement-animator.ts<br/>路径与插值"]
EP["event-parser.ts<br/>事件解析"]
end
subgraph "渲染层"
AA["AgentAvatar.tsx<br/>头像渲染"]
CL["ConnectionLine.tsx<br/>连线渲染"]
end
subgraph "类型与常量"
T["types.ts<br/>接口与枚举"]
C["constants.ts<br/>布局与配色"]
end
OS --> AR
OS --> MM
OS --> MR
OS --> PA
OS --> MA
OS --> EP
AA --> OS
CL --> OS
T --> OS
C --> AA
C --> CL
```

图表来源
- [office-store.ts:217-370](file://src/store/office-store.ts#L217-L370)
- [agent-reducer.ts:19-67](file://src/store/agent-reducer.ts#L19-L67)
- [meeting-manager.ts:32-135](file://src/store/meeting-manager.ts#L32-L135)
- [metrics-reducer.ts:3-27](file://src/store/metrics-reducer.ts#L3-L27)
- [position-allocator.ts:51-101](file://src/lib/position-allocator.ts#L51-L101)
- [movement-animator.ts:85-159](file://src/lib/movement-animator.ts#L85-L159)
- [event-parser.ts:17-60](file://src/gateway/event-parser.ts#L17-L60)
- [AgentAvatar.tsx:15-254](file://src/components/office-2d/AgentAvatar.tsx#L15-L254)
- [ConnectionLine.tsx:9-53](file://src/components/office-2d/ConnectionLine.tsx#L9-L53)
- [types.ts:166-222](file://src/gateway/types.ts#L166-L222)
- [constants.ts:23-141](file://src/lib/constants.ts#L23-L141)

章节来源
- [office-store.ts:217-370](file://src/store/office-store.ts#L217-L370)
- [types.ts:166-222](file://src/gateway/types.ts#L166-L222)
- [constants.ts:23-141](file://src/lib/constants.ts#L23-L141)

## 核心组件
- OfficeStore：集中管理所有智能体、协作关系、全局指标、连接状态、事件历史等，提供统一的状态读取与更新入口。
- VisualAgent：智能体在 2D 办公室中的可视化表示，包含状态、位置、运动轨迹、会话映射等字段。
- CollaborationLink：跨智能体协作关系，支持强度、最后活动时间、是否 peer 指派等标记。
- EventHistoryItem：事件历史条目，用于调试与审计，支持按 run、item 合并。
- 位置分配器：负责固定工位、临时工位、休息区、会议室座位的确定性分配。
- 移动动画器：基于走廊拓扑的路径规划、距离计算、进度插值与动画驱动。
- 渲染组件：AgentAvatar 与 ConnectionLine，分别负责智能体头像与协作连线的视觉呈现。

章节来源
- [office-store.ts:39-84](file://src/store/office-store.ts#L39-L84)
- [types.ts:166-222](file://src/gateway/types.ts#L166-L222)
- [position-allocator.ts:51-101](file://src/lib/position-allocator.ts#L51-L101)
- [movement-animator.ts:85-159](file://src/lib/movement-animator.ts#L85-L159)
- [AgentAvatar.tsx:15-254](file://src/components/office-2d/AgentAvatar.tsx#L15-L254)
- [ConnectionLine.tsx:9-53](file://src/components/office-2d/ConnectionLine.tsx#L9-L53)

## 架构总览
Office Store 的控制流从事件解析开始，经由 agent-reducer 应用到 VisualAgent，再由 OfficeStore 决策是否触发移动动画或会议编排，最终驱动渲染层更新。

```mermaid
sequenceDiagram
participant GW as "Gateway 事件"
participant EP as "事件解析器"
participant AR as "agent-reducer"
participant OS as "OfficeStore"
participant MM as "meeting-manager"
participant AA as "AgentAvatar"
participant CL as "ConnectionLine"
GW->>EP : 解析事件载荷
EP-->>AR : ParsedAgentEvent
AR-->>OS : 更新 VisualAgent 状态
OS->>OS : 计算全局指标/事件历史
OS->>MM : 检测协作组/会议编排
OS->>AA : 触发移动动画/状态更新
OS->>CL : 更新协作连线强度
AA-->>OS : tickMovement 驱动插值
CL-->>OS : 渲染连线
```

图表来源
- [event-parser.ts:17-60](file://src/gateway/event-parser.ts#L17-L60)
- [agent-reducer.ts:19-67](file://src/store/agent-reducer.ts#L19-L67)
- [office-store.ts:762-820](file://src/store/office-store.ts#L762-L820)
- [meeting-manager.ts:32-135](file://src/store/meeting-manager.ts#L32-L135)
- [AgentAvatar.tsx:46-95](file://src/components/office-2d/AgentAvatar.tsx#L46-L95)
- [ConnectionLine.tsx:9-53](file://src/components/office-2d/ConnectionLine.tsx#L9-L53)

## 详细组件分析

### 智能体状态管理架构
- VisualAgent 字段族：包含 id、name、status、position、currentTool、speechBubble、lastActiveAt、toolCallCount、toolCallHistory、runId、isSubAgent、isPlaceholder、parentAgentId、childAgentIds、zone、originalPosition、movement、confirmed、arrivedAtHotDeskAt、pendingRetire、arrivedAtMeetingAt、manualMeeting。
- 生命周期管理：processAgentEvent 负责解析事件流，agent-reducer.applyEventToAgent 将状态变更应用到 VisualAgent；OfficeStore.updateAgent 提供外部更新能力。
- 状态转换逻辑：根据事件流类型（lifecycle、tool、assistant、error、item、plan、approval、command_output、patch、thinking、compaction）设置状态、工具、语音气泡、计数与历史记录；使用延迟空闲机制确保短暂状态的可见性。

```mermaid
flowchart TD
Start(["事件到达"]) --> Parse["解析事件流"]
Parse --> Apply["应用到 VisualAgent"]
Apply --> StatusCheck{"状态是否活跃？"}
StatusCheck --> |是| Update["更新 lastActiveAt 并保持状态"]
StatusCheck --> |否且为 idle| Deferred{"是否处于最小展示期？"}
Deferred --> |是| Schedule["调度延迟空闲"]
Deferred --> |否| SetIdle["设置为 idle"]
Update --> Metrics["更新全局指标"]
SetIdle --> Metrics
Schedule --> Metrics
Metrics --> End(["完成"])
```

图表来源
- [event-parser.ts:17-60](file://src/gateway/event-parser.ts#L17-L60)
- [agent-reducer.ts:19-67](file://src/store/agent-reducer.ts#L19-L67)
- [metrics-reducer.ts:3-27](file://src/store/metrics-reducer.ts#L3-L27)

章节来源
- [types.ts:166-193](file://src/gateway/types.ts#L166-L193)
- [agent-reducer.ts:19-67](file://src/store/agent-reducer.ts#L19-L67)
- [office-store.ts:762-820](file://src/store/office-store.ts#L762-L820)

### 协作关系维护机制
- CollaborationLink 设计：包含 sourceId、targetId、sessionKey、strength、lastActivityAt、isPeer 标记，支持按会话键聚合协作强度。
- agent-to-agent 配置：AgentToAgentConfig 支持启用/允许列表，影响协作组检测与会议编排范围。
- 协作热力图计算：computeMetrics 基于非占位且已确认智能体的活跃比例计算 collaborationHeat，作为全局热力图指标。

```mermaid
classDiagram
class CollaborationLink {
+string sourceId
+string targetId
+string sessionKey
+number strength
+number lastActivityAt
+boolean isPeer
}
class OfficeStore {
+links : CollaborationLink[]
+agentToAgentConfig : AgentToAgentConfig
+globalMetrics : GlobalMetrics
+processAgentEvent(event)
+updateMetrics()
}
class MeetingManager {
+detectMeetingGroups(links, agents, allowList)
+calculateMeetingSeats(group, tableIndex)
+applyMeetingGathering(agents, groups, moveToMeeting, returnFromMeeting, schedule?)
}
OfficeStore --> CollaborationLink : "维护"
OfficeStore --> MeetingManager : "调用"
```

图表来源
- [types.ts:200-208](file://src/gateway/types.ts#L200-L208)
- [types.ts:261-264](file://src/gateway/types.ts#L261-L264)
- [metrics-reducer.ts:3-27](file://src/store/metrics-reducer.ts#L3-L27)
- [meeting-manager.ts:32-135](file://src/store/meeting-manager.ts#L32-L135)

章节来源
- [types.ts:200-208](file://src/gateway/types.ts#L200-L208)
- [types.ts:261-264](file://src/gateway/types.ts#L261-L264)
- [metrics-reducer.ts:3-27](file://src/store/metrics-reducer.ts#L3-L27)
- [meeting-manager.ts:32-135](file://src/store/meeting-manager.ts#L32-L135)

### 2D 办公室渲染状态管理
- AgentAvatar 组件状态：根据 VisualAgent 的 status、movement、selected、placeholder/unconfirmed 等状态决定颜色、动画、标签与交互行为；通过 requestAnimationFrame 驱动 tickMovement 插值，实现行走的 bob 与坐起/坐下过渡效果。
- ConnectionLine 连线状态：根据协作强度绘制虚线/实线、脉冲/流动动画、阴影与透明度，强连接使用 dash-flow 动画，弱连接使用 pulse 动画。
- 移动动画状态：OfficeStore.startMovement 计算路径与持续时间，tickMovement/completeMovement 驱动进度插值，到达目标后更新 zone 与 position，并触发退休/返回逻辑。

```mermaid
sequenceDiagram
participant OS as "OfficeStore"
participant AA as "AgentAvatar"
participant MA as "movement-animator"
participant DOM as "SVG"
OS->>AA : 传入 VisualAgent
AA->>AA : 计算 transform/opacity/radius
AA->>OS : tickMovement(agentId, delta)
OS->>MA : interpolatePathPosition(path, progress)
MA-->>OS : 当前位置
OS-->>AA : 更新 position/movement
AA->>DOM : 重绘头像与状态环
```

图表来源
- [AgentAvatar.tsx:46-95](file://src/components/office-2d/AgentAvatar.tsx#L46-L95)
- [movement-animator.ts:132-159](file://src/lib/movement-animator.ts#L132-L159)
- [office-store.ts:504-580](file://src/store/office-store.ts#L504-L580)

章节来源
- [AgentAvatar.tsx:15-254](file://src/components/office-2d/AgentAvatar.tsx#L15-L254)
- [ConnectionLine.tsx:9-53](file://src/components/office-2d/ConnectionLine.tsx#L9-L53)
- [movement-animator.ts:85-159](file://src/lib/movement-animator.ts#L85-L159)
- [office-store.ts:504-580](file://src/store/office-store.ts#L504-L580)

### 位置分配算法
- allocatePosition：主 Agent 基于 agentId 哈希在固定工位网格中选择稳定位置；若满员则回退到临时工位区域；子 Agent 直接分配至临时工位。
- allocateMeetingPositions：围绕会议桌中心按等角分布计算座位坐标，考虑 2D/3D 缩放。
- calculateLoungePositions：预设休息区锚点，保证子 Agent 占位与视觉舒适度。
- calculateDeskSlots：水平优先布局，自动计算列数与行列分布，适配最小工位宽度。

```mermaid
flowchart TD
A["输入: agentId, isSubAgent, occupied"] --> B{"是否为主 Agent？"}
B --> |是| C["哈希定位 desk 区域"]
B --> |否| D["遍历 hotDesk 位置"]
C --> E{"desk 是否有空位？"}
E --> |是| F["返回 desk 位置"]
E --> |否| G["返回 hotDesk 位置"]
D --> H{"hotDesk 是否有空位？"}
H --> |是| F
H --> |否| I["回退到 zone 边缘随机偏移"]
```

图表来源
- [position-allocator.ts:51-82](file://src/lib/position-allocator.ts#L51-L82)
- [position-allocator.ts:84-101](file://src/lib/position-allocator.ts#L84-L101)
- [position-allocator.ts:173-190](file://src/lib/position-allocator.ts#L173-L190)
- [position-allocator.ts:131-159](file://src/lib/position-allocator.ts#L131-L159)

章节来源
- [position-allocator.ts:51-82](file://src/lib/position-allocator.ts#L51-L82)
- [position-allocator.ts:84-101](file://src/lib/position-allocator.ts#L84-L101)
- [position-allocator.ts:173-190](file://src/lib/position-allocator.ts#L173-L190)
- [position-allocator.ts:131-159](file://src/lib/position-allocator.ts#L131-L159)

### 事件历史记录机制
- EVENT_HISTORY_LIMIT：限制事件历史数量，避免内存膨胀。
- EventHistoryItem：包含时间戳、agentId/name、stream、summary、runId/fullText/itemId 等，支持按 run 与 item 合并。
- 调试与监控：OfficeStore.initEventHistory 与本地持久化配合，支持事件查询与清理；测试覆盖事件上限与合并行为。

```mermaid
flowchart TD
EH["事件历史"] --> Limit{"长度是否超过限制？"}
Limit --> |是| Trim["截断旧记录"]
Limit --> |否| Keep["保留"]
EH --> Persist["IndexedDB 持久化"]
Persist --> Cleanup["定期清理过期事件"]
```

图表来源
- [office-store.ts:39](file://src/store/office-store.ts#L39)
- [types.ts:210-222](file://src/gateway/types.ts#L210-L222)
- [local-persistence.ts:217-271](file://src/lib/local-persistence.ts#L217-L271)

章节来源
- [office-store.ts:39](file://src/store/office-store.ts#L39)
- [types.ts:210-222](file://src/gateway/types.ts#L210-L222)
- [local-persistence.ts:217-271](file://src/lib/local-persistence.ts#L217-L271)
- [office-store.test.ts:193-210](file://src/store/__tests__/office-store.test.ts#L193-L210)

## 依赖关系分析
- OfficeStore 依赖：
  - 类型与常量：types.ts、constants.ts
  - 算法：position-allocator.ts、movement-animator.ts
  - 事件解析：event-parser.ts
  - 指标：metrics-reducer.ts
  - 子模块：agent-reducer.ts、meeting-manager.ts
  - 渲染：AgentAvatar.tsx、ConnectionLine.tsx
  - 持久化：local-persistence.ts

```mermaid
graph LR
OS["OfficeStore"] --> T["types.ts"]
OS --> C["constants.ts"]
OS --> PA["position-allocator.ts"]
OS --> MA["movement-animator.ts"]
OS --> EP["event-parser.ts"]
OS --> MR["metrics-reducer.ts"]
OS --> AR["agent-reducer.ts"]
OS --> MM["meeting-manager.ts"]
OS --> AA["AgentAvatar.tsx"]
OS --> CL["ConnectionLine.tsx"]
OS --> LP["local-persistence.ts"]
```

图表来源
- [office-store.ts:8-37](file://src/store/office-store.ts#L8-L37)
- [types.ts:166-222](file://src/gateway/types.ts#L166-L222)
- [constants.ts:23-141](file://src/lib/constants.ts#L23-L141)
- [position-allocator.ts:1-13](file://src/lib/position-allocator.ts#L1-L13)
- [movement-animator.ts:1-5](file://src/lib/movement-animator.ts#L1-L5)
- [event-parser.ts:1-5](file://src/gateway/event-parser.ts#L1-L5)
- [metrics-reducer.ts:1-2](file://src/store/metrics-reducer.ts#L1-L2)
- [agent-reducer.ts:1-3](file://src/store/agent-reducer.ts#L1-L3)
- [meeting-manager.ts:1-3](file://src/store/meeting-manager.ts#L1-L3)
- [AgentAvatar.tsx:1-6](file://src/components/office-2d/AgentAvatar.tsx#L1-L6)
- [ConnectionLine.tsx:1-7](file://src/components/office-2d/ConnectionLine.tsx#L1-L7)
- [local-persistence.ts:1-4](file://src/lib/local-persistence.ts#L1-L4)

章节来源
- [office-store.ts:8-37](file://src/store/office-store.ts#L8-L37)

## 性能考虑
- 状态不可变与批量更新：使用 Immer 中间件，减少样板代码与深拷贝开销。
- 动画驱动：AgentAvatar 使用 requestAnimationFrame，仅在存在移动时启动循环，避免不必要的重绘。
- 路径与插值：movement-animator 对路径长度与速度进行限制，保证动画流畅与可预测。
- 位置分配：allocatePosition 基于哈希与网格，避免复杂搜索；calculateLoungePositions 预设锚点，降低动态计算成本。
- 事件历史：限制长度与定期清理，避免内存泄漏。
- 指标计算：computeMetrics 在状态变更后增量计算，避免全量扫描。

## 故障排查指南
- 事件未生效：检查 event-parser 是否正确识别 stream 与 phase；确认 agent-reducer.applyEventToAgent 是否更新状态与计数。
- 移动异常：验证 startMovement 是否生成有效 path；检查 tickMovement/completeMovement 是否正确更新 zone 与 position。
- 会议未触发：确认 CollaborationLink 强度阈值与 allowList；检查 detectMeetingGroups 是否过滤了子 Agent。
- 事件历史过多：确认 EVENT_HISTORY_LIMIT 与本地持久化清理策略；必要时手动清理过期事件。
- 子 Agent 退休问题：检查 pendingRetire 与最小停留时间；确认 Lounge 退休流程是否触发 removeSubAgent。

章节来源
- [event-parser.ts:17-60](file://src/gateway/event-parser.ts#L17-L60)
- [agent-reducer.ts:19-67](file://src/store/agent-reducer.ts#L19-L67)
- [office-store.ts:504-580](file://src/store/office-store.ts#L504-L580)
- [meeting-manager.ts:32-135](file://src/store/meeting-manager.ts#L32-L135)
- [local-persistence.ts:275-306](file://src/lib/local-persistence.ts#L275-L306)

## 结论
Office Store 通过清晰的分层设计与确定性算法，实现了从事件到可视化的完整闭环。VisualAgent 与 OfficeStore 的协同、协作关系与会议编排的解耦、以及渲染层的高效动画，共同构成了可扩展、可观测、可维护的 2D 办公室智能体系统。

## 附录
- 状态持久化策略：使用 IndexedDB（local-persistence.ts）缓存聊天消息、事件历史与会话信息，支持按天清理与配额阈值保护。
- 性能优化技巧：批量更新、按需动画、路径限制、预设锚点、指标缓存。
- 内存管理最佳实践：限制事件历史长度、及时清理定时器与占位符、避免重复订阅与冗余渲染。