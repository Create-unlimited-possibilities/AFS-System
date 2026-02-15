# 本地Embedding模型集成测试指南

## 前置条件

1. **Ollama服务运行中**
   ```bash
   # 检查Docker容器是否运行
   docker ps | grep modelserver
   
   # 如果未运行，启动所有容器
   docker-compose up -d
   ```

2. **bge-m3模型已加载**
   ```bash
   # 检查模型列表（在宿主机执行）
   docker exec afs-system-modelserver-1 ollama list
   
   # 如果未加载，下载模型
   docker exec afs-system-modelserver-1 ollama pull bge-m3
   # 等待下载完成（约2.2GB）
   ```

3. **环境变量已配置**
   ```bash
   # .env 文件中包含:
   EMBEDDING_BACKEND=ollama
   OLLAMA_BASE_URL=http://modelserver:11434
   EMBEDDING_MODEL=bge-m3
   ```

## 测试步骤

### 1. 启动后端服务

```bash
# 启动所有Docker容器（如果未启动）
docker-compose up -d

# 查看server容器日志
docker-compose logs -f server
```

预期输出：
```
[EmbeddingService] Ollama embedding客户端初始化成功
[VectorIndexService] ChromaDB客户端初始化成功
```

### 2. 测试EmbeddingService（可选）

```javascript
// 创建测试脚本 test-embedding.js
import EmbeddingService from './src/services/EmbeddingService.js';

const service = new EmbeddingService();

// 测试初始化
await service.initialize();
console.log('✓ EmbeddingService初始化成功');

// 测试单文本embedding
const embedding = await service.embedQuery('测试文本');
console.log('✓ 单文本embedding生成成功', embedding.length, '维');

// 测试健康检查
const isHealthy = await service.healthCheck();
console.log('✓ 健康检查通过:', isHealthy);
```

运行：
```bash
# 进入server容器执行（或在宿主机运行如果node_modules已挂载）
docker exec -it afs-system-server-1 node /app/test-embedding.js
```

### 3. 测试向量索引构建

```bash
# 使用API构建索引（在宿主机执行）
curl -X POST http://localhost:3001/api/rolecard/vector-index/build \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  --no-buffer
```

预期输出（SSE）：
```
event: progress
data: {"current":0,"total":100,"message":"开始构建向量索引..."}

event: progress
data: {"current":50,"total":100,"message":"正在处理记忆 50/100..."}

event: done
data: {"success":true,"memoryCount":100}
```

### 4. 测试RAG检索

通过前端创建对话会话（家人/朋友关系），发送消息，验证：

1. 日志中显示向量搜索：
   ```
   [VectorIndexService] 搜索完成 - Query: "用户的问题", Found: 5
   ```

2. 返回相关记忆：
   ```json
   {
     "memories": [
       {
         "content": "问题: xxx\n回答: xxx",
         "relevanceScore": 0.85,
         "category": "family"
       }
     ]
   }
   ```

### 5. 验证无OpenAI依赖

1. 不设置OPENAI_API_KEY环境变量
2. 确认后端正常启动
3. 确认向量索引成功构建
4. 确认RAG检索正常工作

## 故障排查

### EmbeddingService初始化失败

**症状**: `[EmbeddingService] 初始化失败: ECONNREFUSED`

**解决方案**:
1. 检查modelserver容器是否运行
   ```bash
   docker ps | grep modelserver
   ```
2. 检查OLLAMA_BASE_URL是否正确 (应该是 `http://modelserver:11434`)
3. 查看server容器日志:
   ```bash
   docker-compose logs server
   ```

### 模型不支持embedding

**症状**: `{"error":"this model does not support embeddings"}`

**解决方案**:
1. 确认使用bge-m3模型
   ```bash
   docker exec afs-system-modelserver-1 ollama list
   ```
2. 下载bge-m3模型:
   ```bash
   docker exec afs-system-modelserver-1 ollama pull bge-m3
   ```

### 向量索引构建失败

**症状**: `[VectorIndexService] 索引重建失败: embedding generation failed`

**解决方案**:
1. 检查modelserver容器是否有足够的内存/GPU
2. 检查bge-m3模型是否正确加载
3. 查看modelserver容器日志:
   ```bash
   docker-compose logs modelserver
   ```

### Ollama命令失败

**症状**: `Error: No such container` 或 `command not found`

**解决方案**:
1. 确认容器名称:
   ```bash
   docker ps --format "{{.Names}}"
   ```
2. 确认modelserver容器正在运行

## 性能基准

| 操作 | 预期时间 | 备注 |
|------|----------|------|
| EmbeddingService初始化 | < 100ms | 首次调用 |
| 单文本embedding | 50-200ms | bge-m3模型 |
| 批量embedding (50条) | 2-5s | 取决于硬件 |
| 向量索引构建 (100条记忆) | 10-30s | 取决于硬件 |
| RAG检索 (topK=5) | < 100ms | ChromaDB查询 |

## 成功标准

- ✓ modelserver容器正常运行
- ✓ bge-m3模型已加载到Ollama
- ✓ EmbeddingService成功初始化（无OPENAI_API_KEY）
- ✓ 向量索引成功构建
- ✓ RAG检索返回相关记忆
- ✓ 所有操作日志正常
- ✓ 无OpenAI相关错误
