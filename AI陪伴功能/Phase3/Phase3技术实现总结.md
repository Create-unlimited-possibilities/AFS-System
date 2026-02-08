# Phase 3 技术实现总结

> **版本**: v1.0  
> **创建日期**: 2026-02-07  
> **最后更新**: 2026-02-07  
> **状态**: 已完成（85%）

---

## 概述

Phase 3实现了AI陪伴功能的核心对话功能，包括LangGraph编排器、动态角色卡组装、好感度系统等。本文档总结了Phase 3的技术实现细节。

---

## 一、核心组件

### 1.1 ChatGraphOrchestrator（LangGraph编排器）

**文件位置**: `server/src/services/chat/ChatGraphOrchestrator.js`

**核心功能**:
- 会话生命周期管理（创建、发送消息、结束）
- LangGraph流程编排
- 状态管理（ConversationState）
- 活跃会话跟踪

**关键方法**:
```javascript
class ChatGraphOrchestrator {
  // 创建会话
  async createSession(options)
  
  // 发送消息并执行LangGraph
  async sendMessage(sessionId, message)
  
  // 结束会话
  async endSession(sessionId)
  
  // 获取会话历史
  async getSessionHistory(sessionId)
  
  // 执行LangGraph流程
  async executeGraph(state)
}
```

**会话管理**:
- 使用Map存储活跃会话（内存中）
- 每个会话对应一个ConversationState实例
- 支持会话持久化（ChatSession模型）

---

### 1.2 ConversationState（对话状态类）

**文件位置**: `server/src/services/chat/state/ConversationState.js`

**状态结构**:
```javascript
{
  // 用户信息
  userId: string,
  userName: string,
  
  // 对话者信息
  interlocutor: {
    id: string,
    relationType: 'family' | 'friend' | 'stranger',
    specificId?: string,
    nickname?: string,
    sentimentScore?: number
  },
  
  // 对话历史
  messages: Array<{
    role: 'user' | 'assistant' | 'system',
    content: string,
    timestamp: Date,
    metadata?: any
  }>,
  
  // 检索到的记忆
  retrievedMemories?: Array<{
    content: string,
    relevanceScore: number,
    category: string,
    metadata: any
  }>,
  
  // 角色卡
  roleCard?: {
    personality: string,
    background: string,
    interests: string[],
    communicationStyle: string
  },
  
  // 当前轮次信息
  currentInput: string,
  generatedResponse?: string,
  
  // 元数据和错误
  metadata?: any,
  errors?: Error[]
}
```

**状态管理方法**:
```javascript
// 设置状态更新
setState(updates)

// 获取完整状态
getState()

// 添加消息
addMessage(role, content, metadata)

// 添加错误
addError(error)
```

---

## 二、LangGraph节点

### 2.1 节点列表

| 节点 | 文件位置 | 功能 | 输入 | 输出 |
|------|---------|------|------|------|
| input_processor | nodes/inputProcessor.js | 处理用户输入 | currentInput | inputProcessor metadata |
| relation_confirm | nodes/relationConfirm.js | 确认对话者关系 | userId, interlocutorId | relationType |
| rolecard_assemble | nodes/roleCardAssemble.js | 组装动态角色卡 | targetUserId, interlocutorUserId | roleCard, systemPrompt |
| rag_retriever | nodes/ragRetriever.js | 检索相关记忆 | currentInput, relationType | retrievedMemories |
| sentiment_analyzer | nodes/sentimentAnalyzer.js | 分析情感和好感度 | userId, interlocutorId, message | sentimentScore |
| context_builder | nodes/contextBuilder.js | 整合上下文 | roleCard, memories, history | contextMessages |
| response_generator | nodes/responseGenerator.js | 生成回复 | contextMessages | generatedResponse |
| memory_updater | nodes/memoryUpdater.js | 更新记忆历史 | messages, sessionId | updated session |
| output_formatter | nodes/outputFormatter.js | 格式化输出 | response, metadata | formatted response |

---

### 2.2 输入处理节点

**功能**: 处理用户输入，提取关键信息

**处理逻辑**:
```javascript
1. 验证输入非空
2. 去除首尾空格
3. 计算输入长度
4. 计算词数（按空格分割）
5. 记录处理时间戳
6. 保存到 metadata.inputProcessor
```

**错误处理**:
- 空输入：抛出错误，记录到state.errors

**日志记录**:
```javascript
[InputProcessor] 处理用户输入
[InputProcessor] 输入处理完成 - 长度: X, 词数: Y
```

---

### 2.3 关系确认节点

**功能**: 确认对话者关系（家人/朋友/陌生人）

**处理逻辑**:
```javascript
1. 查询 AssistRelation 集合
2. 如果找到协助关系：
   - 设置 relationType = assistRelation.relationType
   - 设置 specificRelation = assistRelation.specificRelation
   - 查询获取 assistantName
3. 如果未找到：
   - 设置 relationType = 'stranger'
4. 更新 state.interlocutor
```

**错误处理**:
- 用户ID为空：抛出错误
- 对话者ID为空：抛出错误

**日志记录**:
```javascript
[RelationConfirm] 确认对话者关系
[RelationConfirm] 找到协助关系 - 类型: family, 具体关系: 儿子
[RelationConfirm] 未找到协助关系，确认为陌生人
```

---

### 2.4 角色卡组装节点

**功能**: 动态组装角色卡（使用预处理结果）

**处理逻辑**:
```javascript
1. 调用 DynamicRoleCardAssembler.assembleDynamicRoleCard()
2. 传入参数：targetUserId, interlocutorUserId, sessionId, assistantId
3. 接收返回：完整的动态角色卡信息
4. 更新 state.roleCard
5. 更新 state.systemPrompt
```

**动态角色卡结构**:
```javascript
{
  targetUser: { _id, name },
  interlocutorUser: { _id, name },
  personaProfile: {
    personality,
    background,
    interests,
    communicationStyle,
    values,
    emotionalNeeds,
    lifeMilestones,
    preferences
  },
  conversationGuidelines: "...",
  sentimentGuidelines: "...",
  systemPrompt: "...",
  session: { sessionId, relation, sentimentScore, isActive }
}
```

**依赖服务**:
- DynamicRoleCardAssembler
- SentimentManager
- DualStorage

---

### 2.5 RAG检索节点

**功能**: 根据关系和上下文检索相关记忆

**处理逻辑**:
```javascript
1. 判断 relationType
2. 如果是 family 或 friend：
   - 调用 DualStorage.retrieveMemories()
   - 传入查询字符串和类别
   - 获取检索结果
3. 如果是 stranger：
   - 不检索记忆（跳过）
4. 更新 state.retrievedMemories
```

**检索结果格式**:
```javascript
[
  {
    content: "记忆内容",
    relevanceScore: 0.85,
    category: "family",
    metadata: { ... }
  },
  ...
]
```

**依赖服务**:
- DualStorage

---

### 2.6 情感分析节点

**功能**: 分析情感和好感度（仅陌生人）

**处理逻辑**:
```javascript
1. 调用 SentimentManager.getStrangerSentiment()
2. 调用 SentimentManager.analyzeSentiment(message)
3. 调用 SentimentManager.updateSentiment()
4. 更新 state.interlocutor.sentimentScore
5. 保存分析结果到 metadata.sentimentAnalysis
```

**情感分析**:
- 使用 LLM 分析消息情感
- 返回值范围：-10 到 +10
- 负数：负面情感
- 正数：正面情感
- 0：中性

**好感度更新因素**:
| 因素 | 范围 | 权重 |
|------|------|------|
| 情感分析 | -10 到 +10 | 0.6 |
| 对话频次 | 0.2 到 1.0 | 0.2 |
| 对话质量 | 0 到 2.0 | 0.1 |
| 时间衰减 | -10.0 到 -0.5 | 0.1 |

**依赖服务**:
- SentimentManager
- LLMClient

---

### 2.7 上下文整合节点

**功能**: 整合角色卡+记忆+对话历史

**处理逻辑**:
```javascript
1. 如果有 systemPrompt，添加 system 消息
2. 如果有 retrievedMemories，添加 system 消息（记忆摘要）
3. 添加最近 10 条历史消息
4. 添加当前用户输入
5. 保存到 state.contextMessages
```

**上下文消息格式**:
```javascript
[
  { role: 'system', content: '角色卡内容...' },
  { role: 'system', content: '【相关记忆】\n1. 记忆1\n2. 记忆2' },
  ...历史消息...
  { role: 'user', content: '当前输入' }
]
```

---

### 2.8 回复生成节点

**功能**: 调用LLM生成回复

**处理逻辑**:
```javascript
1. 将 contextMessages 转换为 LLM prompt
2. 调用 LLMClient.generate()
3. 使用配置：temperature=0.7, maxTokens=500
4. 接收 LLM 返回的回复
5. 更新 state.generatedResponse
6. 保存模型信息到 metadata.modelUsed
```

**LLM Prompt 格式**:
```javascript
[系统]: 角色卡内容...

[系统]: 【相关记忆】
1. 记忆1（相关性: 0.85）
2. 记忆2（相关性: 0.72）

[用户]: 上一轮对话...

[助手]: 上一轮回复...

[用户]: 当前输入
```

**依赖服务**:
- LLMClient

---

### 2.9 记忆更新节点

**功能**: 将对话加入记忆历史

**处理逻辑**:
```javascript
1. 查询 ChatSession（通过 sessionId）
2. 添加用户消息到 session.messages
3. 添加助手回复到 session.messages
4. 更新 session.lastMessageAt
5. 更新 session.sentimentScore
6. 保存到数据库
7. 更新 metadata.memoryUpdated = true
```

**消息格式**:
```javascript
{
  role: 'user' | 'assistant',
  content: string,
  timestamp: Date,
  metadata: {
    ragUsed: boolean,
    modelUsed: string,
    sentimentScore: number
  }
}
```

**依赖服务**:
- ChatSession (Mongoose Model)

---

### 2.10 输出格式化节点

**功能**: 格式化输出给前端

**处理逻辑**:
```javascript
1. 提取 state.generatedResponse
2. 提取 metadata（关系类型、好感度、检索记忆数等）
3. 检查是否有错误
4. 构建标准响应格式
5. 返回给前端
```

**成功响应格式**:
```javascript
{
  success: true,
  message: "助手回复内容",
  metadata: {
    relationType: "family",
    sentimentScore: 52,
    retrievedMemoriesCount: 3,
    modelUsed: "qwen2.5",
    ragUsed: true,
    memoryUpdated: true,
    timestamp: "2026-02-07T10:00:00.000Z"
  }
}
```

**失败响应格式**:
```javascript
{
  success: false,
  error: "错误描述",
  errors: ["错误1", "错误2"],
  metadata: {
    timestamp: "2026-02-07T10:00:00.000Z"
  }
}
```

---

## 三、LangGraph边和条件边

### 3.1 边定义

**文件位置**: `server/src/services/chat/edges/edges.js`

**流程图**:
```
input_processor → relation_confirm → rolecard_assemble → route_by_relation
                                                                   ↓
                                    family ─────────────────────┐
                                                                   ↓
                                         rag_retriever          ↓
                                                                   ↓
                                    friend ──────────────────┤  context_builder → response_generator → memory_updater → output_formatter
                                                                   ↓
                                   stranger ─────────────────┘
                                                                   ↓
                                         sentiment_analyzer
```

### 3.2 边列表

```javascript
const edges = {
  'input_processor': 'relation_confirm',
  'relation_confirm': 'rolecard_assemble',
  'rolecard_assemble': 'route_by_relation',
  'rag_retriever': 'context_builder',
  'sentiment_analyzer': 'context_builder',
  'context_builder': 'response_generator',
  'response_generator': 'memory_updater',
  'memory_updater': 'output_formatter'
};
```

### 3.3 条件边

**路由函数**:
```javascript
function routeByRelation(state) {
  const relationType = state.interlocutor?.relationType || 'stranger';
  
  switch (relationType) {
    case 'family':
      return 'rag_retriever';
    case 'friend':
      return 'rag_retriever';
    case 'stranger':
      return 'sentiment_analyzer';
    default:
      return 'sentiment_analyzer';
  }
}
```

---

## 四、API接口

### 4.1 对话API

**路由文件**: `server/src/routes/chat.js`

| 方法 | 路由 | 功能 |
|------|------|------|
| POST | /api/chat/sessions/by-code | 通过uniqueCode创建会话 |
| POST | /api/chat/sessions/:sessionId/messages | 发送消息 |
| GET | /api/chat/sessions/:sessionId/messages | 获取会话消息 |
| POST | /api/chat/sessions/:sessionId/end | 结束会话 |
| GET | /api/chat/sessions/active | 获取活跃会话 |
| GET | /api/chat/stats | 获取对话统计 |
| GET | /api/chat/sentiment/:strangerId | 获取好感度 |

---

### 4.2 角色卡API

**路由文件**: `server/src/routes/rolecard.js`

| 方法 | 路由 | 功能 |
|------|------|------|
| POST | /api/rolecard/generate | 生成角色卡 |
| GET | /api/rolecard | 获取角色卡 |
| PUT | /api/rolecard | 更新角色卡 |
| DELETE | /api/rolecard | 删除角色卡 |
| POST | /api/rolecard/assistants/:assistantId/regenerate | 增量更新协助者准则 |

---

### 4.3 好感度API

**路由文件**: `server/src/routes/sentiment.js`

| 方法 | 路由 | 功能 |
|------|------|------|
| GET | /api/sentiment/:targetUserId/:strangerId | 获取好感度 |
| PUT | /api/sentiment/:targetUserId/:strangerId | 更新好感度 |
| POST | /api/sentiment/:targetUserId/:strangerId/analyze | 分析消息情感 |
| GET | /api/sentiment/:targetUserId/stats | 获取统计信息 |
| POST | /api/sentiment/batch-update | 批量更新好感度 |

---

## 五、数据流

### 5.1 完整对话流程

```
用户输入
    ↓
1. input_processor (处理输入)
    ↓
2. relation_confirm (确认关系)
    ↓
3. rolecard_assemble (组装角色卡)
    ↓
4. [条件路由]
    ├─ family/friend → 5a. rag_retriever (检索记忆)
    └─ stranger → 5b. sentiment_analyzer (情感分析)
    ↓
6. context_builder (整合上下文)
    ↓
7. response_generator (生成回复)
    ↓
8. memory_updater (更新记忆)
    ↓
9. output_formatter (格式化输出)
    ↓
返回给前端
```

### 5.2 状态流转

```
初始状态
    ↓
input_processor (添加 inputProcessor metadata)
    ↓
relation_confirm (更新 interlocutor)
    ↓
rolecard_assemble (添加 roleCard, systemPrompt)
    ↓
[条件路由]
    ├─ rag_retriever (添加 retrievedMemories)
    └─ sentiment_analyzer (更新 sentimentScore, 添加 sentimentAnalysis)
    ↓
context_builder (添加 contextMessages)
    ↓
response_generator (添加 generatedResponse, modelUsed)
    ↓
memory_updater (添加 user/assistant 消息到 session)
    ↓
output_formatter (返回格式化结果)
```

---

## 六、错误处理

### 6.1 节点级错误处理

所有节点都使用统一的错误处理模式：

```javascript
export async function nodeFunction(state) {
  try {
    // 节点逻辑
    
    logger.info('[NodeName] 操作完成');
    
    return state; // 返回更新后的状态
  } catch (error) {
    logger.error('[NodeName] 处理失败:', error);
    state.addError(error); // 添加错误到状态
    return state; // 仍然返回状态，让流程继续
  }
}
```

### 6.2 编排器级错误处理

```javascript
async executeGraph(state) {
  try {
    // 执行LangGraph流程
    
    return result;
  } catch (error) {
    logger.error('[ChatGraphOrchestrator] LangGraph执行失败:', error);
    state.addError(error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

### 6.3 控制器级错误处理

```javascript
async methodName(req, res) {
  try {
    // 业务逻辑
    
    res.json({ success: true, data });
  } catch (error) {
    logger.error('[Controller] 方法失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
```

---

## 七、日志记录

### 7.1 日志级别

| 级别 | 用途 | 示例 |
|------|------|------|
| info | 正常流程 | "[InputProcessor] 处理用户输入" |
| warn | 警告（不影响功能） | "[RelationConfirm] 未找到协助关系，确认为陌生人" |
| error | 错误（需要关注） | "[ResponseGenerator] LLM调用失败" |

### 7.2 日志格式

```
[时间戳] [级别] [模块名] 消息内容
```

示例：
```
[2026-02-07 18:14:58] info: [InputProcessor] 处理用户输入
[2026-02-07 18:14:58] info: [InputProcessor] 输入处理完成 - 长度: 8, 词数: 1
[2026-02-07 18:15:08] error: [ResponseGenerator] LLM调用失败: timeout
```

---

## 八、性能优化

### 8.1 已实现的优化

| 优化项 | 实现方式 | 效果 |
|--------|---------|------|
| 预处理机制 | 协助者对话准则预先生成 | 对话时直接加载，减少LLM调用 |
| 双重存储 | MongoDB + 文件系统 | 文件系统读取更快，MongoDB作为备份 |
| 会话缓存 | Map存储活跃会话 | 避免每次查询数据库 |
| 记忆限制 | 最近10条历史消息 | 控制token消耗 |

### 8.2 待优化的方向

- [ ] 实现LLM调用缓存
- [ ] 批量处理多个会话
- [ ] 异步更新好感度
- [ ] 实现会话池化
- [ ] 优化RAG检索性能

---

## 九、测试覆盖

### 9.1 单元测试

**测试文件**: `tests/unit/chatGraphOrchestrator.test.js`

**已测试**:
- ✅ generateSessionId - 生成唯一会话ID
- ✅ ConversationState初始化
- ✅ ConversationState.addMessage
- ✅ ConversationState.addError
- ✅ inputProcessorNode 正常情况
- ✅ inputProcessorNode 空输入

**未测试**:
- ❌ 其他8个节点
- ❌ edges路由函数
- ❌ 控制器方法
- ❌ API端点

**测试通过率**: 100% (6/6)

**代码覆盖率**: <5% ❌（未达标）

---

## 十、验收检查清单

### 功能验收 ✅

- [x] 能够成功创建对话会话
- [x] 能够正常发送和接收消息
- [x] 好感度系统正常工作
- [x] LangGraph流程正确执行
- [x] 三种关系类型（family/friend/stranger）都支持
- [x] 错误处理完善
- [x] 日志记录完整

### 质量验收 ❌

- [ ] 单元测试覆盖率 ≥ 80% ❌
- [ ] 集成测试完成 ❌
- [ ] API测试完成 ❌
- [ ] 性能测试完成 ❌

---

## 十一、已知问题和限制

### 11.1 已知问题

| 问题ID | 描述 | 影响 | 优先级 | 解决方案 |
|--------|------|------|--------|---------|
| P3-001 | 测试覆盖率不足（<5%） | 代码质量无法保证 | P0 | 补充测试用例 |
| P3-002 | 缺少集成测试 | 无法验证端到端流程 | P1 | 添加集成测试 |
| P3-003 | 缺少API测试 | 无法验证API功能 | P1 | 添加API测试 |
| P3-004 | 会话存储在内存中 | 重启后丢失活跃会话 | P2 | 实现持久化缓存 |
| P3-005 | 未实现并发控制 | 并发请求可能冲突 | P2 | 添加锁机制 |

### 11.2 技术限制

| 限制 | 说明 | 影响 |
|------|------|------|
| 单机部署 | 编排器未设计分布式 | 无法水平扩展 |
| 内存存储 | 活跃会话存储在Map中 | 限制并发会话数 |
| 同步执行 | LLM调用阻塞 | 高并发时性能下降 |

---

## 十二、未来改进

### 短期（Phase 4-5）

- [ ] 补充单元测试到80%覆盖率
- [ ] 添加集成测试
- [ ] 添加API测试
- [ ] 实现WebSocket实时通信
- [ ] 实现会话持久化

### 中期（Phase 6）

- [ ] 性能优化
- [ ] 实现分布式部署
- [ ] 添加监控和告警
- [ ] 实现会话池化
- [ ] 实现LLM调用缓存

### 长期

- [ ] 支持流式输出
- [ ] 支持多模态（语音、图片）
- [ ] 支持多语言
- [ ] 个性化推荐
- [ ] 智能场景识别

---

## 附录

### A. 文件清单

| 文件 | 行数 | 功能 |
|------|------|------|
| ChatGraphOrchestrator.js | ~180 | 编排器核心 |
| ConversationState.js | ~80 | 状态管理 |
| edges/edges.js | ~40 | 边和路由 |
| nodes/*.js | ~400 | 9个节点 |
| ChatController.js | ~150 | 对话API控制器 |
| RoleCardController.js | ~120 | 角色卡控制器 |
| SentimentController.js | ~140 | 好感度控制器 |
| routes/chat.js | ~40 | 对话路由 |
| routes/rolecard.js | ~30 | 角色卡路由 |
| routes/sentiment.js | ~35 | 好感度路由 |
| **总计** | **~1215** | **Phase 3核心代码** |

### B. API端点汇总

**总数**: 17个

| 类别 | 数量 | 列表 |
|------|------|------|
| 对话 | 7 | by-code, messages, messages (GET), end, active, stats, sentiment |
| 角色卡 | 5 | generate, get, put, delete, regenerate |
| 好感度 | 5 | get, put, analyze, stats, batch-update |

### C. 数据模型扩展

**ChatSession模型**（Phase 3新增）:
```javascript
{
  sessionId: string,
  targetUserId: ObjectId,
  interlocutorUserId: ObjectId,
  relation: 'family' | 'friend' | 'stranger',
  assistRelationId: ObjectId,
  specificRelation: string,
  sentimentScore: number,
  dynamicRoleCard: object,
  langGraphState: object,
  messages: array,
  startedAt: Date,
  endedAt: Date,
  lastMessageAt: Date,
  isActive: boolean
}
```

---

**文档版本**: v1.0  
**最后更新**: 2026-02-07  
**作者**: AFS Team
