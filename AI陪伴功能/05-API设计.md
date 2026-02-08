# API设计

## 1. 角色卡管理API

**路由文件**: `server/src/routes/rolecard.js`

| 方法 | 路由 | 描述 | 需要认证 |
|------|------|------|---------|
| POST | `/api/rolecard/generate` | 生成角色卡（包含预处理所有协助者对话准则） | ✅ |
| GET | `/api/rolecard` | 获取角色卡 | ✅ |
| PUT | `/api/rolecard` | 更新角色卡 | ✅ |
| DELETE | `/api/rolecard` | 删除角色卡 | ✅ |
| POST | `/api/rolecard/assistants/:assistantId/regenerate` | 增量更新：重新生成指定协助者的对话准则 | ✅ |

**API示例**:

生成角色卡：
```bash
POST /api/rolecard/generate
Authorization: Bearer {token}

Response:
{
  "success": true,
  "roleCard": { ... },
  "tokenCount": 25000,
  "assistantsProcessed": 3,
  "processingTime": 15000
}
```

增量更新协助者准则：
```bash
POST /api/rolecard/assistants/{assistantId}/regenerate
Authorization: Bearer {token}

Response:
{
  "success": true,
  "message": "对话准则已更新"
}
```

---

## 3. 好感度管理API（Phase 1新增）

**路由文件**: `server/src/routes/sentiment.js`（待创建）

| 方法 | 路由 | 描述 | 需要认证 |
|------|------|------|---------|
| GET | `/api/sentiment/:targetUserId/:strangerId` | 获取好感度 | ✅ |
| PUT | `/api/sentiment/:targetUserId/:strangerId` | 更新好感度 | ✅ |
| POST | `/api/sentiment/:targetUserId/:strangerId/analyze` | 分析消息情感 | ✅ |
| GET | `/api/sentiment/:targetUserId/stats` | 获取统计信息 | ✅ |
| POST | `/api/sentiment/batch-update` | 批量更新好感度 | ✅ |

**API示例**:

获取好感度：
```bash
GET /api/sentiment/{targetUserId}/{strangerId}
Authorization: Bearer {token}

Response:
{
  "success": true,
  "sentiment": {
    "strangerId": "...",
    "currentScore": 65,
    "factors": {
      "sentiment": 5,
      "frequency": 0.6,
      "quality": 1.2,
      "decay": -0.5
    },
    "history": [
      {
        "timestamp": "...",
        "oldScore": 60,
        "newScore": 65,
        "change": 5,
        "reason": "积极对话，情感得分较高"
      }
    ]
  }
}
```

更新好感度：
```bash
PUT /api/sentiment/{targetUserId}/{strangerId}
Authorization: Bearer {token}
Body:
{
  "message": "今天天气很好",
  "conversationHistory": [...]
}

Response:
{
  "success": true,
  "sentiment": {
    "currentScore": 65,
    "change": 5,
    "reason": "积极对话，情感得分较高"
  }
}
```

分析消息情感：
```bash
POST /api/sentiment/{targetUserId}/{strangerId}/analyze
Authorization: Bearer {token}
Body:
{
  "message": "今天心情很好"
}

Response:
{
  "success": true,
  "analysis": {
    "sentiment": "positive",
    "score": 5,
    "confidence": 0.85
  }
}
```

获取统计信息：
```bash
GET /api/sentiment/{targetUserId}/stats
Authorization: Bearer {token}

Response:
{
  "success": true,
  "stats": {
    "totalStrangers": 5,
    "averageScore": 62.5,
    "scoreDistribution": {
      "0-20": 0,
      "21-40": 1,
      "41-60": 2,
      "61-80": 2,
      "81-100": 0
    },
    "recentUpdates": [
      {
        "strangerId": "...",
        "timestamp": "...",
        "score": 65
      }
    ]
  }
}
```

---

## 4. 存储服务API（Phase 1新增）

**路由文件**: `server/src/routes/storage.js`（待创建）

| 方法 | 路由 | 描述 | 需要认证 |
|------|------|------|---------|
| GET | `/api/storage/assistants-guidelines/:userId` | 获取协助者对话准则 | ✅ |
| POST | `/api/storage/assistants-guidelines/:userId` | 保存协助者对话准则 | ✅ |
| PUT | `/api/storage/assistants-guidelines/:userId/:assistantId` | 更新单个协助者准则 | ✅ |
| DELETE | `/api/storage/assistants-guidelines/:userId/:assistantId` | 删除协助者准则 | ✅ |
| GET | `/api/storage/assistants-guidelines/:userId/stats` | 获取统计信息 | ✅ |

**API示例**:

保存协助者对话准则：
```bash
POST /api/storage/assistants-guidelines/{userId}
Authorization: Bearer {token}
Body:
{
  "guidelines": [
    {
      "assistantId": "...",
      "assistantName": "测试助手",
      "assistantUniqueCode": "TEST001",
      "assistRelationId": "relation-123",
      "relationType": "family",
      "specificRelation": "儿子",
      "conversationGuidelines": "...",
      "compressedAnswers": [
        {
          "questionId": "q1",
          "question": "测试问题",
          "originalAnswer": "原始答案",
          "compressed": "压缩答案",
          "questionLayer": "basic",
          "compressedAt": "2026-02-05T12:00:00Z"
        }
      ],
      "generatedAt": "2026-02-05T12:00:00Z",
      "updatedAt": "2026-02-05T12:00:00Z",
      "isValid": true
    }
  ]
}

Response:
{
  "success": true,
  "filePath": "/app/storage/userdata/{userId}/assistants-guidelines.json",
  "size": 1024,
  "checksum": "abc123...",
  "savedAt": "2026-02-05T12:00:00Z"
}
```

获取协助者对话准则：
```bash
GET /api/storage/assistants-guidelines/{userId}
Authorization: Bearer {token}

Response:
{
  "success": true,
  "userId": "...",
  "guidelines": [
    {
      "assistantId": "...",
      "assistantName": "测试助手",
      "conversationGuidelines": "...",
      "isValid": true
    }
  ],
  "loadedAt": "2026-02-05T12:00:00Z",
  "size": 1024
}
```

获取统计信息：
```bash
GET /api/storage/assistants-guidelines/{userId}/stats
Authorization: Bearer {token}

Response:
{
  "success": true,
  "userId": "...",
  "totalGuidelines": 3,
  "validGuidelines": 3,
  "invalidGuidelines": 0,
  "lastUpdated": "2026-02-05T12:00:00Z",
  "fileSize": 2048,
  "relationships": {
    "family": 2,
    "friend": 1,
    "stranger": 0
  }
}
```

---

## 5. 对话管理API

**路由文件**: `server/src/routes/chat.js`

| 方法 | 路由 | 描述 | 需要认证 |
|------|------|------|---------|
| POST | `/api/chat/sessions/by-code` | 通过uniqueCode创建会话 | ✅ |
| POST | `/api/chat/sessions/:sessionId/messages` | 发送消息 | ✅ |
| GET | `/api/chat/sessions/:sessionId/messages` | 获取会话消息 | ✅ |
| POST | `/api/chat/sessions/:sessionId/end` | 结束会话 | ✅ |
| GET | `/api/chat/sessions/active` | 获取活跃会话 | ✅ |
| GET | `/api/chat/stats` | 获取对话统计 | ✅ |
| GET | `/api/chat/sentiment/:strangerId` | 获取好感度（仅陌生人） | ✅ |

**API示例**:

通过uniqueCode创建会话：
```bash
POST /api/chat/sessions/by-code
Authorization: Bearer {token}
Body:
{
  "targetUniqueCode": "aB3!xY7$kL9@mN2"
}

Response:
{
  "success": true,
  "sessionId": "uuid-v4",
  "targetUser": {
    "id": "user-id",
    "name": "张三",
    "uniqueCode": "aB3!xY7$kL9@mN2"
  },
  "relation": {
    "type": "family",
    "assistRelationId": "relation-id",
    "specificRelation": "儿子",
    "assistantName": "小明"
  }
}
```

发送消息：
```bash
POST /api/chat/sessions/{sessionId}/messages
Authorization: Bearer {token}
Body:
{
  "message": "你好，最近怎么样？"
}

Response:
{
  "success": true,
  "message": "你好，小明！最近挺好的，你呢？",
  "sessionId": "uuid-v4",
  "metadata": {
    "retrievedMemoriesCount": 3,
    "modelUsed": "qwen2.5-14b-instruct",
    "relationType": "family",
    "sentimentScore": 52
  }
}
```

---

## F. 已实现的API（Phase 1）

| 服务 | 状态 | 文件位置 |
|------|------|---------|
| SentimentManager | ✅ 已实现 | /app/src/services/langchain/sentimentManager.js |
| LLMClient | ✅ 已实现 | /app/src/utils/llmClient.js |
| DualStorage扩展 | ✅ 已实现 | /app/src/services/dualStorage.js |
| 好感度API路由 | 📋 待创建 | /app/src/routes/sentiment.js |
| 存储API路由 | 📋 待创建 | /app/src/routes/storage.js |
