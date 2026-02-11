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

首次使用前，需要下载BAAI/bge-m3模型到modelserver容器：

```bash
# 在宿主机执行，下载模型到modelserver容器
docker exec afs-system-modelserver-1 ollama pull bge-m3

# 模型将保存在: modelserver/models/ (Docker自动挂载)
# 模型大小: 约2.2GB
```

### 环境配置

在 `.env` 文件中配置：

```bash
# Embedding后端选择: ollama | openai
EMBEDDING_BACKEND=ollama

# Ollama配置（Docker网络内部访问）
OLLAMA_BASE_URL=http://modelserver:11434
EMBEDDING_MODEL=bge-m3

# OpenAI配置（备用）
# OPENAI_API_KEY=your-api-key-here
```

**注意**: OLLAMA_BASE_URL使用Docker网络内部地址 `http://modelserver:11434`，而不是外部地址。

### 启动Ollama服务

Ollama服务通过Docker Compose统一管理：

```bash
# 启动所有容器（包括modelserver）
docker-compose up -d

# 查看容器状态
docker-compose ps

# 查看modelserver日志
docker-compose logs -f modelserver
```

### 验证配置

1. 检查modelserver容器状态：
   ```bash
   docker ps | grep modelserver
   ```

2. 检查已加载的模型：
   ```bash
   docker exec afs-system-modelserver-1 ollama list
   # 应该看到: bge-m3:latest
   ```

3. 测试embedding生成（外部访问）：
   ```bash
   curl http://localhost:8000/api/embed -d '{
     "model": "bge-m3",
     "input": "测试文本"
   }'
   ```

4. 查看server容器日志，确认EmbeddingService初始化成功：
   ```
   [EmbeddingService] Ollama embedding客户端初始化成功
   ```

### Docker配置说明

#### 端口映射
- `modelserver`: 8000:11434 (外部8000 → 内部11434)
- `server`: 3001:3000 (外部3001 → 内部3000)
- `web`: 3002:3000 (外部3002 → 内部3000)

#### Volume挂载
```yaml
modelserver:
  volumes:
    - ./modelserver/models:/root/.ollama/models
```
- **容器内**: `/root/.ollama/models`
- **宿主机**: `modelserver/models/`

#### Docker网络访问
- **server容器**（Docker网络内部）: `http://modelserver:11434`
- **宿主机**: `http://localhost:8000`

## 故障排查

### Ollama连接失败

**症状**: `[EmbeddingService] 初始化失败: ECONNREFUSED`

**解决方案**:

1. 检查modelserver容器是否运行
   ```bash
   docker ps | grep modelserver
   ```

2. 检查环境变量（应该使用Docker网络地址）
   ```bash
   # .env中应该包含:
   OLLAMA_BASE_URL=http://modelserver:11434
   ```

3. 查看server容器日志
   ```bash
   docker-compose logs server
   ```

4. 确保modelserver容器正常启动
   ```bash
   docker-compose logs modelserver
   ```

### 模型未加载

**症状**: `{"error":"this model does not support embeddings"}`
或 `[EmbeddingService] 健康检查失败: model not found`

**解决方案**:

1. 检查已加载的模型
   ```bash
   docker exec afs-system-modelserver-1 ollama list
   ```

2. 如果没有bge-m3，下载模型
   ```bash
   docker exec afs-system-modelserver-1 ollama pull bge-m3
   ```

3. 验证模型下载成功
   ```bash
   # 查看宿主机目录
   ls -la modelserver/models/blobs/
   # 应该看到bge-m3相关的文件
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
