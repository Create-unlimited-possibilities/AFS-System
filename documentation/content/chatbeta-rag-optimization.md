# Chat-Beta 角色卡生成和RAG索引优化

## 改进概述

根据需求，对角色卡生成后的RAG索引流程进行了全面优化，确保：
1. 角色卡生成后自动重建RAG索引
2. RAG索引包含详细的身份信息
3. RAG搜索时根据对话关系过滤记忆

---

## 1. RAG索引增强

### 1.1 Metadata结构升级

在 `vectorIndexService.js` 中增强metadata，添加详细身份信息：

```javascript
// 自己的记忆
{
  category: 'self',
  questionRole: 'elder',
  questionLayer: 'emotional',
  importance: 0.8,
  tags: 'positive,family',
  source: 'questionnaire'
}

// 家人记忆
{
  category: 'family',
  helperId: '673a...',
  helperNickname: '儿子小明',
  specificRelation: 'son',
  questionRole: 'family',
  questionLayer: 'emotional',
  importance: 0.9,
  tags: 'positive,family',
  source: 'questionnaire'
}

// 朋友记忆
{
  category: 'friend',
  friendId: '673b...',
  friendNickname: '老张',
  friendLevel: 'close', // casual/close/intimate
  questionRole: 'friend',
  questionLayer: 'emotional',
  importance: 0.7,
  tags: 'social,work',
  source: 'questionnaire'
}
```

### 1.2 分类存储结构

```
/app/storage/userdata/{userId}/
├── A_set/                    # 自己的记忆（A套问题）
│   └── self/
│       ├── basic/             # 基础层问题
│       │   ├── question_1.json
│       │   └── question_2.json
│       └── emotional/         # 情感层问题
│           ├── question_1.json
│           └── question_2.json
├── B_sets/                   # 家人记忆（B套问题）
│   ├── {helperId}_{nickname}/    # 每个家人一个文件夹
│   │   ├── basic/
│   │   └── emotional/
│   └── {helperId2}_{nickname2}/
│       ├── basic/
│       └── emotional/
└── C_sets/                   # 朋友记忆（C套问题）
    ├── {helperId}_{nickname}/    # 每个朋友一个文件夹
    │   ├── basic/
    │   └── emotional/
    └── {helperId2}_{nickname2}/
        ├── basic/
        └── emotional/
```

---

## 2. 角色卡生成流程优化

### 2.1 自动触发RAG索引重建

在 `chatbeta.js` 的 `/rolecard/generate` 路由中：

```javascript
// 生成角色卡
const roleCard = await roleCardGenerator.generateRoleCard(userId);

// 存储到数据库
await User.findByIdAndUpdate(userId, {
  $set: { 'chatBeta.roleCard': roleCard }
});

// 自动触发RAG索引重建
try {
  await vectorService.rebuildIndex(userId);
  console.log(`[chatbeta] 角色卡生成后RAG索引重建完成: ${userId}`);
} catch (rebuildError) {
  console.error('[chatbeta] RAG索引重建失败:', rebuildError);
}
```

### 2.2 重建索引流程

`vectorService.rebuildIndex()` 执行步骤：
1. 加载所有ABC套问题的记忆（从文件系统）
2. 合并为完整的记忆列表
3. 删除旧的RAG索引
4. 创建新的RAG索引，包含增强的metadata
5. 存储在 `/app/storage/userdata/chroma_db/user_{userId}`

---

## 3. RAG搜索优化

### 3.1 搜索接口增强

在 `vectorIndexService.js` 中添加关系过滤：

```javascript
async search(userId, query, topK = 5, relationType = null, relationSpecificId = null) {
  let whereClause = {};

  if (relationType) {
    if (relationType === 'family') {
      whereClause.category = { $eq: 'family' };
      if (relationSpecificId) {
        whereClause.helperId = { $eq: relationSpecificId };
      }
    } else if (relationType === 'friend') {
      whereClause.category = { $eq: 'friend' };
      if (relationSpecificId) {
        whereClause.friendId = { $eq: relationSpecificId };
      }
    }
  }

  const results = await collection.query({
    queryTexts: [query],
    nResults: topK,
    where: Object.keys(whereClause).length > 0 ? whereClause : undefined
  });
}
```

### 3.2 搜索场景示例

**场景1：家人对话**
```javascript
// 当前用户正在与"儿子小明"（ID: 673a...）对话
vectorService.search(
  userId,
  query,
  5,
  'family',           // 只搜索家人记忆
  '673a...'          // 只搜索关于这个特定家人的记忆
);
```

**场景2：朋友对话**
```javascript
// 当前用户正在与"老张"（ID: 673b...）对话
vectorService.search(
  userId,
  query,
  5,
  'friend',           // 只搜索朋友记忆
  '673b...'          // 只搜索关于这个特定朋友的记忆
);
```

**场景3：陌生人对话**
```javascript
// 当前用户与陌生人对话
vectorService.search(
  userId,
  query,
  5,
  null,              // 不过滤，搜索所有记忆
  null
);
```

---

## 4. 前端调用优化

### 4.1 API调用增强

在 `chatbeta-api.js` 中：

```javascript
async searchRAG(userId, query, topK = 5, relationType = 'stranger', relationSpecificId = null) {
  return this.request('/rag/search', {
    method: 'POST',
    body: JSON.stringify({ userId, query, topK, relationType, relationSpecificId })
  });
}
```

### 4.2 聊天消息发送

在 `chatbeta-chat.js` 中：

```javascript
async sendMessage(message) {
  const ragRes = await chatBetaAPI.searchRAG(
    targetUser.uniqueCode,
    message,
    5,
    relation.relationType,    // family/friend/stranger
    relation.assistantId       // 具体的协助者ID（用于精确过滤）
  );
  // ...
}
```

---

## 5. 数据流程图

```
用户点击"生成角色卡"
    ↓
后端接收请求
    ↓
生成角色卡（roleCardGenerator）
    ↓
保存角色卡到MongoDB
    ↓
自动触发RAG索引重建
    ↓
加载文件系统中的所有记忆（ABC套）
    ↓
创建增强的metadata（包含详细身份信息）
    ↓
构建RAG向量索引
    ↓
存储到本地文件系统
    ↓
返回成功响应
    ↓
前端显示"角色卡生成成功"

---

聊天时搜索RAG
    ↓
根据对话关系（family/friend/stranger）
    ↓
如果关系明确，过滤metadata.category
    ↓
如果知道具体人员，过滤helperId/friendId
    ↓
返回相关记忆
    ↓
AI根据记忆生成回复
```

---

## 6. 文件修改列表

### 后端：
1. `server/src/services/vectorIndexService.js`
   - 增强 `buildIndex()` 方法，添加详细metadata
   - 增强 `addToIndex()` 方法，添加详细metadata
   - 增强 `search()` 方法，支持关系过滤

2. `server/src/routes/chatbeta.js`
   - 修改 `/rolecard/generate` 路由，自动触发RAG索引重建
   - 修改 `/rag/search` 路由，支持关系过滤
   - 修改 `/login` 路由，添加 assistantId 到 relation 对象

### 前端：
1. `client/public/assets/js/chatbeta-api.js`
   - 增强 `searchRAG()` 方法，支持 relationSpecificId 参数

2. `client/public/assets/js/chatbeta-chat.js`
   - 修改 `sendMessage()` 方法，传递 relation.assistantId

---

## 7. 测试验证

### 7.1 角色卡生成测试
1. 完成A套问题（至少10个情感层）
2. 点击"生成角色卡"
3. 检查日志确认RAG索引重建成功
4. 验证ChromaDB中包含所有ABC套记忆

### 7.2 RAG搜索测试
1. 作为家人（如儿子）与用户对话
2. 发送消息
3. 验证只返回关于这个家人的记忆
4. 作为朋友（如老张）与用户对话
5. 发送消息
6. 验证只返回关于这个朋友的记忆

### 7.3 数据隔离测试
1. 用户A生成角色卡
2. 验证RAG索引只包含用户A的记忆
3. 用户B生成角色卡
4. 验证RAG索引只包含用户B的记忆
5. 确认两个用户的RAG库完全独立

---

## 8. 性能考虑

- **索引重建**：在角色卡生成时触发，异步执行，不影响用户体验
- **搜索性能**：通过metadata过滤减少搜索范围，提高响应速度
- **存储优化**：使用ChromaDB本地模式，数据存储在用户本地文件系统
- **内存占用**：ChromaDB支持内存+持久化，平衡性能和存储
