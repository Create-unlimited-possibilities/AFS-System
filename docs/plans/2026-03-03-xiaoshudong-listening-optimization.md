# 小树洞倾听阶段优化计划

## 目标
1. 将 `conversationManager` + `listeningResponse` 合并成一个节点，减少 LLM 调用次数
2. 倾听阶段使用完整聊天历史作为上下文

## 预期效果

| 指标 | 当前 | 优化后 |
|------|------|--------|
| LLM调用次数 | 2次 | 1次 |
| 预计耗时 | ~50秒 | ~25秒 |
| 上下文 | 最近6条消息 | 全部历史 |

---

## Phase 1: 修改 conversationManager 节点
**负责人**: Backend Expert

### 修改文件
`server/src/modules/xiaoshudong/nodes/conversationManager.js`

### 修改内容

1. **合并 Prompt** - 评估和回复合并成一次调用

新的 Prompt 设计：
```javascript
const COMBINED_PROMPT = `你是一位温暖、专业的心理咨询师（小树洞）。

你的任务是：
1. 评估对话状态，判断用户是否准备好进入深度分析
2. 生成一个温暖、简洁的回复

【对话历史】
{fullHistory}

【用户最新消息】
{currentInput}

请输出JSON格式：
{
  "readyForAnalysis": boolean,
  "confidence": number,
  "coreConcern": string,
  "emotionalState": string,
  "response": string
}

回复要求：
- 2-4句话，温暖平实
- 先共情，再引导
- 不要使用命理词汇

只输出JSON，不要其他内容。`;
```

2. **使用完整历史** - 移除 `slice(-6)` 限制

修改前：
```javascript
const historyText = history.slice(-10).map(...)
const historyText = history.slice(-6).map(...)
```

修改后：
```javascript
const historyText = history.map(...)
```

3. **移除 generateListeningResponse 函数** - 不再需要单独生成回复

4. **修改 conversationManagerNode 函数**：
```javascript
export async function conversationManagerNode(state) {
  const currentInput = state.currentInput || '';
  const history = state.messages || [];

  // 一次调用同时完成评估和回复
  const result = await assessAndRespond(history, currentInput);

  // 更新状态
  state.conversationAssessment = {
    readyForAnalysis: result.readyForAnalysis,
    confidence: result.confidence,
    coreConcern: result.coreConcern,
    emotionalState: result.emotionalState
  };

  // 直接设置最终回复
  state.finalResponse = result.response;

  // 更新对话阶段
  if (result.readyForAnalysis && result.confidence > 0.7) {
    state.conversationPhase.current = 'transition';
    state.metadata.readyForAnalysis = true;
  } else {
    state.conversationPhase.current = 'listening';
    state.metadata.readyForAnalysis = false;
  }

  return state;
}
```

---

## Phase 2: 修改 edges.js 路由
**负责人**: Backend Expert

### 修改文件
`server/src/modules/xiaoshudong/edges.js`

### 修改内容

1. **倾听阶段直接输出** - 跳过 listeningResponse 节点

修改前：
```javascript
case 'conversation_manager':
  return routeAfterConversationManager(state);

// 倾听分支
case 'listening_response':
  return 'output';
```

修改后：
```javascript
case 'conversation_manager':
  if (state.metadata?.readyForAnalysis) {
    return 'conversation_compressor';
  }
  return 'output';  // 倾听阶段直接输出，不再经过 listening_response
```

---

## Phase 3: 更新 LangGraph 配置
**负责人**: Backend Expert

### 修改文件
`server/src/modules/langgraph/defaults/xiaoshudong.js`

### 修改内容

1. **移除 listening_response 节点** 或标记为 deprecated

2. **更新 conversation_manager 节点配置**：
```javascript
{
  nodeId: 'conversation_manager',
  nodeName: '对话管理',
  nodeType: 'start',
  promptType: 'static',
  staticPrompt: `...合并后的Prompt...`,
  dynamicSources: [
    { name: '完整对话历史', description: '当前会话的所有历史消息' },
    { name: '用户意图', description: '识别的用户意图' }
  ],
  llmEnabled: true,
  llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.5, maxTokens: 500 }
}
```

3. **更新 edges**：
```javascript
edges: [
  { source: 'conversation_manager', target: 'output', conditionType: 'conditional', label: '倾听阶段' },
  { source: 'conversation_manager', target: 'conversation_compressor', conditionType: 'conditional', label: '分析阶段' },
  // ... 其他 edges 保持不变
]
```

---

## Phase 4: 清理废弃代码
**负责人**: Backend Expert

### 文件处理

| 文件 | 处理方式 |
|------|----------|
| `nodes/listeningResponse.js` | 保留但标记 deprecated，或删除 |
| `orchestrator.js` | 移除 listening_response 节点引用 |

---

## Phase 5: 验证检查
**负责人**: Team Lead

### 检查清单
- [ ] TypeScript 编译通过
- [ ] API 路由正常
- [ ] 倾听阶段只调用1次LLM
- [ ] 完整历史作为上下文
- [ ] 对话功能正常
- [ ] 分析阶段切换正常

---

## 文件修改清单

| 文件 | 修改类型 |
|------|----------|
| `server/src/modules/xiaoshudong/nodes/conversationManager.js` | 重构 - 合并评估和回复 |
| `server/src/modules/xiaoshudong/edges.js` | 修改 - 跳过 listening_response |
| `server/src/modules/langgraph/defaults/xiaoshudong.js` | 更新配置 |
| `server/src/modules/xiaoshudong/orchestrator.js` | 移除 listening_response 引用 |
| `server/src/modules/xiaoshudong/nodes/listeningResponse.js` | 删除或标记废弃 |
