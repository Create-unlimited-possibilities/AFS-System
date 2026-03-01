# Fortune Generator 节点优化计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 优化命理生成节点的 System Prompt 动态组装逻辑

**Architecture:** 将用户情况、可编辑Prompt、命盘MD、知识检索动态组合成完整的 System Prompt

**Tech Stack:** Node.js, Express, LangGraph, MongoDB

---

## Phase 1: 探索当前 fortune_generator 实现

### 目标
了解当前 fortune_generator 节点的实现方式，确定需要修改的位置

### 需要探索的文件
- `server/src/modules/xiaoshudong/nodes/fortuneGenerator.js` - 主要修改目标

### 当前数据来源分析

```
┌─────────────────────────────────────────────────────────────┐
│                    System Prompt 结构                        │
├─────────────────────────────────────────────────────────────┤
│  1. 用户情况 (compressedData)                                │
│     └─ 来源: conversation_compressor 节点                   │
│        - eventSummary: 事件摘要                              │
│        - emotionalState: 情绪状态                            │
│        - coreConcerns: 核心关注点                            │
│        - informationGathered: 收集的信息                     │
│                                                             │
│  2. 可编辑固定Prompt (editableSection)                       │
│     └─ 来源: LangGraph 配置中的 editableSection              │
│        - 管理员可在后台编辑                                   │
│        - 定义分析要求和输出格式                               │
│                                                             │
│  3. 命盘检索结果 (formattedChartText)                        │
│     └─ 来源: chart_retriever 节点                           │
│        - Markdown 格式的12宫详解                             │
│        - 基本信息（公历、农历、四柱等）                       │
│                                                             │
│  4. 知识检索结果 (ragResults)                                │
│     └─ 来源: rag_retriever 节点                             │
│        - 紫微斗数书籍相关内容                                 │
│        - 基于用户情况检索的知识                               │
└─────────────────────────────────────────────────────────────┘
```

### 专家注意事项
- **Backend Expert**: 需要修改 fortuneGenerator.js 中的 prompt 组装逻辑
- 注意保持与现有 state 结构的兼容性
- 确保 formattedChartText 正确读取（来自新的 chartRetriever）

---

## Phase 2: 修改 fortune_generator 的 Prompt 组装逻辑

### 目标
重新组织 `buildFortunePrompt` 函数，按照新的顺序组装 System Prompt

### 当前实现分析 (fortuneGenerator.js:77-130)

**当前顺序:**
```
1. chartText (命盘MD)
2. compressedData (用户情况)
3. ragContext (知识检索)
4. userQuestion (用户问题)
5. editableSection (可编辑部分)
```

**需要改成:**
```
1. 用户情况 (compressedData)
2. 可编辑固定Prompt (editableSection) ← 从 configLoader 读取
3. 命盘检索结果 (formattedChartText)
4. 知识检索结果 (ragContext)
```

### 修改文件
- `server/src/modules/xiaoshudong/nodes/fortuneGenerator.js`

### 具体修改步骤

**Step 1: 重构 buildFortunePrompt 函数**

```javascript
// 位置: server/src/modules/xiaoshudong/nodes/fortuneGenerator.js
// 行号: 77-130

function buildFortunePrompt(chartText, compressedData, userQuestion, ragContext) {
  let prompt = '';

  // 1. 用户情况 (来自 conversation_compressor)
  prompt += buildUserContextSection(compressedData);

  // 2. 可编辑固定Prompt (来自 LangGraph 配置)
  prompt += buildEditableSection();

  // 3. 命盘检索结果 (来自 chart_retriever)
  prompt += buildChartSection(chartText);

  // 4. 知识检索结果 (来自 rag_retriever)
  prompt += buildRagSection(ragContext);

  // 5. 用户原始问题
  prompt += buildUserQuestionSection(userQuestion);

  return prompt;
}
```

**Step 2: 创建独立的 section 构建函数**

```javascript
// 1. 用户情况 Section
function buildUserContextSection(compressedData) {
  if (!compressedData?.eventSummary) return '';
  let section = `# 用户情况\n\n`;
  section += `事件摘要: ${compressedData.eventSummary}\n`;
  if (compressedData.emotionalState) {
    section += `情绪状态: ${compressedData.emotionalState}\n`;
  }
  if (compressedData.coreConcerns?.length > 0) {
    section += `核心关注: ${compressedData.coreConcerns.join('、')}\n`;
  }
  if (compressedData.informationGathered) {
    const info = compressedData.informationGathered;
    if (info.situation) section += `用户处境: ${info.situation}\n`;
    if (info.duration) section += `持续时间: ${info.duration}\n`;
    if (info.mainWorry) section += `主要担忧: ${info.mainWorry}\n`;
  }
  section += '\n---\n\n';
  return section;
}

// 2. 可编辑固定Prompt Section
function buildEditableSection() {
  const editableSection = configLoader.getPrompt('xiaoshudong', 'fortune_generator');
  if (editableSection) {
    return `# 分析指引\n\n${editableSection}\n\n---\n\n`;
  }
  // Fallback
  return `# 分析指引\n\n请根据以下命盘信息和用户情况，提供专业的紫微斗数分析报告。\n\n---\n\n`;
}

// 3. 命盘检索结果 Section
function buildChartSection(chartText) {
  if (!chartText) return '';
  return `${chartText}\n\n---\n\n`;
}

// 4. 知识检索结果 Section
function buildRagSection(ragContext) {
  if (!ragContext?.length) return '';
  let section = `# 参考知识\n\n`;
  const maxContext = Math.min(ragContext.length, 3);
  for (let i = 0; i < maxContext; i++) {
    section += `${i + 1}. ${ragContext[i].content}\n\n`;
  }
  section += '---\n\n';
  return section;
}

// 5. 用户问题 Section
function buildUserQuestionSection(userQuestion) {
  if (!userQuestion) return '';
  return `# 用户问题\n\n${userQuestion}\n`;
}
```

### 专家注意事项
- **Backend Expert**: 修改时保持函数签名不变
- 确保 configLoader 正确导入和调用
- 注意 section 之间的分隔符 `---` 保持一致
- 不要删除现有的 hasFortuneResponse、getFortuneResponse、formatFortuneResponse 函数

---

## Phase 3: 更新 LangGraph 配置中的 dynamicSources

### 目标
更新 fortune_generator 节点的 dynamicSources，准确反映新的数据来源结构

### 修改文件
- `server/src/modules/langgraph/defaults/xiaoshudong.js`

### 当前配置 (行 92-114)

```javascript
{
  nodeId: 'fortune_generator',
  nodeName: '命理生成',
  nodeType: 'process',
  promptType: 'dynamic',
  staticPrompt: '',
  dynamicSources: [
    { name: '用户情况', description: '事件摘要、情绪状态、核心关注' },
    { name: '书籍内容', description: 'RAG检索的紫微斗数知识' },
    { name: '用户问题', description: '用户的原始问题' }
  ],
  editableSection: `## 分析要求...`,
  llmEnabled: true,
  llmConfig: { source: 'ollama', model: 'ziwei-8b', temperature: 0.7, maxTokens: 4096 },
  position: { x: 450, y: 390 }
}
```

### 需要改成

```javascript
{
  nodeId: 'fortune_generator',
  nodeName: '命理生成',
  nodeType: 'process',
  promptType: 'dynamic',
  staticPrompt: '',
  dynamicSources: [
    { name: '{compressedData}', description: '用户情况：来自对话压缩节点的事件摘要、情绪状态、核心关注' },
    { name: '{editableSection}', description: '可编辑分析指引：管理员在后台编辑的分析要求' },
    { name: '{formattedChartText}', description: '命盘MD：从存储读取的命盘数据，包含12宫详解' },
    { name: '{ragContext}', description: '知识检索：RAG检索的紫微斗数书籍内容' }
  ],
  editableSection: `## 分析要求
请根据以上命盘信息和用户情况，提供专业的紫微斗数分析报告。要求：
1. 分析用户当前面临的情况
2. 从命盘角度解读优势和挑战
3. 结合运限给出时间节点建议
4. 提供具体的行动建议

请用专业但通俗的语言撰写分析报告。`,
  llmEnabled: true,
  llmConfig: { source: 'ollama', model: 'ziwei-8b', temperature: 0.7, maxTokens: 4096 },
  position: { x: 450, y: 390 }
}
```

### 专家注意事项
- **Backend Expert**: 只修改 dynamicSources 数组
- 保持 editableSection 内容不变
- 使用 `{变量名}` 格式表示动态数据来源
- description 要清晰说明数据来源和内容

---

## Phase 4: 测试验证

### 目标
确保修改后的代码正常工作

### 测试步骤

1. **语法检查**
```bash
cd server && node --check src/modules/xiaoshudong/nodes/fortuneGenerator.js
```

2. **单元测试** (如果有)
```bash
cd server && npm test -- --run tests/unit/fortuneGenerator.test.js
```

3. **手动测试**
- 运行小树洞对话流程
- 验证命理生成节点的输出
- 检查 System Prompt 组装顺序是否正确

### 验证清单
- [ ] fortuneGenerator.js 语法检查通过
- [ ] buildFortunePrompt 函数按新顺序组装
- [ ] configLoader.getPrompt() 正确读取 editableSection
- [ ] formattedChartText 正确读取
- [ ] ragContext 正确读取
- [ ] LangGraph 配置更新正确

---

## 任务分配

| Phase | 任务 | 负责专家 |
|-------|------|----------|
| Phase 1 | 探索当前实现 | PM (已完成) |
| Phase 2 | 修改 fortuneGenerator.js | Backend Expert |
| Phase 3 | 更新 LangGraph 配置 | Backend Expert |
| Phase 4 | 测试验证 | Tester |

---
