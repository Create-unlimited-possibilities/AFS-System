# RAG向量索引实现文档

## 概述

为每个用户构建独立的ChromaDB向量索引，支持基于关系的RAG检索。

## 架构

### 后端服务

- **EmbeddingService**: Embedding服务抽象层
  - 支持多种后端：Ollama（本地）、OpenAI（API）
  - `initialize()`: 初始化客户端
  - `embedQuery(text)`: 生成单个文本的embedding
  - `embedDocuments(texts)`: 批量生成embeddings
  - `healthCheck()`: 健康检查

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

## 本地Embedding模型支持

### 支持的后端

系统支持两种Embedding后端：

#### Ollama（推荐，免费本地）

- **模型**: BAAI/bge-m3
- **特点**: 免费、支持中文语义、无需API Key
- **性能**: ~2.2GB模型文件，适合生产环境

#### OpenAI（备用，需要API Key）

- **模型**: text-embedding-3-small
- **特点**: 速度快、需要付费
- **用途**: 作为备用选项，向后兼容

### 模型下载

首次使用前，需要下载BAAI/bge-m3模型：

```bash
cd server
npm run download:embedding-model
```

模型将下载到：`server/models/embedding_model/bge-m3.gguf`

### 环境配置

在 `.env` 文件中配置：

```bash
# Embedding后端选择: ollama | openai
EMBEDDING_BACKEND=ollama

# Ollama配置
OLLAMA_BASE_URL=http://localhost:11434
EMBEDDING_MODEL=bge-m3

# OpenAI配置（备用）
# OPENAI_API_KEY=your-api-key-here
```

### 启动Ollama服务

Ollama服务需要独立启动：

#### Docker方式（推荐）

```bash
# 启动Ollama容器
docker run -d -p 11434:11434 \
  -v ${PWD}/server/models:/models \
  ollama/ollama

# 加载bge-m3模型
docker exec -it <container_id> ollama pull bge-m3
```

#### 本地安装方式

```bash
# 安装Ollama（如果未安装）
curl -fsSL https://ollama.com/install.sh | sh

# 启动Ollama服务
ollama serve

# 在另一个终端加载模型
ollama pull bge-m3
```

### 验证配置

1. 检查Ollama服务状态：
   ```bash
   curl http://localhost:11434/api/tags
   ```

2. 测试embedding生成：
   ```bash
   curl http://localhost:11434/api/embed -d '{
     "model": "bge-m3",
     "input": "测试文本"
   }'
   ```

3. 查看后端日志，确认EmbeddingService初始化成功：
   ```
   [EmbeddingService] Ollama embedding客户端初始化成功
   ```

## 故障排查

### Ollama连接失败

**症状**: `[EmbeddingService] 初始化失败: ECONNREFUSED`

**解决方案**:

1. 检查Ollama服务是否启动
   ```bash
   curl http://localhost:11434/api/tags
   ```

2. 检查环境变量
   ```bash
   echo $OLLAMA_BASE_URL
   echo $EMBEDDING_MODEL
   ```

3. 查看服务器日志
   ```
   [EmbeddingService] 初始化失败: ECONNREFUSED
   ```

4. 确保Ollama在正确的端口运行（默认11434）

### 模型文件不存在

**症状**: `[EmbeddingService] 健康检查失败: model not found`

**解决方案**:

1. 检查模型路径
   ```bash
   ls -la server/models/embedding_model/
   ```

2. 重新下载模型
   ```bash
   npm run download:embedding-model
   ```

3. 确保Ollama已加载模型
   ```bash
   ollama list
   # 应该看到 bge-m3
   ```

### 索引构建失败

1. 检查EmbeddingService是否初始化成功
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
