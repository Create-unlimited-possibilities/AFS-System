# RAG向量索引构建 - 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为每个用户构建独立的ChromaDB向量索引，支持基于关系的RAG检索，提供实时进度反馈。

**Architecture:** 新增VectorIndexService服务封装ChromaDB操作；新增向量索引构建API（带SSE进度）；新增前端"记忆库构建"按钮；集成到ragRetrieverNode。

**Tech Stack:** ChromaDB v1.8.1（已安装）、OpenAI embeddings、Server-Sent Events (SSE)、Node.js + Express

---

## 设计确认

| 设计决策 | 选择 | 理由 |
|---------|------|------|
| 进度反馈 | SSE（选项A） | 与角色卡生成一致，实时反馈 |
| 触发条件 | 完成至少一个A套问题（选项B） | 确保有基础记忆 |
| 元数据设计 | 全部包含 | metadata小，便于未来扩展 |

---

## 任务分解

### Task 1: 创建VectorIndexService基础结构

**Files:**
- Create: `server/src/services/vectorIndexService.js`
- Test: `server/tests/unit/vectorIndexService.test.js`

**Step 1: 创建基础VectorIndexService类骨架**

```javascript
// server/src/services/vectorIndexService.js
/**
 * 向量索引服务
 * 管理ChromaDB向量索引的创建、更新和检索
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { ChromaClient } from 'chromadb';
import { OpenAIEmbeddings } from '@langchain/openai';
import logger from '../utils/logger.js';

class VectorIndexService {
  constructor() {
    this.client = null;
    this.embeddings = null;
    this.collections = new Map(); // 缓存已加载的collections
  }

  /**
   * 初始化ChromaDB客户端和embeddings
   */
  async initialize() {
    if (this.client) return;

    try {
      // 使用本地模式，数据存储在文件系统
      this.client = new ChromaClient({
        path: process.env.STORAGE_PATH || '/app/storage/userdata/chroma_db'
      });

      // 初始化OpenAI embeddings
      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: 'text-embedding-3-small' // 性价比高
      });

      logger.info('[VectorIndexService] ChromaDB客户端初始化成功');
    } catch (error) {
      logger.error('[VectorIndexService] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取或创建用户collection
   * @param {string} userId - 用户ID
   * @returns {Promise} ChromaDB collection
   */
  async getCollection(userId) {
    await this.initialize();

    const collectionName = `user_${userId}`;

    // 检查缓存
    if (this.collections.has(collectionName)) {
      return this.collections.get(collectionName);
    }

    try {
      // 尝试获取现有collection
      const collection = await this.client.getCollection({ name: collectionName });
      this.collections.set(collectionName, collection);
      return collection;
    } catch (error) {
      if (error.message?.includes('does not exist')) {
        // Collection不存在，创建新的
        logger.info(`[VectorIndexService] 创建collection: ${collectionName}`);
        const collection = await this.client.createCollection({
          name: collectionName,
          metadata: {
            userId,
            createdAt: new Date().toISOString()
          }
        });
        this.collections.set(collectionName, collection);
        return collection;
      } else {
        throw error;
      }
    }
  }
}

export default VectorIndexService;
```

**Step 2: 写入失败测试**

```javascript
// server/tests/unit/vectorIndexService.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import VectorIndexService from '../../src/services/vectorIndexService.js';

describe('VectorIndexService', () => {
  let vectorService;

  beforeEach(() => {
    vectorService = new VectorIndexService();
  });

  it('should throw error when trying to use uninitialized service', async () => {
    expect(vectorService.getCollection('user123')).rejects.toThrow();
  });
});
```

**Step 3: 运行测试验证失败**

Run: `npm run test:unit vectorIndexService.test.js`
Expected: FAIL with "service not initialized"

**Step 4: 确保代码可以导入（无需实际运行）**

Run: `node -e "import('./server/src/services/vectorIndexService.js').then(m => console.log('OK'))"`
Expected: 输出 "OK"

**Step 5: 提交基础服务**

```bash
git add server/src/services/vectorIndexService.js server/tests/unit/vectorIndexService.test.js
git commit -m "feat: create VectorIndexService skeleton with ChromaDB client"
```

---

### Task 2: 实现向量索引重建功能

**Files:**
- Modify: `server/src/services/vectorIndexService.js`

**Step 1: 添加重建索引方法**

在 VectorIndexService 类中添加以下方法：

```javascript
/**
 * 重建向量索引
 * @param {string} userId - 用户ID
 * @param {Function} progressCallback - 进度回调 {current, total, message}
 * @returns {Promise<Object>} 构建结果
 */
async rebuildIndex(userId, progressCallback) {
  await this.initialize();

  const startTime = Date.now();
  const collection = await this.getCollection(userId);

  try {
    logger.info(`[VectorIndexService] 开始重建索引 - User: ${userId}`);

    // 1. 删除旧索引
    await collection.delete({ where: {} });
    logger.info('[VectorIndexService] 旧索引已清空');

    // 2. 加载所有记忆文件
    const { loadUserMemories } = await import('./fileStorage.js');
    const fileStorage = (await import('./fileStorage.js')).default;
    const fileStorageInstance = new fileStorage();

    const memories = await fileStorageInstance.loadUserMemories(userId);
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

    // 3. 批量处理记忆（每批50个）
    const batchSize = 50;
    const processedMemories = [];

    for (let i = 0; i < allMemories.length; i += batchSize) {
      const batch = allMemories.slice(i, i + batchSize);

      for (const memory of batch) {
        // 构建文档文本
        const text = this.buildMemoryText(memory);

        // 生成embedding
        const embedding = await this.embeddings.embedQuery(text);

        // 构建metadata
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
        processedMemories.length = 0; // 清空批量缓冲区
      }
    }

    const duration = Date.now() - startTime;

    // 4. 统计信息
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

/**
 * 构建记忆文本
 */
buildMemoryText(memory) {
  const parts = [];

  if (memory.question) {
    parts.push(`问题: ${memory.question}`);
  }

  if (memory.answer) {
    parts.push(`回答: ${memory.answer}`);
  }

  return parts.join('\n');
}

/**
 * 构建元数据
 */
buildMetadata(memory) {
  const metadata = {
    userId: memory.targetUserId,
    memoryId: memory.memoryId,
    questionId: memory.questionId,
    questionRole: memory.questionRole, // 'elder' | 'family' | 'friend'
    questionLayer: memory.questionLayer, // 'basic' | 'emotional'
    questionOrder: memory.questionOrder,
    source: 'questionnaire',
    createdAt: memory.createdAt
  };

  // 类别映射
  if (memory.questionRole === 'elder') {
    metadata.category = 'self';
  } else if (memory.questionRole === 'family') {
    metadata.category = 'family';
    metadata.helperId = memory.helperId;
    metadata.helperNickname = memory.helperNickname;
  } else if (memory.questionRole === 'friend') {
    metadata.category = 'friend';
    metadata.helperId = memory.helperId;
    metadata.helperNickname = memory.helperNickname;
  }

  // 可选字段
  if (memory.importance !== undefined) {
    metadata.importance = memory.importance;
  }

  if (memory.tags && Array.isArray(memory.tags)) {
    metadata.tags = memory.tags.join(',');
  }

  return metadata;
}

/**
 * 批量插入ChromaDB
 */
async batchInsert(collection, documents) {
  try {
    await collection.add({
      ids: documents.map(d => d.id),
      embeddings: documents.map(d => d.embedding),
      documents: documents.map(d => d.document),
      metadatas: documents.map(d => d.metadata)
    });
  } catch (error) {
    logger.error('[VectorIndexService] 批量插入失败:', error);
    throw error;
  }
}

/**
 * 获取索引统计信息
 */
async getStats(userId) {
  const collection = await this.getCollection(userId);
  const result = await collection.count();

  return {
    totalDocuments: result,
    collectionName: `user_${userId}`
  };
}
```

**Step 2: 添加检查索引是否存在的方法**

```javascript
/**
 * 检查索引是否存在
 * @param {string} userId - 用户ID
 * @returns {Promise<boolean>}
 */
async indexExists(userId) {
  try {
    const collection = await this.getCollection(userId);
    const count = await collection.count();
    return count > 0;
  } catch (error) {
    logger.warn(`[VectorIndexService] 检查索引失败: ${userId}`, error.message);
    return false;
  }
}
```

**Step 3: 添加单元测试**

```javascript
describe('VectorIndexService.rebuildIndex', () => {
  it('should throw error if no memories exist', async () => {
    // Mock fileStorage to return empty memories
    // 验证抛出错误
  });

  it('should process memories in batches', async () => {
    // Mock fileStorage and embeddings
    // 验证批量插入被调用
  });
});
```

**Step 4: 运行测试**

Run: `npm run test:unit vectorIndexService.test.js`
Expected: 相关测试通过

**Step 5: 提交**

```bash
git add server/src/services/vectorIndexService.js server/tests/unit/vectorIndexService.test.js
git commit -m "feat: implement rebuildIndex with batch processing and progress callback"
```

---

### Task 3: 实现向量搜索功能

**Files:**
- Modify: `server/src/services/vectorIndexService.js`

**Step 1: 添加搜索方法**

```javascript
/**
 * 向量搜索
 * @param {string} userId - 用户ID
 * @param {string} query - 查询文本
 * @param {number} topK - 返回结果数量
 * @param {string} relationType - 关系类型（family/friend/self）
 * @param {string} relationSpecificId - 具体关系ID（helperId）
 * @returns {Promise<Array>} 搜索结果
 */
async search(userId, query, topK = 5, relationType = null, relationSpecificId = null) {
  await this.initialize();

  try {
    const collection = await this.getCollection(userId);

    // 生成查询embedding
    const queryEmbedding = await this.embeddings.embedQuery(query);

    // 构建where条件
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
          relevanceScore: 1 - (results.distances?.[0]?.[i] || 0), // 距离转相关性
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

**Step 2: 添加测试**

```javascript
describe('VectorIndexService.search', () => {
  it('should return empty array if no index exists', async () => {
    const results = await vectorService.search('user123', 'test query');
    expect(results).toEqual([]);
  });

  it('should filter by relationType', async () => {
    // Mock collection.query
    // 验证where条件正确
  });
});
```

**Step 3: 运行测试**

Run: `npm run test:unit vectorIndexService.test.js`
Expected: 测试通过

**Step 4: 提交**

```bash
git add server/src/services/vectorIndexService.js server/tests/unit/vectorIndexService.test.js
git commit -m "feat: implement search method with relation filtering"
```

---

### Task 4: 添加控制器方法

**Files:**
- Modify: `server/src/controllers/RoleCardController.js`

**Step 1: 导入VectorIndexService**

在文件顶部添加导入：

```javascript
import VectorIndexService from '../services/vectorIndexService.js';
```

**Step 2: 添加构建向量索引的控制器方法**

在 RoleCardController 类中添加：

```javascript
/**
 * 构建向量索引（SSE进度反馈）
 */
async buildVectorIndex(req, res) {
  const userId = req.user.id;

  logger.info(`[RoleCardController] 开始构建向量索引 - User: ${userId}`);

  // 设置SSE响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const progressCallback = (data) => {
    try {
      res.write(`event: progress\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      logger.error('[RoleCardController] SSE写入失败:', error);
    }
  };

  try {
    // 检查用户是否有A套问题的记忆
    const { loadUserMemories } = await import('../services/fileStorage.js');
    const FileStorage = (await import('../services/fileStorage.js')).default;
    const fileStorage = new FileStorage();

    const memories = await fileStorage.loadUserMemories(userId);

    if (memories.A_set.length === 0) {
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ success: false, error: '请先完成至少一个A套问题' })}\n\n`);
      res.end();
      return;
    }

    // 构建索引
    const vectorService = new VectorIndexService();
    const result = await vectorService.rebuildIndex(userId, progressCallback);

    logger.info(`[RoleCardController] 向量索引构建成功 - User: ${userId}`);

    res.write(`event: done\n`);
    res.write(`data: ${JSON.stringify({ success: true, ...result })}\n\n`);
  } catch (error) {
    logger.error('[RoleCardController] 构建向量索引失败:', error);

    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({ success: false, error: error.message })}\n\n`);
  } finally {
    res.end();
  }
}

/**
 * 获取向量索引状态
 */
async getVectorIndexStatus(req, res) {
  const userId = req.user.id;

  try {
    const vectorService = new VectorIndexService();
    const exists = await vectorService.indexExists(userId);

    const stats = exists ? await vectorService.getStats(userId) : null;

    // 获取记忆文件统计
    const FileStorage = (await import('../services/fileStorage.js')).default;
    const fileStorage = new FileStorage();
    const memories = await fileStorage.loadUserMemories(userId);

    const memoryCount = memories.A_set.length + memories.Bste.length + memories.Cste.length;
    const canBuild = memories.A_set.length > 0;

    res.json({
      success: true,
      status: {
        exists,
        memoryCount,
        canBuild,
        ...stats
      }
    });
  } catch (error) {
    logger.error('[RoleCardController] 获取索引状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
```

**Step 3: 添加测试**

```javascript
describe('RoleCardController.buildVectorIndex', () => {
  it('should return error if no A_set memories', async () => {
    // Mock fileStorage.loadUserMemories to return empty A_set
    // 调用buildVectorIndex
    // 验证返回错误事件
  });
});
```

**Step 4: 运行测试**

Run: `npm run test unit/vectorIndexService.test.js`
Expected: 测试通过

**Step 5: 提交**

```bash
git add server/src/controllers/RoleCardController.js server/tests/unit/vectorIndexService.test.js
git commit -m "feat: add buildVectorIndex and getVectorIndexStatus controller methods"
```

---

### Task 5: 添加路由

**Files:**
- Modify: `server/src/routes/rolecard.js`

**Step 1: 添加新路由**

在文件中添加：

```javascript
router.post('/vector-index/build', protect, (req, res) => {
  rolecardController.buildVectorIndex(req, res);
});

router.get('/vector-index/status', protect, (req, res) => {
  rolecardController.getVectorIndexStatus(req, res);
});
```

**Step 2: 验证路由**

运行：`node -e "import('./server/src/routes/rolecard.js').then(m => console.log('OK'))"`
Expected: 输出 "OK"

**Step 3: 提交**

```bash
git add server/src/routes/rolecard.js
git commit -m "feat: add vector-index build and status routes"
```

---

### Task 6: 更新ragRetrieverNode使用向量索引

**Files:**
- Modify: `server/src/services/chat/nodes/ragRetriever.js`

**Step 1: 修改retrieveMemories函数**

替换整个 `retrieveMemories` 函数：

```javascript
async function retrieveMemories(query, category) {
  try {
    const VectorIndexService = (await import('../../services/vectorIndexService.js')).default;
    const vectorService = new VectorIndexService();

    // 检查索引是否存在
    const exists = await vectorService.indexExists(state.userId);
    if (!exists) {
      logger.warn(`[RAGRetriever] 用户 ${state.userId} 的向量索引不存在`);
      return [];
    }

    // 执行向量搜索
    const relationType = category; // 'family' | 'friend' | 'self'
    const relationSpecificId = state.interlocutor.specificId;

    const memories = await vectorService.search(
      state.userId,
      query,
      5, // topK
      relationType,
      relationSpecificId
    );

    return memories;
  } catch (error) {
    logger.error('[RAGRetriever] 向量搜索失败:', error);
    return [];
  }
}
```

**注意**：需要将 `state.userId` 传递给 `retrieveMemories`，修改函数调用：

```javascript
const retrievedMemories = await retrieveMemories(currentInput, category, state.userId, interlocutor.specificId);
```

**Step 2: 更新函数签名**

修改 `retrieveMemories` 函数签名：

```javascript
async function retrieveMemories(query, category, userId, relationSpecificId = null) {
  try {
    const VectorIndexService = (await import('../../services/vectorIndexService.js')).default;
    const vectorService = new VectorIndexService();

    // 检查索引是否存在
    const exists = await vectorService.indexExists(userId);
    if (!exists) {
      logger.warn(`[RAGRetriever] 用户 ${userId} 的向量索引不存在`);
      return [];
    }

    // 执行向量搜索
    const memories = await vectorService.search(
      userId,
      query,
      5,
      category,
      relationSpecificId
    );

    return memories;
  } catch (error) {
    logger.error('[RAGRetriever] 向量搜索失败:', error);
    return [];
  }
}
```

**Step 3: 更新调用点**

在 `ragRetrieverNode` 函数中：

```javascript
const category = relationType;
retrievedMemories = await retrieveMemories(currentInput, category, state.userId, interlocutor.specificId);
```

**Step 4: 提交**

```bash
git add server/src/services/chat/nodes/ragRetriever.js
git commit -m "feat: update ragRetrieverNode to use VectorIndexService"
```

---

### Task 7: 创建前端API方法

**Files:**
- Modify: `web/lib/api.ts`

**Step 1: 添加构建向量索引的方法**

在文件末尾添加：

```typescript
export async function buildVectorIndex(onProgress: (data: any) => void) {
  const token = getToken();
  if (!token) {
    throw new Error('未登录');
  }

  const response = await fetch(`${API_URL}/rolecard/vector-index/build`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error('无法读取响应流');
  }

  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        const eventType = line.substring(7).trim();
        continue;
      }
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.substring(6).trim());
        onProgress(data);
      }
    }
  }
}
```

**Step 2: 添加获取索引状态的方法**

```typescript
export async function getVectorIndexStatus() {
  return apiRequest<{
    success: boolean;
    status: {
      exists: boolean;
      memoryCount: number;
      canBuild: boolean;
      totalDocuments?: number;
      collectionName?: string;
    }
  }>('/rolecard/vector-index/status');
}
```

**Step 3: 提交**

```bash
git add web/lib/api.ts
git commit -m "feat: add buildVectorIndex and getVectorIndexStatus API methods"
```

---

### Task 8: 创建BuildVectorIndexButton组件

**Files:**
- Create: `web/app/rolecard/components/BuildVectorIndexButton.tsx`

**Step 1: 创建组件文件**

```typescript
'use client'

import { Button } from '@/components/ui/button'
import { Database, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface BuildVectorIndexButtonProps {
  isBuilding: boolean
  isDisabled: boolean
  progress?: {
    current: number
    total: number
    message: string
  }
  status?: {
    exists: boolean
    memoryCount: number
    canBuild: boolean
  }
  onClick: () => void
}

export default function BuildVectorIndexButton({
  isBuilding,
  isDisabled,
  progress,
  status,
  onClick
}: BuildVectorIndexButtonProps) {
  // 确定按钮状态
  const canBuild = status?.canBuild && !status?.exists;
  const isReady = status?.exists;

  return (
    <Button
      onClick={onClick}
      disabled={isDisabled || isBuilding || !canBuild}
      size="lg"
      className={`gap-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300 ${isReady ? 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700' : ''}`}
    >
      {isBuilding ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>
            {progress ? `${progress.message} (${progress.current}/${progress.total})` : '构建中...'}
          </span>
        </>
      ) : isReady ? (
        <>
          <CheckCircle className="h-5 w-5" />
          <span>记忆库已构建</span>
        </>
      ) : (
        <>
          <Database className="h-5 w-5" />
          <span>
            {status?.memoryCount === 0 ? '暂无记忆' : '构建记忆库'}
          </span>
        </>
      )}
    </Button>
  )
}
```

**Step 2: 验证组件**

运行：`npm run build`（如果适用）
Expected: 没有TypeScript错误

**Step 3: 提交**

```bash
git add web/app/rolecard/components/BuildVectorIndexButton.tsx
git commit -m "feat: create BuildVectorIndexButton component with progress tracking"
```

---

### Task 9: 集成到角色卡页面

**Files:**
- Modify: `web/app/rolecard/page.tsx`

**Step 1: 导入新组件**

在导入部分添加：

```typescript
import BuildVectorIndexButton from './components/BuildVectorIndexButton'
```

**Step 2: 添加状态**

在状态声明部分添加：

```typescript
const [buildingIndex, setBuildingIndex] = useState(false)
const [buildProgress, setBuildProgress] = useState<{ current: number; total: number; message: string } | undefined>(undefined)
const [vectorIndexStatus, setVectorIndexStatus] = useState<{
  exists: boolean
  memoryCount: number
  canBuild: boolean
} | undefined>(undefined)
```

**Step 3: 添加获取索引状态的方法**

在 fetchData 方法后添加：

```typescript
const fetchVectorIndexStatus = async () => {
  try {
    const res = await api.get('/rolecard/vector-index/status')
    if (res.success && res.data?.status) {
      setVectorIndexStatus(res.data.status)
    }
  } catch (error) {
    console.error('获取向量索引状态失败:', error)
  }
}
```

**Step 4: 修改fetchData调用索引状态**

在 fetchData 方法的 finally 之前添加：

```typescript
// 获取向量索引状态
await fetchVectorIndexStatus()
```

**Step 5: 添加构建索引的处理方法**

在 handleGenerateRoleCard 方法后添加：

```typescript
const handleBuildVectorIndex = async () => {
  if (!user?._id) return

  try {
    setBuildingIndex(true)
    setBuildProgress({ current: 0, total: 1, message: '正在初始化...' })

    await buildVectorIndex((data) => {
      if (data.message) {
        setBuildProgress({
          current: data.current || 0,
          total: data.total || 1,
          message: data.message
        })
      }
    })

    // 构建完成，重新获取状态
    setTimeout(() => {
      setBuildProgress(undefined)
      fetchVectorIndexStatus()
    }, 2000)
  } catch (error) {
    console.error('构建向量索引失败:', error)
    alert(error.message || '构建失败，请重试')
    setBuildProgress(undefined)
  } finally {
    setBuildingIndex(false)
  }
}
```

**Step 6: 在页面中添加新按钮**

在角色卡状态卡片的按钮区域（第287行附近）添加：

```typescript
<div className="flex gap-4">
  <GenerateButton
    isGenerating={generating}
    isDisabled={!isFullyAnswered()}
    progress={generateProgress}
    onClick={handleGenerateRoleCard}
  />
  <BuildVectorIndexButton
    isBuilding={buildingIndex}
    isDisabled={buildingIndex}
    progress={buildProgress}
    status={vectorIndexStatus}
    onClick={handleBuildVectorIndex}
  />
  {roleCard && (
    <Button
      variant="outline"
      onClick={() => setEditMode(!editMode)}
      className="flex-1"
    >
      {editMode ? '完成编辑' : '编辑角色卡'}
    </Button>
  )}
</div>
```

**Step 7: 提交**

```bash
git add web/app/rolecard/page.tsx
git commit -m "feat: integrate BuildVectorIndexButton into rolecard page"
```

---

### Task 10: 添加API类型定义

**Files:**
- Modify: `web/types/index.ts`（或创建新的类型文件）

**Step 1: 添加向量索引相关的类型**

```typescript
export interface VectorIndexStatus {
  exists: boolean
  memoryCount: number
  canBuild: boolean
  totalDocuments?: number
  collectionName?: string
}

export interface VectorIndexBuildProgress {
  current: number
  total: number
  message: string
}

export interface VectorIndexBuildResult {
  success: boolean
  userId: string
  memoryCount: number
  categories: {
    self: number
    family: number
    friend: number
  }
  duration: number
}
```

**Step 2: 提交**

```bash
git add web/types/index.ts
git commit -m "feat: add VectorIndex related TypeScript types"
```

---

### Task 11: 更新导入

**Files:**
- Modify: `web/app/rolecard/page.tsx`

**Step 1: 添加类型导入**

```typescript
import type { VectorIndexStatus, VectorIndexBuildProgress } from '@/types'
```

**Step 2: 更新状态类型**

```typescript
const [buildProgress, setBuildProgress] = useState<VectorIndexBuildProgress | undefined>(undefined)
const [vectorIndexStatus, setVectorIndexStatus] = useState<VectorIndexStatus | undefined>(undefined)
```

**Step 3: 提交**

```bash
git add web/app/rolecard/page.tsx
git commit -m "refactor: update type definitions for vector index features"
```

---

### Task 12: 测试完整流程

**Files:**
- Test: 手动测试或集成测试

**Step 1: 启动服务**

```bash
# 后端
cd server && npm run dev

# 前端（另一个终端）
cd web && npm run dev
```

**Step 2: 测试场景**

1. 用户没有记忆文件
   - 访问角色卡页面
   - 验证"构建记忆库"按钮禁用
   - 验证显示"暂无记忆"

2. 用户只有A套记忆
   - 完成一个A套问题
   - 验证"构建记忆库"按钮可点击
   - 点击按钮
   - 验证SSE进度显示
   - 验证构建成功
   - 验证按钮变为"记忆库已构建"（绿色）

3. 测试RAG检索
   - 创建对话会话（家人/朋友）
   - 发送消息
   - 验证日志显示向量搜索
   - 验证返回相关记忆

**Step 3: 验证向后兼容**

1. 角色卡生成功能不受影响
2. 编辑角色卡功能不受影响
3. 其他API路由正常工作

**Step 4: 提交**

```bash
git commit --allow-empty -m "test: complete end-to-end testing of vector index feature"
```

---

### Task 13: 文档更新

**Files:**
- Create: `docs/vector-index-implementation.md`

**Step 1: 创建文档**

```markdown
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
```

**Step 2: 提交文档**

```bash
git add docs/vector-index-implementation.md
git commit -m "docs: add RAG vector index implementation documentation"
```

---

## 总结

### 新增文件
- `server/src/services/vectorIndexService.js`
- `server/tests/unit/vectorIndexService.test.js`
- `web/app/rolecard/components/BuildVectorIndexButton.tsx`
- `docs/vector-index-implementation.md`

### 修改文件
- `server/src/controllers/RoleCardController.js`
- `server/src/routes/rolecard.js`
- `server/src/services/chat/nodes/ragRetriever.js`
- `web/lib/api.ts`
- `web/app/rolecard/page.tsx`
- `web/types/index.ts`

### 关键特性
✅ 每个用户独立的ChromaDB collection
✅ SSE实时进度反馈
✅ 批量处理（每批50个）
✅ 基于关系的过滤
✅ 完整的元数据支持
✅ 向后兼容，不影响现有功能
