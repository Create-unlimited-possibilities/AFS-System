# Psychologist Response 节点配置修复计划

## 问题描述
`xiaoshudong.js` 配置文件中 `psychologist_response` 节点配置与实际代码行为不一致：
- 配置说是 `static` prompt，但实际代码是动态组装
- `dynamicSources` 是空数组，但实际使用了多个动态数据源

## 修复目标
使配置与实际行为一致，采用与 `fortune_generator` 相同的 `dynamic` 模式。

## System Prompt 动态组成顺序
```
1. 命理报告（fortuneResponse）- 来自 fortune_generator
2. 可编辑固定Prompt（editableSection）- 来自 LangGraph 配置
3. 用户情况（compressedData）- 来自 conversation_compressor
4. 用户原始问题（userQuestion）- 来自 state.currentInput
```

---

## Phase 1: 更新 xiaoshudong.js 配置
**负责人**: Backend Expert

### 修改内容
将 `psychologist_response` 节点配置从：
```javascript
{
  nodeId: 'psychologist_response',
  promptType: 'static',
  staticPrompt: `...`,
  dynamicSources: [],
}
```

改为：
```javascript
{
  nodeId: 'psychologist_response',
  promptType: 'dynamic',
  staticPrompt: '',
  dynamicSources: [
    { name: '{fortuneResponse}', description: '命理报告：来自命理生成节点的分析结果' },
    { name: '{editableSection}', description: '可编辑回复指引：管理员在后台编辑的回复要求' },
    { name: '{compressedData}', description: '用户情况：事件摘要、情绪状态、核心关注' },
    { name: '{userQuestion}', description: '用户原始问题' }
  ],
  editableSection: `## 回复要求
请基于内部分析报告，以温暖、专业的心理咨询师身份给出建议。

注意：
- 不要直接引用分析报告中的命理术语
- 用心理咨询的语言重新表述
- 保持温暖、支持性的语气`
}
```

### 注意事项
- 同时移除 edges 中 `chart_retriever → psychologist_response` 的"无命盘"路径
- 更新 `listening_response` 的 target 为 `output` 而非 `psychologist_response`

---

## Phase 2: 更新 edges.js
**负责人**: Backend Expert

### 修改内容
1. 移除 `chart_retriever` 到 `psychologist_response` 的"无命盘"路径
2. 确保流程始终经过 `fortune_generator`

### 修改前
```javascript
case 'chart_retriever':
  if (!state.metadata?.chartRetrieved) {
    return 'psychologist_response';  // 移除这个分支
  }
  return 'rag_retriever';
```

### 修改后
```javascript
case 'chart_retriever':
  // 用户必须填写完整资料才能使用小树洞，所以一定有命盘
  return 'rag_retriever';
```

---

## Phase 3: 验证检查
**负责人**: Team Lead

### 检查清单
- [ ] TypeScript 编译通过
- [ ] API 路由名字正确
- [ ] 语法检查通过
- [ ] 配置与代码行为一致

---

## 文件修改清单
| 文件 | 修改类型 |
|------|----------|
| `server/src/modules/langgraph/defaults/xiaoshudong.js` | 更新配置 |
| `server/src/modules/xiaoshudong/edges.js` | 简化逻辑 |
