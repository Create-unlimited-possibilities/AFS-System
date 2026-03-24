# AI角色卡对话 - 算命预测分支规划

> 创建日期: 2026-03-25
> 状态: ✅ 已实现

## 1. 需求概述

在现有 AI 角色卡对话的 LangGraph 流程中，新增"算命预测"分支。

### 1.1 核心功能

| 功能 | 描述 |
|------|------|
| 意图识别 | 识别用户是否要求算命（"帮我算一算"、"能算命吗"） |
| 分支开关 | 管理员可控制此分支是否启用 |
| 命盘检索 | 复用现有 `chart_rag_retriever` 节点 |
| 命理分析 | 复用现有 `fortune_generator` 节点 |
| 角色输出 | 以角色卡语气输出，**不隐藏命理术语** |

### 1.2 与现有"倾诉-倾听"分支的区别

| 对比项 | 倾诉-倾听分支 | 算命预测分支 |
|--------|--------------|-------------|
| 触发条件 | 用户表达负面情绪、倾诉烦恼 | 用户直接要求算命 |
| 倾听阶段 | 有（多轮倾听） | 无（直接进入分析） |
| 输出方式 | 隐藏命理术语 | **不隐藏**，直接以角色口吻输出 |

## 2. 现有代码结构

### 2.1 流程图

```
                      ┌─────────────────┐
                      │ intent_classifier│
                      └────────┬────────┘
                               │
                      ┌────────▼────────┐
                      │  token_monitor  │
                      └────────┬────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
   [普通聊天]            [倾诉模式]           [算命预测] ← 新增
          │                    │                    │
          ▼                    ▼                    ▼
   memory_check         listening_phase      chart_rag_retriever
          │                    │                    │
          ▼                    │                    ▼
   (现有流程...)              │             fortune_generator
                               │                    │
                      ┌────────▼────────┐           │
                      │chart_rag_retriever│◄─────────┘
                      └────────┬────────┘
                               │
                      ┌────────▼────────┐
                      │fortune_generator │
                      └────────┬────────┘
                               │
                      ┌────────▼────────┐
                      │ role_translator │
                      └────────┬────────┘
                               │
                      ┌────────▼────────┐
                      │output_formatter │
                      └─────────────────┘
```

### 2.2 关键文件

| 文件 | 用途 |
|------|------|
| `orchestrator.js` | LangGraph 编排器，定义节点和执行流程 |
| `edges/edges.js` | 边定义和条件路由函数 |
| `nodes/intentClassifier.js` | 意图分类节点 |
| `nodes/chartRagRetriever.js` | 命盘检索节点 |
| `nodes/fortuneGenerator.js` | 命理分析节点 |
| `nodes/roleTranslator.js` | 角色口吻转换节点 |
| `langgraph/defaults/rolecard.js` | 默认配置 |
| `langgraph/model.js` | 配置数据模型 |

## 3. 实现方案

### 3.1 修改意图分类节点

**文件**: `server/src/modules/chat/nodes/intentClassifier.js`

新增 `fortune_telling` 意图类型：

```javascript
// 意图类型扩展
// "venting" - 倾诉模式（负面情绪、寻求安慰）
// "chatting" - 普通聊天
// "fortune_telling" - 算命预测（新增）

const INTENT_CLASSIFICATION_PROMPT = `...
判断标准：
1. intent (意图):
   - "fortune_telling": 用户要求算命、预测、看运势（如"帮我算算"、"能算命吗"）
   - "venting": 用户表达负面情绪、寻求安慰、倾诉烦恼
   - "chatting": 日常闲聊、分享趣事、中性/正面交流
...`;
```

### 3.2 修改边路由

**文件**: `server/src/modules/chat/edges/edges.js`

```javascript
export function routeByIntent(state) {
  const intent = state.metadata?.intent;

  // 结束意图
  if (state.metadata?.endIntent) {
    return 'token_response';
  }

  // 算命预测分支（新增）- 检查开关
  if (intent === 'fortune_telling') {
    const fortuneEnabled = state.metadata?.fortuneTellingEnabled ?? true;
    if (fortuneEnabled) {
      return 'chart_rag_retriever';  // 直接进入命盘检索
    }
    // 如果禁用，回退到普通聊天
    return 'memory_check';
  }

  // 倾诉模式
  if (intent === 'venting') {
    return 'listening_phase';
  }

  // 普通聊天
  return 'memory_check';
}
```

### 3.3 修改角色口吻转换节点

**文件**: `server/src/modules/chat/nodes/roleTranslator.js`

魔改：移除隐藏命理术语开关，默认以角色卡语气输出

```javascript
// 算命预测分支调用时，设置 hideFortuneTerms = false
// 让角色以自身口吻直接说出命理内容

const ROLE_TRANSLATOR_PROMPT = `
你是${roleCardName}，现在需要用你的语气和口吻说出以下命理分析结果。
保持你的人物性格、说话习惯和情感表达方式。
直接将命理内容转化为你会说的话，不要刻意隐藏专业术语。
...`;
```

### 3.4 配置开关

**文件**: `server/src/modules/langgraph/defaults/rolecard.js`

在配置中新增分支开关：

```javascript
// 新增配置项
{
  flowSettings: {
    fortuneTellingEnabled: {
      type: Boolean,
      default: true,
      description: '是否启用算命预测分支'
    }
  }
}
```

### 3.5 状态传递

**文件**: `server/src/modules/chat/state/ConversationState.js`

新增状态字段：

```javascript
metadata: {
  // 现有字段...
  intent: String,  // 'chatting' | 'venting' | 'fortune_telling'

  // 新增字段
  fortuneTellingEnabled: Boolean,  // 算命分支开关
  fortuneBranchSource: String,     // 'venting' | 'direct' (来源)
}
```

## 4. 文件变更清单

### 4.1 修改文件

| 文件 | 修改内容 |
|------|---------|
| `server/src/modules/chat/nodes/intentClassifier.js` | 新增 `fortune_telling` 意图类型 |
| `server/src/modules/chat/edges/edges.js` | `routeByIntent` 新增算命分支路由 |
| `server/src/modules/chat/nodes/roleTranslator.js` | 新增参数控制是否隐藏命理术语 |
| `server/src/modules/langgraph/defaults/rolecard.js` | 新增 `fortuneTellingEnabled` 配置 |
| `server/src/modules/chat/state/ConversationState.js` | 新增状态字段 |
| `server/src/modules/chat/orchestrator.js` | 预加载时读取配置开关 |

### 4.2 前端（可选）

| 文件 | 修改内容 |
|------|---------|
| `web/app/admin/langgraph/page.tsx` | 新增算命分支开关 UI |

## 5. 测试用例

### 5.1 意图识别测试

| 用户输入 | 期望意图 |
|---------|---------|
| "帮我算算最近的运势" | `fortune_telling` |
| "你能算命吗" | `fortune_telling` |
| "看看我的事业运怎么样" | `fortune_telling` |
| "我最近工作压力好大" | `venting` |
| "今天天气不错" | `chatting` |

### 5.2 分支开关测试

| 开关状态 | 用户输入 | 期望行为 |
|---------|---------|---------|
| 启用 | "帮我算算" | 进入算命分支 |
| 禁用 | "帮我算算" | 进入普通聊天 |

### 5.3 输出测试

| 场景 | 期望输出 |
|------|---------|
| 算命预测分支 | 角色口吻 + 命理术语可见 |
| 倾诉-倾听分支 | 角色口吻 + 命理术语隐藏 |

## 6. 待确认问题

1. **开关位置**：算命分支开关放在哪里？
   - A. LangGraph 配置页面（推荐）
   - B. 角色卡配置
   - C. 用户设置

2. **算命分支是否需要倾听阶段**？
   - A. 直接进入分析（推荐）
   - B. 先倾听一轮再分析

3. **输出风格**：
   - A. 角色口吻 + 命理术语可见（推荐，用户要求）
   - B. 角色口吻 + 术语解释
   - C. 其他

---

**下一步**：确认上述问题后，开始实现。
