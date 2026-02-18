# 待实现功能清单

> 记录系统中规划但尚未实现的功能，便于后续逐步推进。

---

## 1. Token 限制管理（LangGraph 对话控制）

**优先级**：高
**模块**：LangGraph 节点
**目的**：防止 AI 行为漂移，保持角色一致性

### 功能描述

在对话过程中监控 token 消耗，当达到阈值时由角色卡主动干预：

| 阈值 | 行为 | 示例 |
|-----|------|------|
| 60% | 委婉提示需要休息 | "我觉得有点累了，让我休息5分钟再来聊聊吧" |
| 70% | 强行终止对话 | "今天先聊到这吧，改天再聊" |

### 实现要点

- [ ] 在 LangGraph 节点中添加 token 计数逻辑
- [ ] 检测当前模型上下文窗口大小
- [ ] 60% 阈值触发：调用 LLM 根据角色卡口吻生成"休息提示"
- [ ] 70% 阈值触发：调用 LLM 根据角色卡口吻生成"终止对话"
- [ ] 前端配合显示（可选的休息倒计时提示）

### 技术细节

```javascript
// 伪代码示例
const TOKEN_THRESHOLDS = {
  gentleReminder: 0.6,  // 60%
  forceTerminate: 0.7   // 70%
};

function checkTokenLimit(currentTokens, maxTokens, roleCard) {
  const ratio = currentTokens / maxTokens;

  if (ratio >= TOKEN_THRESHOLDS.forceTerminate) {
    return {
      action: 'terminate',
      message: await generateTerminationMessage(roleCard)
    };
  }

  if (ratio >= TOKEN_THRESHOLDS.gentleReminder) {
    return {
      action: 'remind',
      message: await generateReminderMessage(roleCard)
    };
  }

  return { action: 'continue' };
}
```

### 相关文件

- `server/src/modules/chat/nodes/` - LangGraph 节点
- `server/src/modules/rolecard/v2/promptAssembler.js` - 生成符合角色卡的提示语

---

## 2. 记忆管理系统（三阶段渐进式压缩）

**优先级**：中
**模块**：新增记忆管理模块
**目的**：模拟人类记忆方式 + 减少存储空间占用

### 功能描述

对话终止后，对话内容进入记忆库，经过三阶段渐进式压缩：

```
对话结束
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ 阶段 1：即时处理（Day 0）                              │
│ • 完整保存聊天内容                                    │
│ • 进行向量索引（供后续检索）                           │
└─────────────────────────────────────────────────────┘
    │
    ▼ (3天后)
┌─────────────────────────────────────────────────────┐
│ 阶段 2：初步压缩（Day 3）                              │
│ • LLM 进行文本压缩（去除冗余、保留关键信息）            │
│ • 重新进行向量索引                                    │
└─────────────────────────────────────────────────────┘
    │
    ▼ (7天后)
┌─────────────────────────────────────────────────────┐
│ 阶段 3：精准压缩（Day 7）                              │
│ • LLM 进行精准压缩（提炼核心记忆点）                    │
│ • 再次进行向量索引                                    │
└─────────────────────────────────────────────────────┘
    │
    ▼
  最终记忆（长期存储）
```

### 实现要点

- [ ] 创建记忆管理模块 `server/src/modules/memory/`
- [ ] 设计记忆存储结构（MongoDB + 向量数据库）
- [ ] 实现即时索引功能（对话结束时触发）
- [ ] 实现定时任务调度（3天、7天压缩任务）
- [ ] 实现 LLM 压缩逻辑（不同阶段的压缩 Prompt）
- [ ] 压缩后重新生成向量索引

### 存储结构设计

```javascript
// 记忆条目结构
interface MemoryEntry {
  _id: string;
  userId: string;           // 目标用户ID
  sessionId: string;        // 对话会话ID
  participants: string[];   // 参与者ID列表

  // 内容
  rawContent: string;       // 原始完整对话（阶段1）
  compressedContent: string; // 压缩后内容（阶段2/3）

  // 状态
  stage: 'raw' | 'compressed_v1' | 'compressed_v2';
  createdAt: Date;
  compressedAt: Date | null;

  // 向量索引
  vectorIndexId: string;
  vectorIndexedAt: Date;

  // 元数据
  metadata: {
    messageCount: number;
    tokenCount: number;
    keyTopics: string[];
    sentimentScore: number;
  };
}
```

### 压缩 Prompt 设计

**阶段2（初步压缩）**：
```
你是一个记忆整理专家。请对以下对话进行初步压缩：
1. 去除重复内容
2. 保留关键信息和情感表达
3. 保持对话的主要脉络
4. 目标长度：原长度的 30-50%

## 原始对话
{conversation}

## 输出格式（JSON）
{
  "compressedContent": "压缩后的内容",
  "keyTopics": ["话题1", "话题2"],
  "sentimentScore": 0.7
}
```

**阶段3（精准压缩）**：
```
你是一个记忆提炼专家。请从以下压缩内容中提炼核心记忆：

## 压缩内容
{compressedContent}

## 输出格式（JSON）
{
  "coreMemory": "核心记忆摘要（100-200字）",
  "memorableMoments": ["关键时刻1", "关键时刻2"],
  "emotionalHighlights": ["情感高点1"],
  "factualInfo": ["重要事实1"]
}
```

### 相关文件

- 新增：`server/src/modules/memory/controller.js`
- 新增：`server/src/modules/memory/compressor.js`
- 新增：`server/src/modules/memory/vectorIndexer.js`
- 新增：`server/src/modules/memory/scheduler.js`
- 修改：`server/src/modules/chat/nodes/` - 对话结束时触发记忆保存

---

## 3. 校准层 V2 重构

**优先级**：中
**模块**：`server/src/modules/rolecard/v2/calibrationLayer.js`
**目的**：适配 V2 数据结构，实现真正的角色卡漂移检测

### 功能描述

随着记忆和对话的积累，分析角色卡属性是否有实质性改变：

- 性格变化
- 价值观变化
- 沟通方式变化
- 其他维度

若有变化，提醒用户对角色卡进行更新校准。

### 实现要点

- [ ] 移除 V1 字段依赖（personalityTraits、behavioralIndicators）
- [ ] 适配 V2 自然语言字段结构
- [ ] 设计漂移检测机制（LLM 分析 or 关键词特征提取）
- [ ] 设计用户提醒机制（通知、邮件、站内消息）
- [ ] 提供一键重新生成角色卡的入口

### 检测方式（待确定）

**方案 A**：LLM 智能分析
- 收集近期记忆摘要
- 与角色卡对比，让 LLM 判断是否有显著变化

**方案 B**：关键词特征提取
- 从角色卡自然语言中提取特征向量
- 从对话中提取相同特征向量
- 计算向量距离判断漂移

### 相关文件

- 修改：`server/src/modules/rolecard/v2/calibrationLayer.js`
- 依赖：记忆管理系统（功能2）

---

## 实现顺序建议

1. **Token 限制管理** - 独立模块，优先级高，防止 AI 漂移
2. **记忆管理系统** - 基础设施，校准层依赖此功能
3. **校准层 V2 重构** - 依赖记忆系统，需要先有数据积累

---

## 更新日志

| 日期 | 更新内容 |
|-----|---------|
| 2026-02-17 | 初始创建，记录 Token 限制管理、记忆管理系统、校准层 V2 重构 |
