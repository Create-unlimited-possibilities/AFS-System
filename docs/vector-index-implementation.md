# RAG向量索引实现文档

## 概述

为每个用户构建独立的ChromaDB向量索引，支持基于关系的RAG检索。

## 架构

### 后端服务

- **VectorIndexService**: 封装ChromaDB操作
  - `rebuildIndex(userId, progressCallback)`: 重建索引
  - `search(userId, query, topK, relationType, relationSpecificId)`: 向量搜索
  - `indexExists(userId)`: 检查索引是否存在
  - `getStats(userId)`: 获取索引统计

### API路由

- `POST /api/rolecard/vector-index/build`: 构建索引（SSE）
- `GET /api/rolecard/vector-index/status`: 获取索引状态

### 前端组件

- **BuildVectorIndexButton**: 记忆库构建按钮
- **buildVectorIndex()**: SSE客户端

## 数据结构

### 向量Document

```javascript
{
  id: "memory_uuid",
  embedding: [0.123, ...], // 1536维
  document: "问题: xxx\n回答: xxx",
  metadata: {
    userId: "user_id",
    memoryId: "uuid",
    questionId: "question_id",
    questionRole: "elder|family|friend",
    questionLayer: "basic|emotional",
    questionOrder: 1,
    category: "self|family|friend",
    helperId: "assistant_id", // family/friend时
    helperNickname: "助手昵称",
    importance: 0.85,
    tags: "positive,family",
    source: "questionnaire",
    createdAt: "2026-02-11T..."
  }
}
```

## 使用示例

### 构建向量索引

```typescript
await buildVectorIndex((data) => {
  console.log('Progress:', data)
  // { current: 30, total: 150, message: "正在处理记忆..." }
})
```

### 向量搜索

```javascript
const vectorService = new VectorIndexService();
const results = await vectorService.search(
  userId,
  "用户的童年回忆",
  5,
  'family',  // 只搜索家人记忆
  helperId   // 只搜索关于特定家人的记忆
);
```

## 故障排查

### 索引构建失败

1. 检查OPENAI_API_KEY是否设置
2. 检查用户是否有A套记忆
3. 查看后端日志

### RAG检索无结果

1. 检查向量索引是否存在
2. 检查relationType是否正确
3. 查看ChromaDB日志

## 性能优化

- 批量处理：每批50个记忆
- Embedding缓存：未来可添加
- 索引分片：未来可考虑
