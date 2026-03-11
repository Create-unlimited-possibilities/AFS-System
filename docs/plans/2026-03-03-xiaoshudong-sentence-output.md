# 小树洞逐句输出优化计划

## 目标
使小树洞对话输出与AI角色卡对话一致，实现逐句显示效果。

## 参考实现
AI角色卡对话的逐句分割逻辑位于 `chat/orchestrator.js:728-737`

---

## Phase 1: 创建公共分割函数
**负责人**: Backend Expert

### 创建文件
`server/src/core/utils/sentenceSplitter.js`

```javascript
/**
 * 将文本按句子分割（以。！？为分隔符）
 * @param {string} text - 输入文本
 * @returns {string[]} 句子数组（保留标点符号）
 */
export function splitIntoSentences(text) {
  if (!text || typeof text !== 'string') return [];

  const sentences = text.split(/([。！？])/).filter(s => s.trim());

  const combinedSentences = [];
  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i] + (sentences[i + 1] || '');
    if (sentence.trim()) {
      combinedSentences.push(sentence.trim());
    }
  }

  return combinedSentences;
}
```

---

## Phase 2: 修改小树洞 Controller
**负责人**: Backend Expert

### 修改文件
`server/src/modules/xiaoshudong/controller.js`

### 修改内容

1. 导入分割函数
```javascript
import { splitIntoSentences } from '../../core/utils/sentenceSplitter.js';
```

2. 修改 `sendMessage` 方法的返回格式

**修改前**：
```javascript
return res.json({
  success: true,
  response: result.response,
  intent: result.intent,
  metadata: result.metadata
});
```

**修改后**：
```javascript
// 分割句子用于逐句显示
const sentences = splitIntoSentences(result.response);

return res.json({
  success: true,
  response: result.response,      // 完整内容（用于存储）
  sentences: sentences,            // 分割后的句子（用于逐句显示）
  intent: result.intent,
  metadata: result.metadata
});
```

3. 同样修改 `getHistory` 方法的返回格式

---

## Phase 3: 修改前端 useChat.ts
**负责人**: Frontend Expert

### 修改文件
`web/app/chat/hooks/useChat.ts`

### 修改内容

在小树洞消息处理中添加逐句显示逻辑（参考AI角色卡的实现）：

```typescript
// 在 sendMessage 函数中，处理小树洞响应
if (isXiaoShuDong) {
  // ... 现有代码 ...

  if (data.success) {
    // 移除临时消息
    setMessages(prev => {
      const filtered = prev.filter(m => m.id !== tempId)
      return [...filtered, {
        id: `real_${Date.now()}`,
        role: 'user' as const,
        content,
        timestamp: new Date()
      }]
    })

    // 逐句显示 AI 回复
    const sentences = data.sentences || [data.response]
    let currentIndex = 0

    const addNextSentence = () => {
      if (currentIndex >= sentences.length) return

      setMessages(prev => [...prev, {
        id: `ai_${Date.now()}_${currentIndex}`,
        role: 'assistant' as const,
        content: sentences[currentIndex],
        timestamp: new Date()
      }])

      currentIndex++

      if (currentIndex < sentences.length) {
        const delay = 1000 + Math.random() * 1000  // 1-2秒间隔
        setTimeout(addNextSentence, delay)
      }
    }

    const initialDelay = 1000 + Math.random() * 1000
    setTimeout(addNextSentence, initialDelay)
  }
}
```

---

## Phase 4: 重构 chat/orchestrator.js（可选）
**负责人**: Backend Expert

将 `chat/orchestrator.js` 中的分割逻辑替换为公共函数：

```javascript
import { splitIntoSentences } from '../../core/utils/sentenceSplitter.js';

// 替换原有代码
const combinedSentences = splitIntoSentences(aiResponse);
```

---

## Phase 5: 验证检查
**负责人**: Team Lead

### 检查清单
- [ ] TypeScript 编译通过
- [ ] API 路由名字正确
- [ ] 语法检查通过
- [ ] 小树洞对话功能正常
- [ ] 逐句显示效果正常

---

## 文件修改清单
| 文件 | 修改类型 |
|------|----------|
| `server/src/core/utils/sentenceSplitter.js` | 新建 |
| `server/src/modules/xiaoshudong/controller.js` | 修改 |
| `web/app/chat/hooks/useChat.ts` | 修改 |
| `server/src/modules/chat/orchestrator.js` | 重构（可选） |
