# AI角色卡对话功能升级 - 实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan.

**Goal:** 为AI角色卡对话添加倾诉模式与命理分析功能，让用户可以向角色卡倾诉并获得基于命盘的角色口吻安慰

**Architecture:** 基于 LangGraph 流程编排，新增 intent_classifier、listening_phase、chart_rag_retriever、fortune_generator、role_translator 节点，保留现有普通聊天流程

**Tech Stack:** Node.js, Express, LangGraph, MongoDB, Ollama LLM, React, Next.js, Tailwind CSS

---

## Files Structure

### Backend - 新增文件
```
server/src/modules/chat/
├── nodes/
│   ├── intentClassifier.js      # 意图分类（合并结束检测）
│   ├── listeningPhase.js        # 倾听阶段（合并分析判断）
│   ├── chartRagRetriever.js     # 命盘+RAG并行检索
│   ├── fortuneGenerator.js      # 命理分析生成
│   └── roleTranslator.js        # 角色口吻转换
└── state/
    └── ConversationState.js     # 扩展状态字段
```

### Backend - 修改文件
```
server/src/modules/chat/
├── edges/edges.js               # 添加新路由逻辑
├── orchestrator.js              # 注册新节点

server/src/modules/langgraph/
├── model.js                     # 添加 hideFortuneTerms 字段
├── defaults/rolecard.js         # 更新节点和边配置
```

### Frontend - 修改文件
```
web/app/admin/langgraph/
├── components/NodeEditor.tsx    # 添加 hideFortuneTerms 开关
├── components/FlowDiagram.tsx   # 更新流程图可视化
└── page.tsx                     # 更新页面逻辑
```

---

## Chunk 1: Backend 基础架构

### Task 1.1: 扩展 ConversationState 状态字段

**Files:**
- Modify: `server/src/modules/chat/state/ConversationState.js`

**新增字段:**
```javascript
// 在 constructor 中添加
this.conversationMode = initialData.conversationMode || 'chat'; // 'chat' | 'venting' | 'analysis'

this.listeningPhase = initialData.listeningPhase || {
  turnCount: 0,
  emotionalIntensity: 'low',
  coreConcern: '',
  emotionalState: '',
  informationGathered: {},
  readyForAnalysis: false
};

this.fortunePhase = initialData.fortunePhase || {
  chartRetrieved: false,
  ragRetrieved: false,
  fortuneGenerated: false,
  internalAnalysis: ''
};

this.conversationAssessment = initialData.conversationAssessment || {
  readyForAnalysis: false,
  confidence: 0,
  coreConcern: '',
  emotionalState: ''
};

this.natalChart = initialData.natalChart || null;
this.horoscope = initialData.horoscope || null;
this.ragContext = initialData.ragContext || '';
this.hideFortuneTerms = initialData.hideFortuneTerms !== undefined ? initialData.hideFortuneTerms : true;
```

**验证:**
- [ ] `node --check server/src/modules/chat/state/ConversationState.js`

---

### Task 1.2: 更新 edges.js 路由逻辑

**Files:**
- Modify: `server/src/modules/chat/edges/edges.js`

**新增路由函数:**
```javascript
/**
 * 根据意图分类路由
 */
export function routeByIntent(state) {
  const intent = state.metadata?.intent;

  if (state.metadata?.endIntent) {
    return 'token_response';
  }

  if (intent === 'venting') {
    return 'listening_phase';
  }

  return 'memory_check';
}

/**
 * 根据倾听阶段状态路由
 */
export function routeByListeningPhase(state) {
  if (state.metadata?.readyForAnalysis === true && state.natalChart) {
    return 'chart_rag_retriever';
  }
  return 'output_formatter';
}
```

**验证:**
- [ ] `node --check server/src/modules/chat/edges/edges.js`

---

### Task 1.3: 更新 model.js 添加 hideFortuneTerms 字段

**Files:**
- Modify: `server/src/modules/langgraph/model.js`

**在 nodeSchema 中添加:**
```javascript
// 在 llmConfig 之后添加
hideFortuneTerms: {
  type: Boolean,
  default: true
}
```

**验证:**
- [ ] `node --check server/src/modules/langgraph/model.js`

---

### Task 1.4: 更新 rolecard.js 默认配置

**Files:**
- Modify: `server/src/modules/langgraph/defaults/rolecard.js`

**新增节点配置（完整内容见设计文档）**

**验证:**
- [ ] `node --check server/src/modules/langgraph/defaults/rolecard.js`

---

## Chunk 2: Backend 核心节点实现

### Task 2.1: 实现 intentClassifier 节点

**Files:**
- Create: `server/src/modules/chat/nodes/intentClassifier.js`

**功能:**
1. 判断用户意图（venting/chatting）
2. 检测是否结束对话
3. 评估情绪强度

**Prompt 模板:**
```javascript
const INTENT_CLASSIFIER_PROMPT = `分析用户消息的意图和情绪状态。

【用户消息】
{currentInput}

【对话历史】
{history}

请输出JSON格式：
{
  "intent": "venting" | "chatting",
  "confidence": 0.0-1.0,
  "emotionalIntensity": "low" | "medium" | "high",
  "endIntent": boolean,
  "coreConcern": "核心关注点（如果是倾诉）"
}

判断标准：
- venting: 表达负面情绪、困扰、心事、寻求安慰
- chatting: 日常问候、闲聊、普通对话
- endIntent: 用户说再见、要去忙了、下次聊等`;
```

**验证:**
- [ ] `node --check server/src/modules/chat/nodes/intentClassifier.js`

---

### Task 2.2: 实现 listeningPhase 节点

**Files:**
- Create: `server/src/modules/chat/nodes/listeningPhase.js`

**功能:**
1. 以角色身份倾听用户
2. 表达共情和理解
3. 同时判断是否准备好进入分析
4. 检测用户是否有命盘数据

**Prompt 模板:**
```javascript
const LISTENING_PHASE_PROMPT = `你是一位温暖、善解人意的{roleName}（{relation}）。

【你的性格】
{personality}

【对话历史】
{history}

【用户最新消息】
{currentInput}

【用户是否有命盘】
{hasNatalChart}

请输出JSON格式：
{
  "response": "你的回复（2-4句话，温暖自然）",
  "readyForAnalysis": boolean,
  "confidence": 0.0-1.0,
  "coreConcern": "核心关注点",
  "emotionalState": "用户当前情绪状态",
  "informationGathered": {
    "mainIssue": "主要问题",
    "duration": "持续时间",
    "impact": "影响程度",
    "userGoal": "用户期望"
  }
}

回复要求：
- 用第一人称"我"说话
- 根据关系调整语气
- 绝对不使用命理、算命词汇
- 回复温暖、自然

进入分析阶段的判断标准：
- 用户已表达核心困扰/问题
- 用户已分享足够的背景信息（至少2-3轮有效对话）
- 用户主动寻求建议或问"怎么办"
- 用户情绪状态趋于稳定

如果用户没有命盘数据：
- 在回复末尾添加："对了，如果你愿意告诉我你的出生时间，我可以帮你从另一个角度看看这个问题~"
- readyForAnalysis 设为 false`;
```

**验证:**
- [ ] `node --check server/src/modules/chat/nodes/listeningPhase.js`

---

### Task 2.3: 实现 chartRagRetriever 节点

**Files:**
- Create: `server/src/modules/chat/nodes/chartRagRetriever.js`

**功能:**
并行获取命盘数据和命理RAG知识

**实现:**
```javascript
import { getNatalChart } from '../../ziwei/ziweiService.js';
import { searchZiweiKnowledge } from '../../ziwei/ziweiRag.js';

export async function chartRagRetrieverNode(state) {
  const userId = state.userId;
  const coreConcern = state.listeningPhase?.coreConcern || state.currentInput;

  // 并行执行
  const [chartData, ragResults] = await Promise.all([
    getNatalChart(userId),
    searchZiweiKnowledge(coreConcern)
  ]);

  state.natalChart = chartData;
  state.ragContext = ragResults;
  state.fortunePhase.chartRetrieved = !!chartData;
  state.fortunePhase.ragRetrieved = !!ragResults;

  return state;
}
```

**验证:**
- [ ] `node --check server/src/modules/chat/nodes/chartRagRetriever.js`

---

### Task 2.4: 实现 fortuneGenerator 节点

**Files:**
- Create: `server/src/modules/chat/nodes/fortuneGenerator.js`

**功能:**
生成内部命理分析报告（用户不直接看到）

**Prompt 模板:**
```javascript
const FORTUNE_GENERATOR_PROMPT = `你是一位专业的紫微斗数命理师。

【用户命盘信息】
{natalChart}

【相关命理知识】
{ragContext}

【用户问题】
{coreConcern}

【用户情绪状态】
{emotionalState}

请输出JSON格式的命理分析报告：
{
  "mainAnalysis": "核心问题分析",
  "fortuneAspects": ["运势维度1", "运势维度2"],
  "advice": "建议方向",
  "keyFactors": ["关键因素1", "关键因素2"]
}

注意：
- 这是内部分析，用户不会直接看到
- 后续会通过 role_translator 转换为角色口吻
- 专注于命理角度的分析`;
```

**验证:**
- [ ] `node --check server/src/modules/chat/nodes/fortuneGenerator.js`

---

### Task 2.5: 实现 roleTranslator 节点

**Files:**
- Create: `server/src/modules/chat/nodes/roleTranslator.js`

**功能:**
将命理分析转换为角色口吻

**Prompt 模板（隐藏命理模式 - hideFortuneTerms: true）:**
```javascript
const ROLE_TRANSLATOR_HIDDEN_PROMPT = `你是一位温暖的长者{roleName}（{relation}）。

【你的性格】
{personality}

【内部分析报告】
{internalAnalysis}

【用户问题】
{coreConcern}

请将分析报告转换为你的口吻，回复用户：

要求：
- 用第一人称"我"说话
- 隐藏所有命理术语
- 用生活化的语言表达
- 温暖、亲切、自然
- 2-4句话

转换示例：
"命宫坐紫微星，主贵显" → "我看得出来，你是个有追求的孩子"
"流年事业宫见武曲星" → "我觉得你最近事业上会有转机"`;
```

**Prompt 模板（显示命理模式 - hideFortuneTerms: false）:**
```javascript
const ROLE_TRANSLATOR_SHOWN_PROMPT = `你是一位温暖的长者{roleName}（{relation}），同时你学会了紫微斗数。

【你的性格】
{personality}

【内部分析报告】
{internalAnalysis}

【用户问题】
{coreConcern}

请以你的口吻回复用户，可以提及命理知识：

要求：
- 用第一人称"我"说话
- 可以自然地提及命理分析
- 用亲切的语气解释
- 温暖、自然
- 2-4句话

示例：
"命宫坐紫微星，主贵显" → "我看了你的命盘，紫微星坐命宫，说明你天生就有领导才能"`;
```

**验证:**
- [ ] `node --check server/src/modules/chat/nodes/roleTranslator.js`

---

### Task 2.6: 更新 orchestrator.js 注册新节点

**Files:**
- Modify: `server/src/modules/chat/orchestrator.js`

**新增导入和注册:**
```javascript
import { intentClassifierNode } from './nodes/intentClassifier.js';
import { listeningPhaseNode } from './nodes/listeningPhase.js';
import { chartRagRetrieverNode } from './nodes/chartRagRetriever.js';
import { fortuneGeneratorNode } from './nodes/fortuneGenerator.js';
import { roleTranslatorNode } from './nodes/roleTranslator.js';

// 在 constructor 的 this.nodes 中添加
this.nodes = {
  // ... 现有节点
  intent_classifier: intentClassifierNode,
  listening_phase: listeningPhaseNode,
  chart_rag_retriever: chartRagRetrieverNode,
  fortune_generator: fortuneGeneratorNode,
  role_translator: roleTranslatorNode
};
```

**验证:**
- [ ] `node --check server/src/modules/chat/orchestrator.js`

---

## Chunk 3: Frontend 管理后台

### Task 3.1: 更新 NodeEditor 添加 hideFortuneTerms 开关

**Files:**
- Modify: `web/app/admin/langgraph/components/NodeEditor.tsx`

**新增开关组件:**
```tsx
{/* 在 llmConfig 相关字段之后添加 */}
{selectedNode.nodeId === 'role_translator' && (
  <div className="space-y-2">
    <Label>命理术语显示设置</Label>
    <div className="flex items-center space-x-2">
      <Switch
        id="hideFortuneTerms"
        checked={selectedNode.hideFortuneTerms !== false}
        onCheckedChange={(checked) => {
          onUpdateNode({
            ...selectedNode,
            hideFortuneTerms: checked
          });
        }}
      />
      <Label htmlFor="hideFortuneTerms">
        {selectedNode.hideFortuneTerms !== false ? '隐藏命理术语' : '显示命理术语'}
      </Label>
    </div>
    <p className="text-sm text-muted-foreground">
      开启后以纯角色口吻输出，关闭后会显示命理分析内容
    </p>
  </div>
)}
```

**验证:**
- [ ] `cd web && npx tsc --noEmit`

---

### Task 3.2: 更新 FlowDiagram 流程图可视化

**Files:**
- Modify: `web/app/admin/langgraph/components/FlowDiagram.tsx`

**更新节点和边定义:**
- 添加新节点: intent_classifier, listening_phase, chart_rag_retriever, fortune_generator, role_translator
- 添加条件边: 意图分流、倾听阶段分流
- 更新节点位置布局

**验证:**
- [ ] `cd web && npx tsc --noEmit`

---

## Chunk 4: 集成测试

### Task 4.1: 端到端流程测试

**测试用例:**

1. **普通聊天流程**
   - 输入: "你好啊"
   - 预期: 走 memory_check → context_builder → response_generator

2. **倾诉模式 - 倾听阶段**
   - 输入: "最近工作压力很大，感觉很累"
   - 预期: intent=venting → listening_phase → 输出共情回复

3. **倾诉模式 - 进入分析**
   - 多轮倾诉后
   - 预期: readyForAnalysis=true → chart_rag_retriever → fortune_generator → role_translator

4. **无命盘用户**
   - 用户无出生信息时倾诉
   - 预期: 提示填写资料，不进入分析

5. **结束对话**
   - 输入: "我要去忙了，下次聊"
   - 预期: endIntent=true → 触发记忆保存

---

## Execution Notes

1. **依赖关系:**
   - Task 1.x 必须先完成（基础架构）
   - Task 2.x 依赖 Task 1.x
   - Task 3.x 可以与 Task 2.x 并行
   - Task 4.x 必须在所有实现完成后执行

2. **提交策略:**
   - 每个 Chunk 完成后提交一次
   - 提交信息格式: `feat(rolecard): add venting mode - [具体功能]`

3. **回滚点:**
   - 当前分支已有备份，可随时回退

---

*计划版本: v1.0*
*创建时间: 2026-03-11*
