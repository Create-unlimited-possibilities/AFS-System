# 本地Embedding模型支持 - 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 移除OpenAI依赖，使用免费本地Ollama模型（BAAI/bge-m3）支持中文语义，让RAG功能无需API Key即可使用。

**Architecture:** 添加EmbeddingService抽象层，支持Ollama本地模型；下载BAAI/bge-m3模型到server/models/；通过环境变量配置；更新VectorIndexService使用新服务。

**Tech Stack:** Ollama（已有）、BAAI/bge-m3模型、Node.js + Express

---

## 设计决策

| 设计问题 | 选择 | 理由 |
|---------|------|------|
| Embedding后端 | **完全替换为Ollama本地** | 用户明确要求仅使用本地免费模型 |
| 模型下载路径 | `server/models/embedding_model/` | 用户指定，避免git仓库膨胀 |
| 配置方式 | .env环境变量 | 灵活切换，不污染代码 |
| Ollama集成 | **待确认：复用 vs 新实例** | 需要在实施前确认 |

---

## 任务分解

### Task 1: 创建EmbeddingService抽象层

**Files:**
- Create: `server/src/services/EmbeddingService.js`
- Create: `server/tests/unit/EmbeddingService.test.js`

**Step 1: 创建服务类骨架**

```javascript
// server/src/services/EmbeddingService.js
/**
 * Embedding服务抽象层
 * 支持多种后端（Ollama本地、OpenAI等）
 *
 * @author AFS Team
 * @version 1.0.0
 */

import logger from '../utils/logger.js';

class EmbeddingService {
  constructor() {
    this.backend = process.env.EMBEDDING_BACKEND || 'ollama';
    this.client = null;
  }

  /**
   * 初始化客户端
   */
  async initialize() {
    if (this.client) return;

    try {
      if (this.backend === 'ollama') {
        const { OllamaClient } = await import('./ollama/EmbeddingClient.js');
        this.client = new OllamaClient({
          baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
          model: process.env.EMBEDDING_MODEL || 'bge-m3'
        });
        logger.info('[EmbeddingService] Ollama embedding客户端初始化成功');
      } else if (this.backend === 'openai') {
        // OpenAI支持（备用）
        const { OpenAIEmbeddings } = await import('@langchain/openai');
        this.client = new OpenAIEmbeddings({
          openAIApiKey: process.env.OPENAI_API_KEY,
          modelName: 'text-embedding-3-small'
        });
        logger.info('[EmbeddingService] OpenAI embedding客户端初始化成功');
      }
    } catch (error) {
      logger.error('[EmbeddingService] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 生成单个文本的embedding
   */
  async embedQuery(text) {
    await this.initialize();
    return this.client.embedQuery(text);
  }

  /**
   * 生成多个文本的embeddings（批量）
   */
  async embedDocuments(texts) {
    await this.initialize();
    return this.client.embedDocuments(texts);
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      await this.initialize();
      const testResult = await this.client.embedQuery('test');
      logger.info('[EmbeddingService] 健康检查通过');
      return true;
    } catch (error) {
      logger.warn('[EmbeddingService] 健康检查失败:', error.message);
      return false;
    }
  }
}

export default EmbeddingService;
```

**Step 2: 创建Ollama Embedding客户端**

```javascript
// server/src/services/ollama/EmbeddingClient.js
/**
 * Ollama Embedding客户端
 *
 * @author AFS Team
 * @version 1.0.0
 */

class OllamaEmbeddingClient {
  constructor({ baseUrl, model }) {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  /**
   * 生成单个文本的embedding
   */
  async embedQuery(text) {
    try {
      const response = await fetch(`${this.baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          input: text
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return data.embedding;
    } catch (error) {
      if (error.message.includes('ECONNREFUSED')) {
        throw new Error('Ollama服务未启动，请启动Ollama服务');
      }
      throw error;
    }
  }

  /**
   * 生成多个文本的embeddings（批量）
   */
  async embedDocuments(texts) {
    try {
      const response = await fetch(`${this.baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          input: texts
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return data.embeddings;
    } catch (error) {
      throw error;
    }
  }
}

export { OllamaEmbeddingClient };
```

**Step 3: 添加单元测试**

```javascript
// server/tests/unit/EmbeddingService.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import EmbeddingService from '../../src/services/EmbeddingService.js';

describe('EmbeddingService', () => {
  let embeddingService;

  beforeEach(() => {
    vi.resetModules();
    process.env.EMBEDDING_BACKEND = 'ollama';
    embeddingService = new EmbeddingService();
  });

  it('should initialize Ollama client', async () => {
    await embeddingService.initialize();
    expect(embeddingService.client).toBeDefined();
  });

  it('should throw error if Ollama not available', async () => {
    vi.stubEnv('OLLAMA_HOST', 'http://invalid-host');
    await expect(embeddingService.healthCheck()).rejects.toThrow();
  });
});
```

**Step 4: 运行测试**

Run: `npm run test:unit EmbeddingService.test.js`
Expected: 测试通过

**Step 5: 提交**

```bash
git add server/src/services/EmbeddingService.js server/src/services/ollama/EmbeddingClient.js server/tests/unit/EmbeddingService.test.js
git commit -m "feat: create EmbeddingService abstraction layer with Ollama support"
```

---

### Task 2: 下载BAAI/bge-m3模型

**Files:**
- Create: `server/scripts/download-model.js`
- Modify: `.env.example`

**Step 1: 创建模型下载脚本**

```javascript
// server/scripts/download-model.js
/**
 * BAAI/bge-m3模型下载脚本
 *
 * @author AFS Team
 * @version 1.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const MODEL_URL = 'https://modelscope.cn/api/v1/models/BAAI/bge-m3/resolve/download';
const MODEL_NAME = 'bge-m3';
const MODEL_FILE = 'bge-m3-f16.gguf';
const TARGET_DIR = path.join(process.cwd(), 'server/models/embedding_model');
const MODEL_PATH = path.join(TARGET_DIR, MODEL_FILE);

async function downloadModel() {
  console.log(`开始下载模型: ${MODEL_NAME}`);
  console.log(`目标路径: ${MODEL_PATH}`);

  try {
    // 检查模型是否已存在
    try {
      await fs.access(MODEL_PATH);
      console.log('模型已存在，跳过下载');
      return;
    } catch {
      // 不存在，继续下载
    }

    // 确保目标目录存在
    await fs.mkdir(TARGET_DIR, { recursive: true });

    // 下载文件
    const response = await https.get(MODEL_URL);
    const totalSize = parseInt(response.headers['content-length'], 10);
    let downloadedSize = 0;

    const fileStream = fs.createWriteStream(MODEL_PATH);
    response.pipe(fileStream);

    response.on('data', (chunk) => {
      downloadedSize += chunk.length;
      const progress = ((downloadedSize / totalSize) * 100).toFixed(1);
      process.stdout.write(`\r下载进度: ${progress}%`);
    });

    await new Promise((resolve, reject) => {
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });

    console.log('\n模型下载完成！');
    console.log(`文件大小: ${(totalSize / 1024 / 1024).toFixed(2)} GB`);
    console.log(`模型路径: ${MODEL_PATH}`);
  } catch (error) {
    console.error('模型下载失败:', error);
    process.exit(1);
  }
}

downloadModel();
```

**Step 2: 添加npm script**

```json
// server/package.json
{
  "scripts": {
    "download:embedding-model": "node scripts/download-model.js"
  }
}
```

**Step 3: 更新.env.example**

```bash
# Embedding配置
# 后端选择: ollama | openai
EMBEDDING_BACKEND=ollama

# Ollama配置
OLLAMA_HOST=http://localhost:11434
EMBEDDING_MODEL=bge-m3

# OpenAI配置（备用）
# OPENAI_API_KEY=your-api-key-here
```

**Step 4: 添加.gitignore规则**

```
# server/.gitignore
models/embedding_model/
*.gguf
```

**Step 5: 添加说明注释**

```bash
# .env.example
# 注意: BAAI/bge-m3模型文件约2.2GB，需要下载到server/models/embedding_model/
# 首次运行前，请执行: npm run download:embedding-model
# 或者从 https://modelscope.cn/api/v1/models/BAAI/bge-m3/resolve/download 手动下载
```

**Step 6: 提交**

```bash
git add server/scripts/download-model.js server/package.json .env.example .gitignore
git commit -m "feat: add model download script and environment configuration"
```

---

### Task 3: 更新VectorIndexService使用新EmbeddingService

**Files:**
- Modify: `server/src/services/vectorIndexService.js`

**Step 1: 替换OpenAIEmbeddings为EmbeddingService**

在 `vectorIndexService.js` 中：

```javascript
// 移除
import { OpenAIEmbeddings } from '@langchain/openai';

// 添加
import EmbeddingService from './EmbeddingService.js';
```

**Step 2: 修改initialize方法**

```javascript
async initialize() {
  if (this.client) return;

  try {
    // 移除OpenAI相关代码
    // this.client = new ChromaClient({...});
    // this.embeddings = new OpenAIEmbeddings({...});

    // 使用新的EmbeddingService
    this.embeddingService = new EmbeddingService();
    await this.embeddingService.initialize();

    this.client = new ChromaClient({
      path: process.env.STORAGE_PATH || '/app/storage/userdata/chroma_db'
    });

    logger.info('[VectorIndexService] 向量索引服务初始化成功');
  } catch (error) {
    logger.error('[VectorIndexService] 初始化失败:', error);
    throw error;
  }
}
```

**Step 3: 修改rebuildIndex方法**

```javascript
async rebuildIndex(userId, progressCallback) {
  await this.initialize();

  const startTime = Date.now();
  const collection = await this.getCollection(userId);

  try {
    logger.info(`[VectorIndexService] 开始重建索引 - User: ${userId}`);

    // 删除旧索引
    await collection.delete({ where: {} });
    logger.info('[VectorIndexService] 旧索引已清空');

    // 加载记忆文件
    const { loadUserMemories } = await import('./fileStorage.js');
    const FileStorage = (await import('./fileStorage.js')).default;
    const fileStorage = new FileStorage();

    const memories = await fileStorage.loadUserMemories(userId);
    const allMemories = [
      ...memories.A_set,
      ...memories.Bste,
      ...memories.Cste
    ];

    if (allMemories.length === 0) {
      throw new Error('用户没有任何记忆文件');
    }

    const total = allMemories.length;
    logger.info(`[VectorIndexService] 加载到 ${total} 条记忆`);

    // 批量处理记忆
    const batchSize = 50;
    const processedMemories = [];

    for (let i = 0; i < allMemories.length; i += batchSize) {
      const batch = allMemories.slice(i, i + batchSize);

      for (const memory of batch) {
        const text = this.buildMemoryText(memory);

        // 使用EmbeddingService替代OpenAIEmbeddings
        const embedding = await this.embeddingService.embedQuery(text);

        const metadata = this.buildMetadata(memory);

        processedMemories.push({
          id: memory.memoryId,
          embedding,
          document: text,
          metadata
        });

        // 进度回调
        const current = processedMemories.length;
        if (progressCallback) {
          progressCallback({
            current,
            total,
            message: `正在处理记忆 ${current}/${total}...`
          });
        }
      }

      // 批量插入ChromaDB
      if (processedMemories.length > 0) {
        await this.batchInsert(collection, processedMemories);
        processedMemories.length = 0;
      }
    }

    const duration = Date.now() - startTime;

    // 统计信息
    const stats = await this.getStats(userId);

    logger.info(`[VectorIndexService] 索引重建完成 - User: ${userId}, Count: ${total}, Duration: ${duration}ms`);

    return {
      success: true,
      userId,
      memoryCount: total,
      categories: {
        self: memories.A_set.length,
        family: memories.Bste.length,
        friend: memories.Cste.length
      },
      duration
    };
  } catch (error) {
    logger.error('[VectorIndexService] 索引重建失败:', error);
    throw error;
  }
}
```

**Step 4: 修改search方法**

```javascript
async search(userId, query, topK = 5, relationType = null, relationSpecificId = null) {
  await this.initialize();

  try {
    const collection = await this.getCollection(userId);

    // 使用EmbeddingService替代OpenAIEmbeddings
    const queryEmbedding = await this.embeddingService.embedQuery(query);

    let where = {};
    if (relationType) {
      where.category = relationType;
      if (relationSpecificId) {
        where.helperId = relationSpecificId;
      }
    }

    // 执行搜索
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: topK,
      where: Object.keys(where).length > 0 ? where : undefined
    });

    // 格式化结果
    const memories = [];
    if (results.documents && results.documents[0]) {
      for (let i = 0; i < results.documents[0].length; i++) {
        memories.push({
          content: results.documents[0][i],
          relevanceScore: 1 - (results.distances?.[0]?.[i] || 0),
          category: results.metadatas?.[0]?.[i]?.category || 'self',
          metadata: results.metadatas?.[0]?.[i] || {}
        });
      }
    }

    logger.info(`[VectorIndexService] 搜索完成 - Query: "${query}", Found: ${memories.length}`);

    return memories;
  } catch (error) {
    logger.error('[VectorIndexService] 搜索失败:', error);
    return [];
  }
}
```

**Step 5: 更新单元测试**

修改 `vectorIndexService.test.js` 中的所有embedding相关测试，移除OpenAI mock，添加Ollama mock：

```javascript
// Mock Ollama client
vi.mock('../src/services/EmbeddingService.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    embedQuery: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    embedDocuments: vi.fn().mockResolvedValue([[0.1], [0.2]])
  }))
}));
```

**Step 6: 运行测试**

Run: `npm run test:unit vectorIndexService.test.js`
Expected: 所有测试通过

**Step 7: 提交**

```bash
git add server/src/services/vectorIndexService.js server/tests/unit/vectorIndexService.test.js
git commit -m "refactor: replace OpenAI with EmbeddingService for local model support"
```

---

### Task 4: 更新文档

**Files:**
- Modify: `docs/vector-index-implementation.md`

**Step 1: 添加本地模型支持说明**

```markdown
## 本地Embedding模型支持

### 模型下载

首次使用前，需要下载BAAI/bge-m3模型：

```bash
cd server
npm run download:embedding-model
```

模型将下载到：`server/models/embedding_model/bge-m3-f16.gguf`

### 环境配置

在 `.env` 文件中配置：

```bash
EMBEDDING_BACKEND=ollama
OLLAMA_HOST=http://localhost:11434
EMBEDDING_MODEL=bge-m3
```

### 启动Ollama服务

Ollama服务需要独立启动：

```bash
# 使用Docker（推荐）
docker run -d -p 11434:11434 -v ${PWD}/server/models:/models ollama/ollama bge-m3

# 或使用本地安装
ollama serve bge-m3 --models-path ./server/models/embedding_model
```

### 支持的后端

- **ollama**：本地免费模型，推荐用于生产环境
- **openai**：OpenAI API（备用，仍需要API Key）
```

**Step 2: 添加故障排查**

```markdown
### 故障排查

#### Ollama连接失败

1. 检查Ollama服务是否启动
   ```bash
   curl http://localhost:11434/api/tags
   ```

2. 检查环境变量
   ```bash
   echo $OLLAMA_HOST
   echo $EMBEDDING_MODEL
   ```

3. 查看服务器日志
   ```
   [EmbeddingService] 初始化失败: ECONNREFUSED
   ```

#### 模型文件不存在

1. 检查模型路径
   ```bash
   ls -la server/models/embedding_model/
   ```

2. 重新下载模型
   ```bash
   npm run download:embedding-model
   ```
```

**Step 3: 提交**

```bash
git add docs/vector-index-implementation.md
git commit -m "docs: add local embedding model support documentation"
```

---

## Task 5: 集成测试

**Files:**
- Test: 手动测试

**Step 1: 启动Ollama服务**

```bash
# 方式1: Docker（推荐）
docker run -d -p 11434:11434 -v ${PWD}/server/models:/models ollama/ollama bge-m3

# 方式2: 本地安装
ollama serve bge-m3 --models-path ./server/models/embedding_model
```

**Step 2: 测试场景**

1. **测试EmbeddingService**
   - 访问健康检查端点
   - 验证Ollama连接成功

2. **测试RAG检索**
   - 确保向量索引已构建
   - 创建对话会话（家人/朋友）
   - 发送消息
   - 验证日志显示向量搜索
   - 验证返回相关记忆

3. **验证无OpenAI依赖**
   - 不设置OPENAI_API_KEY
   - 确认功能正常工作

**Step 3: 提交**

```bash
git commit --allow-empty -m "test: complete integration testing for local embedding model"
```

---

## 总结

### 新增文件
- `server/src/services/EmbeddingService.js` - Embedding服务抽象层
- `server/src/services/ollama/EmbeddingClient.js` - Ollama Embedding客户端
- `server/tests/unit/EmbeddingService.test.js` - 单元测试
- `server/scripts/download-model.js` - 模型下载脚本

### 修改文件
- `server/src/services/vectorIndexService.js` - 使用EmbeddingService替代OpenAI
- `server/package.json` - 添加下载脚本npm命令
- `.env.example` - 添加Embedding配置说明
- `.gitignore` - 排除models/目录
- `docs/vector-index-implementation.md` - 添加本地模型文档

### 关键特性
✅ 移除OpenAI依赖
✅ 支持免费本地Ollama模型
✅ 支持中文语义（BAAI/bge-m3）
✅ 环境变量配置后端
✅ 模型自动下载脚本
✅ 完全向后兼容（OpenAI仍作为备用后端）

### Ollama集成方案说明

**关于Ollama集成，我建议使用方案B：复用现有LLM客户端**

理由：
1. 项目已有`llmClient.ts`，Ollama已配置
2. 复用连接，减少资源占用
3. 代码更简洁，维护成本更低

实现方式：
- 在`EmbeddingClient`中复用`llmClient.ts`的`fetchWithRetry`逻辑
- 共享HTTP客户端配置
- 线程安全通过单例模式

需要您确认此方案后再实施。
