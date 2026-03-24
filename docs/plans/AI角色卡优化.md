# AI 角色卡对话功能升级 - 命理倾听与安慰

## 1. 需求概述

### 1.1 目标
为每个角色卡添加类似"小树洞"的功能，让用户可以：
- 向角色卡倾诉心事
- 获取基于命盘的分析和建议
- 收到以角色性格、口吻表达的安慰和开导

### 1.2 核心差异
| 功能 | 小树洞 | 升级后的角色卡 |
|------|--------|----------------|
| 角色 | 心理咨询师（固定） | 角色卡本人（动态） |
| 输出风格 | 专业心理咨询语言 | 角色卡的性格、口吻 |
| 关系 | 陌生人/咨询师 | 家人/朋友/特定关系 |
| 命理分析 | 隐藏术语 | 隐藏术语，以角色视角表达 |

### 1.3 使用场景
- 用户愿意对亲人倾诉多过使用小树洞
- 用户希望获得更亲近的安慰方式
- 用户希望角色卡能"懂"自己的命理运势

---

## 2. LangGraph 流程设计（最终完整版）

### 2.1 流程图

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                        AI 角色卡对话流程 V3（最终完整版）                            │
├───────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  ┌───────────────────────┐                                                       │
│  │   intent_classifier   │ ← 【合并节点】意图分类 + 结束检测                        │
│  │     (1次 LLM)         │   - 输出: intent, endIntent, confidence                │
│  └───────────┬───────────┘                                                       │
│              │                                                                     │
│              ▼                                                                     │
│  ┌───────────────────────┐                                                       │
│  │    token_monitor      │ ← Token 监控（保留）                                    │
│  │     (无 LLM)          │   - 检测 60%/70% 阈值                                   │
│  └───────────┬───────────┘   - 触发疲劳提示/强制离线                               │
│              │                                                                     │
│        ┌─────┴─────┐                                                               │
│        │           │                                                               │
│        ▼           ▼                                                               │
│    [普通聊天]    [倾诉模式]                                                          │
│        │           │                                                               │
│        │           │                                                               │
│ ╔══════╧══════╗    │                                                               │
│ ║ 普通聊天分支 ║    │    ╔═══════════════════════════════════════════════════════╗ │
│ ╚══════╤══════╝    │    ║                    倾诉-倾听分支                        ║ │
│        │           │    ╚═══════════════════════════════════════════════════════╝ │
│        ▼           │                                                               │
│  ┌─────────────┐   │    ┌─────────────────────┐                                    │
│  │memory_check │   │    │  listening_phase     │ ← 【合并节点】倾听 + 分析判断       │
│  │  (1次 LLM)  │   │    │    (1次 LLM)        │   - 共情回复                        │
│  └──────┬──────┘   │    └──────────┬──────────┘   - 判断: 继续倾听 / 进入分析       │
│         │          │               │                                               │
│    ┌────┴────┐     │          ┌────┴────┐                                          │
│    │         │     │          │         │                                          │
│ 涉及记忆  不涉及记忆  │       继续倾听   进入分析                                       │
│    │         │     │          │         │                                          │
│    ▼         │     │          │         ▼                                          │
│ ┌─────────┐  │     │          │  ┌─────────────────────┐                            │
│ │rag_     │  │     │          │  │chart_rag_retriever  │ ← 【合并节点】命盘+RAG检索   │
│ │retriever│  │     │          │  │   (无 LLM, 并行)    │                            │
│ │(无LLM)  │  │     │          │  └──────────┬──────────┘                            │
│ └────┬────┘  │     │          │             │                                       │
│      │       │     │          │             ▼                                       │
│      └───┬───┘     │          │  ┌─────────────────────┐                            │
│          │         │          │  │ fortune_generator   │ ← 命理分析（内部）          │
│          ▼         │          │  │    (1次 LLM)        │                            │
│  ┌───────────────┐ │          │  └──────────┬──────────┘                            │
│  │context_builder│ │          │             │                                       │
│  │   (无 LLM)    │ │          │             ▼                                       │
│  └───────┬───────┘ │          │  ┌─────────────────────┐                            │
│          │         │          │  │  role_translator    │ ← 【核心】转换为角色口吻     │
│          ▼         │          │  │    (1次 LLM)        │   - 可配置隐藏/显示命理术语  │
│  ┌───────────────┐ │          │  └──────────┬──────────┘                            │
│  │response_      │ │          │             │                                       │
│  │generator      │ │          └─────────────┴───────────────────────────────────────┤
│  │  (1次 LLM)    │ │                                    │                             │
│  └───────┬───────┘ │                                    │                             │
│          │         │                                    │                             │
│          └─────────┴────────────────────────────────────┘                             │
│                                │                                                     │
│                                ▼                                                     │
│                     ┌─────────────────────┐                                          │
│                     │  output_formatter   │ ← 输出格式化                              │
│                     └─────────────────────┘                                          │
│                                                                                   │
│  【Token 阈值触发】                                                                 │
│  ├─ 60%: showFatiguePrompt=true → 前端显示疲劳提示对话框                              │
│  └─ 70%: forceOffline=true → 保存记忆 + 开启新周期                                    │
│                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.2 节点完整列表

| 节点 | 类型 | 功能说明 | LLM调用 | 分支 |
|------|------|----------|---------|------|
| `intent_classifier` | 开始+条件 | **合并节点**：意图分类（倾诉/聊天）+ 结束检测 | **1次** | 通用 |
| `token_monitor` | 处理 | Token 使用量监控，触发60%/70%阈值 | **否** | 通用 |
| `memory_check` | 条件 | 分析用户消息是否涉及回忆/需要检索记忆 | **1次** | 普通聊天 |
| `rag_retriever` | 处理 | 检索角色卡的记忆库（涉及记忆时） | **否** | 普通聊天 |
| `context_builder` | 处理 | 整合角色卡+记忆+对话历史+当前消息 | **否** | 普通聊天 |
| `response_generator` | 处理 | 生成普通回复 | **1次** | 普通聊天 |
| `listening_phase` | 处理+条件 | **合并节点**：倾听回复 + 判断是否进入分析 | **1次** | 倾诉 |
| `chart_rag_retriever` | 处理 | **合并节点**：并行获取命盘数据 + 命理RAG知识 | **否** | 倾诉-分析 |
| `fortune_generator` | 处理 | 生成内部命理分析报告（用户不直接看到） | **1次** | 倾诉-分析 |
| `role_translator` | 处理 | **核心节点**：将分析转换为角色口吻 | **1次** | 倾诉-分析 |
| `output_formatter` | 结束 | 格式化输出 | **否** | 通用 |

---

### 2.3 流程分支详解

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 普通聊天分支（保留现有流程）                                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  intent_classifier → token_monitor → memory_check                       │
│                                                                         │
│                         ┌──────────────┬──────────────┐                │
│                         │              │              │                │
│                      涉及记忆        不涉及记忆                          │
│                         │              │                              │
│                         ▼              │                              │
│                   rag_retriever        │                              │
│                         │              │                              │
│                         └──────┬───────┘                              │
│                                │                                       │
│                                ▼                                       │
│                        context_builder                                 │
│                                │                                       │
│                                ▼                                       │
│                       response_generator                               │
│                                │                                       │
│                                ▼                                       │
│                        output_formatter                                │
│                                                                         │
│  LLM调用: intent_classifier(1) + memory_check(1) + response_generator(1)│
│         = 2~3次（memory_check 是1次 LLM）                               │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ 倾诉-倾听分支（新增流程）                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  intent_classifier → token_monitor → listening_phase (循环)             │
│                                                                         │
│                         ┌──────────────┬──────────────┐                │
│                         │              │              │                │
│                      继续倾听        进入分析                            │
│                         │              │                              │
│                         │              ▼                              │
│                         │    chart_rag_retriever                      │
│                         │              │                              │
│                         │              ▼                              │
│                         │    fortune_generator                        │
│                         │              │                              │
│                         │              ▼                              │
│                         │    role_translator                          │
│                         │              │                              │
│                         └──────────────┴──────────────┐               │
│                                │                                       │
│                                ▼                                       │
│                        output_formatter                                │
│                                                                         │
│  每轮倾听: intent_classifier(1) + listening_phase(1) = 2次              │
│  分析阶段: fortune_generator(1) + role_translator(1) = 额外 2次         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 2.4 LLM 调用次数汇总

| 场景 | LLM调用次数 | 说明 |
|------|-------------|------|
| **普通聊天（不涉及记忆）** | **2次** | intent_classifier + response_generator |
| **普通聊天（涉及记忆）** | **3次** | intent_classifier + memory_check + response_generator |
| **倾诉-倾听（每轮）** | **2次** | intent_classifier + listening_phase |
| **倾诉-分析阶段** | **额外 2次** | fortune_generator + role_translator |

---

## 3. 核心节点设计

### 3.1 intent_classifier（意图分类器）

**功能**：
1. 判断用户消息意图（倾诉/普通聊天）
2. 检测是否结束对话

**输出 JSON**：
```json
{
  "intent": "venting" | "chatting",
  "confidence": 0.0-1.0,
  "emotionalIntensity": "low" | "medium" | "high",
  "endIntent": boolean,
  "coreConcern": "核心关注点（如果是倾诉）"
}
```

**判断标准**：
- `venting`（倾诉）：表达负面情绪、困扰、心事
- `chatting`（普通聊天）：日常问候、闲聊
- `endIntent`（结束意图）：用户说再见、要去忙了、下次聊等

---

### 3.2 memory_check（记忆检查）- 保留现有节点

**功能**：分析用户消息是否涉及回忆/需要检索记忆

**输出 JSON**：
```json
{
  "involvesMemory": boolean,
  "memoryKeywords": ["关键词1", "关键词2"]
}
```

**判断标准**：
- **需要检索**：询问过去的事件/经历、提及需要历史上下文的话题
- **不需要检索**：当前状态/问候、日常闲聊

---

### 3.3 listening_phase（倾听阶段）

**功能**：
1. 以角色身份倾听用户
2. 表达共情和理解
3. **同时判断**是否准备好进入分析

**输出 JSON**：
```json
{
  "response": "角色的回复",
  "readyForAnalysis": boolean,
  "coreConcern": "核心关注点",
  "emotionalState": "用户当前情绪状态"
}
```

**回复要求**：
- 用第一人称"我"说话
- 根据关系调整语气
- **绝对不使用**命理、算命词汇
- 回复温暖、自然，2-4句话

---

### 3.4 chart_rag_retriever（命盘+RAG 检索器）

**功能**：并行获取命盘数据和命理RAG知识

**实现方式**：
```javascript
async function chartRagRetrieverNode(state) {
  // 并行执行两个检索
  const [chartData, ragResults] = await Promise.all([
    getChartData(state.userId),    // 命盘数据（复用 ziwei 模块）
    ragSearch(state.coreConcern)   // RAG 检索命理知识（复用 ziweiRag）
  ]);

  state.chartData = chartData;
  state.ragContext = ragResults;
  return state;
}
```

---

### 3.5 fortune_generator（命理分析生成器）

**功能**：生成内部命理分析报告（用户不直接看到）

**输出内容**：
1. 核心问题分析
2. 运势解读
3. 建议方向

**注意**：这是内部分析，用户不会直接看到，后续会通过 role_translator 转换为角色口吻。

---

### 3.6 role_translator（角色口吻转换器）- **核心节点**

**功能**：将命理分析报告转换为角色卡的性格、口吻

**配置开关**（管理后台可调）：

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `hideFortuneTerms` | Boolean | `true` | 是否隐藏命理术语 |

**两种输出模式**：

| 模式 | hideFortuneTerms | 效果 |
|------|------------------|------|
| **隐藏命理**（默认） | `true` | 角色口吻，隐藏术语 |
| **显示命理** | `false` | 角色+算命师口吻 |

**转换示例（隐藏命理模式）**：
```
"命宫坐紫微星，主贵显" → "我看得出来，你是个有追求的孩子"
"流年事业宫见武曲星" → "我觉得你最近事业上会有转机"
"感情运势不佳" → "感情的事，我觉得你可以再等等，不用着急"
```

**转换示例（显示命理模式）**：
```
"命宫坐紫微星，主贵显" → "我看了你的命盘，紫微星坐命宫，说明你天生就有领导才能"
"流年事业宫见武曲星" → "从你的流年来看，事业宫有武曲星，今年工作会有好机会"
```

---

## 4. 管理后台配置

### 4.1 节点配置扩展

在 `langgraph/model.js` 的 `nodeSchema` 中添加新字段：

```javascript
// 在 nodeSchema 中添加
hideFortuneTerms: {
  type: Boolean,
  default: true  // 默认隐藏命理术语
}
```

### 4.2 前端 NodeEditor 更新

在 `web/app/admin/langgraph/components/NodeEditor.tsx` 中为 `role_translator` 节点添加开关

---

## 5. 状态管理

### 5.1 ConversationState 扩展字段

```javascript
{
  // 现有字段...

  // 新增：倾诉模式相关
  conversationMode: 'chat' | 'venting' | 'analysis',  // 对话模式

  listeningPhase: {
    turnCount: 0,                    // 倾听轮次
    emotionalIntensity: 'low' | 'medium' | 'high',
    coreConcern: '',                 // 核心关注点
    emotionalState: '',              // 情绪状态
    informationGathered: {},         // 收集的信息
    readyForAnalysis: false          // 是否准备好分析
  },

  fortunePhase: {
    chartRetrieved: false,
    ragRetrieved: false,
    fortuneGenerated: false,
    internalAnalysis: ''              // 内部命理分析（不直接输出）
  }
}
```

---

## 6. 与现有代码的集成

### 6.1 修改文件

| 文件 | 修改内容 |
|------|----------|
| `chat/edges/edges.js` | 添加新的条件路由逻辑（intent_classifier, listening_phase） |
| `chat/orchestrator.js` | 添加新节点注册和流程控制 |
| `chat/state/ConversationState.js` | 添加新状态字段 |
| `langgraph/defaults/rolecard.js` | 更新节点和边定义 |
| `langgraph/model.js` | 添加 hideFortuneTerms 字段 |

### 6.2 新增文件

| 文件 | 说明 |
|------|------|
| `chat/nodes/intentClassifier.js` | 意图分类节点（合并版） |
| `chat/nodes/listeningPhase.js` | 倾听阶段节点（合并版） |
| `chat/nodes/chartRagRetriever.js` | 命盘+RAG 检索节点（合并版） |
| `chat/nodes/fortuneGenerator.js` | 命理分析生成节点 |
| `chat/nodes/roleTranslator.js` | 角色口吻转换节点 |

### 6.3 复用现有模块

| 模块 | 复用方式 |
|------|----------|
| `chat/nodes/memoryCheck.js` | **保留**：普通聊天的记忆检查 |
| `chat/nodes/ragRetriever.js` | **保留**：普通聊天的记忆检索 |
| `chat/nodes/contextBuilder.js` | **保留**：普通聊天的上下文构建 |
| `chat/nodes/responseGenerator.js` | **保留**：普通聊天的回复生成 |
| `ziwei/ziweiService.js` | 复用：获取用户命盘数据 |
| `ziwei/ziweiLlm.js` | 复用：生成命理分析报告 |
| `ziwei/ziweiRag.js` | 复用：RAG 检索命理知识 |
| `rolecard/v2/promptAssembler.js` | 复用：组装角色卡提示词 |

---

## 7. 实施计划

### Phase 1: 基础架构（预计 1-2 天）
- [ ] 更新 edges.js 路由逻辑
- [ ] 扩展 ConversationState
- [ ] 更新 rolecard.js 默认配置
- [ ] 更新 model.js 添加 hideFortuneTerms 字段

### Phase 2: 核心功能（预计 2-3 天）
- [ ] 实现 intentClassifier 节点
- [ ] 实现 listeningPhase 节点
- [ ] 实现 chartRagRetriever 节点
- [ ] 实现 fortuneGenerator 节点
- [ ] 实现 roleTranslator 节点

### Phase 3: 管理后台（预计 1 天）
- [ ] 更新 NodeEditor 添加 hideFortuneTerms 开关
- [ ] 测试开关功能

### Phase 4: 集成测试（预计 1-2 天）
- [ ] 端到端流程测试
- [ ] 角色口吻转换效果测试
- [ ] 边界情况处理

---

## 8. 已确认事项

| 事项 | 决策 | 说明 |
|------|------|------|
| **倾诉触发条件** | 自动检测（LLM分析） | 不使用词表库映射，由 intent_classifier 节点通过 LLM 分析用户意图 |
| **分析阶段阈值** | 由 LLM 判断 | 基于收集的信息完整度和情绪状态判断，见下方判断标准 |
| **无命盘用户** | 倾听模式 + 提示 | 只进行倾听安慰，不进行命理分析，同时在聊天框提示用户填写资料 |
| **hideFortuneTerms 默认值** | `true` | 默认隐藏命理术语，以纯角色口吻输出 |

### 8.1 进入分析阶段的判断标准（LLM 评估）

当满足以下条件时，LLM 应将 `readyForAnalysis` 设为 `true`：

**信息收集标准：**
- 用户已表达核心困扰/问题
- 用户已分享足够的背景信息（至少2-3轮有效对话）
- 用户情绪状态趋于稳定或准备好接受建议

**判断示例：**
```
✅ 可以进入分析：
- 用户: "我最近工作压力很大，老板总是给我加任务..."
- 用户: "我已经这样半年了，感觉快撑不住了..."
- 用户: "你说我该怎么办呢？" （主动寻求建议）

❌ 继续倾听：
- 用户: "我今天心情不好..."
- 用户: "就是觉得很累" （信息不充分，需要继续引导）
```

**输出字段：**
```json
{
  "readyForAnalysis": boolean,
  "confidence": 0.0-1.0,
  "coreConcern": "核心关注点",
  "emotionalState": "情绪状态",
  "informationGathered": {
    "mainIssue": "主要问题",
    "duration": "持续时间",
    "impact": "影响程度",
    "userGoal": "用户期望"
  }
}
```

### 8.2 无命盘用户处理流程

```
用户进入倾诉模式
       │
       ▼
检测用户是否有命盘数据
       │
   ┌───┴───┐
   │       │
  有       无
   │       │
   ▼       ▼
正常流程  listening_phase → 检测无命盘
         │
         ▼
         在回复中添加提示：
         "对了，如果你愿意告诉我你的出生时间，
          我可以帮你从另一个角度看看这个问题~"
         │
         ▼
         继续倾听，不进入分析阶段
```

---

*文档版本: v3.1（确认版）*
*更新时间: 2026-03-11*
