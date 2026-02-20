# Personality-Driven Memory System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a personality-driven memory management system that stores conversation memories with personality filtering, three-stage progressive compression, and seamless RAG integration.

**Architecture:** The system uses file-based storage for conversation memories, with personality-driven LLM extraction and compression. Memories are indexed in real-time for RAG retrieval. When users return after 30+ minutes, a new session is created but RAG retrieves the previous conversation seamlessly.

**Tech Stack:** Node.js, MongoDB, Ollama (deepseek-r1:14b LLM + bge-m3 Embedding), ChromaDB, File-based storage, LangGraph-style orchestration

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Memory System Architecture                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Conversation Ends                                              │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────────────────────────────────────┐           │
│  │ LLM Memory Extraction (Personality-Filtered)    │           │
│  │ • Summary, key topics, facts                    │           │
│  │ • Pending topics detection                      │           │
│  │ • Retention scoring based on personality        │           │
│  └─────────────────────────────────────────────────┘           │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────────────────────────────────────┐           │
│  │ Bidirectional Storage                           │           │
│  │ A's memory → A's folder (A's personality)       │           │
│  │ B's memory → B's folder (B's personality)       │           │
│  └─────────────────────────────────────────────────┘           │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────────────────────────────────────┐           │
│  │ Real-time Vector Indexing                       │           │
│  │ • Generate embeddings                           │           │
│  │ • Add to user's vector index                    │           │
│  │ • Show "busy" status until complete             │           │
│  └─────────────────────────────────────────────────┘           │
│       │                                                         │
│       ▼ (3 days later)                                          │
│  ┌─────────────────────────────────────────────────┐           │
│  │ Compression v1 (Initial)                        │           │
│  │ • Remove redundancy                             │           │
│  │ • Personality-based filtering                   │           │
│  │ • Re-index                                      │           │
│  └─────────────────────────────────────────────────┘           │
│       │                                                         │
│       ▼ (7 days later)                                          │
│  ┌─────────────────────────────────────────────────┐           │
│  │ Compression v2 (Core)                           │           │
│  │ • Extract core memories                         │           │
│  │ • Personality-driven forgetting                 │           │
│  │ • Re-index                                      │           │
│  └─────────────────────────────────────────────────┘           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Storage Structure

```
server/storage/userdata/{userId}/
├── A_set/                          # Self questionnaire
├── Bste/                           # Family helper questionnaire
├── Cste/                           # Friend helper questionnaire
├── conversations/                  # NEW: Conversation memories
│   ├── with_{userId_B}/
│   │   └── {timestamp}_{topic}.json
│   └── with_{userId_C}/
│       └── {timestamp}_{topic}.json
├── pending_topics.json             # NEW: Unfinished topics
└── core-layer.json                 # Role card core layer
```

## Conversation End Triggers

| Trigger | Action |
|---------|--------|
| Token 60% | Role card hints at ending |
| Token 70% | Force terminate |
| User says "结束对话" | LLM detects intent → Save |
| 30 min no response | Auto-save conversation |
| User closes page 30+ min | Auto-save conversation |

## 30-Minute Return Behavior

When user returns after 30+ minutes:
1. **Frontend**: Chat history visible (local display)
2. **Backend**: New session (no context)
3. **RAG**: Retrieves previous conversation automatically
4. **User experience**: Seamless continuation - role card "remembers"

## Indexing Status

During memory indexing:
- User sends message → System shows "用户繁忙中..."
- Index complete → Role card auto-responds

---

## Phase 0: ChromaDB Integration (Prerequisite)

> **重要**: 现有 `VectorIndexService` 使用自定义内存索引，需要重构为 ChromaDB 客户端。
> ChromaDB 容器、依赖、环境变量均已配置，但代码未使用。

### Task 0.1: Create ChromaDB Client Service

**Files:**
- Create: `server/src/core/storage/chroma.js`

**Step 1: Create ChromaDB client**

```javascript
/**
 * ChromaDB Client Service
 * Wrapper for ChromaDB operations
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { ChromaClient } from 'chromadb';
import logger from '../utils/logger.js';

class ChromaDBService {
  constructor() {
    this.client = null;
    this.url = process.env.CHROMA_URL || 'http://localhost:8001';
  }

  /**
   * Initialize ChromaDB client
   */
  async initialize() {
    if (this.client) return;

    try {
      this.client = new ChromaClient({
        path: this.url
      });

      // Test connection
      await this.client.heartbeat();
      logger.info(`[ChromaDBService] Connected to ChromaDB at ${this.url}`);
    } catch (error) {
      logger.error('[ChromaDBService] Failed to connect:', error);
      throw error;
    }
  }

  /**
   * Get or create collection
   * @param {string} name - Collection name
   * @param {Object} metadata - Collection metadata
   * @returns {Promise<Object>} Collection
   */
  async getCollection(name, metadata = {}) {
    await this.initialize();

    try {
      // Try to get existing collection
      const collection = await this.client.getCollection({ name });
      return collection;
    } catch (error) {
      // Collection doesn't exist, create it
      logger.info(`[ChromaDBService] Creating collection: ${name}`);
      const collection = await this.client.createCollection({
        name,
        metadata: {
          description: `Memory collection for ${name}`,
          ...metadata
        }
      });
      return collection;
    }
  }

  /**
   * Delete collection
   * @param {string} name - Collection name
   */
  async deleteCollection(name) {
    await this.initialize();

    try {
      await this.client.deleteCollection({ name });
      logger.info(`[ChromaDBService] Deleted collection: ${name}`);
    } catch (error) {
      logger.warn(`[ChromaDBService] Failed to delete collection ${name}:`, error.message);
    }
  }

  /**
   * List all collections
   * @returns {Promise<Array>} Collection names
   */
  async listCollections() {
    await this.initialize();
    const collections = await this.client.listCollections();
    return collections.map(c => c.name);
  }

  /**
   * Health check
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      await this.initialize();
      await this.client.heartbeat();
      return true;
    } catch (error) {
      return false;
    }
  }
}

export default ChromaDBService;
```

**Step 2: Commit**

```bash
git add server/src/core/storage/chroma.js
git commit -m "feat(storage): create ChromaDB client service"
```

---

### Task 0.2: Refactor VectorIndexService to use ChromaDB

**Files:**
- Modify: `server/src/core/storage/vector.js`

**Step 1: Replace memory-based storage with ChromaDB**

Replace the entire `VectorIndexService` class:

```javascript
/**
 * Vector Index Service
 * Manages vector index using ChromaDB
 *
 * @author AFS Team
 * @version 2.0.0
 */

import ChromaDBService from './chroma.js';
import EmbeddingService from './embedding.js';
import logger from '../utils/logger.js';

class VectorIndexService {
  constructor() {
    this.chromaService = new ChromaDBService();
    this.embeddingService = null;
  }

  /**
   * Initialize services
   */
  async initialize() {
    if (this.embeddingService) return;

    try {
      logger.info('[VectorIndexService] Initializing...');

      this.embeddingService = new EmbeddingService();
      await this.embeddingService.initialize();

      await this.chromaService.initialize();

      logger.info('[VectorIndexService] Initialization complete');
    } catch (error) {
      logger.error('[VectorIndexService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get collection name for user
   * @param {string} userId - User ID
   * @returns {string} Collection name
   */
  getCollectionName(userId) {
    // ChromaDB collection names must be valid
    return `user_${userId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  }

  /**
   * Build text for indexing
   * @param {Object} memory - Memory object
   * @returns {string} Text for embedding
   */
  buildMemoryText(memory) {
    // Conversation memory format
    if (memory.content) {
      const parts = [];

      if (memory.content.compressed) {
        parts.push(memory.content.compressed);
      } else if (memory.content.core) {
        parts.push(memory.content.core);
      } else if (memory.content.processed?.summary) {
        parts.push(`摘要：${memory.content.processed.summary}`);
        if (memory.content.processed.keyTopics) {
          parts.push(`话题：${memory.content.processed.keyTopics.join('、')}`);
        }
        if (memory.content.processed.facts) {
          parts.push(`事实：${memory.content.processed.facts.join('；')}`);
        }
      } else if (memory.content.raw) {
        parts.push(memory.content.raw);
      }

      return parts.join('\n');
    }

    // Questionnaire memory format
    const parts = [];
    if (memory.question) parts.push(`问题: ${memory.question}`);
    if (memory.answer) parts.push(`回答: ${memory.answer}`);
    return parts.join('\n');
  }

  /**
   * Build metadata for indexing
   * @param {Object} memory - Memory object
   * @returns {Object} Metadata
   */
  buildMetadata(memory) {
    // Conversation memory
    if (memory.participants || memory.meta?.participants) {
      const meta = memory.meta || {};
      return {
        userId: memory.userId || meta.participants?.[0],
        memoryId: memory.memoryId,
        source: 'conversation',
        participants: JSON.stringify(meta.participants || memory.participants),
        compressionStage: meta.compressionStage || 'raw',
        createdAt: memory.createdAt || meta.createdAt,
        category: this.inferCategory(memory),
        tags: JSON.stringify(memory.tags || [])
      };
    }

    // Questionnaire memory
    const metadata = {
      userId: memory.targetUserId,
      memoryId: memory.memoryId,
      questionId: memory.questionId,
      questionRole: memory.questionRole,
      questionLayer: memory.questionLayer,
      questionOrder: memory.questionOrder,
      source: 'questionnaire',
      createdAt: memory.createdAt
    };

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

    return metadata;
  }

  inferCategory(memory) {
    if (memory.category) return memory.category;
    return 'conversation';
  }

  /**
   * Rebuild index for user
   * @param {string} userId - User ID
   * @param {Function} progressCallback - Progress callback
   */
  async rebuildIndex(userId, progressCallback) {
    await this.initialize();

    const startTime = Date.now();
    const collectionName = this.getCollectionName(userId);

    try {
      logger.info(`[VectorIndexService] Rebuilding index for ${userId}`);

      // Delete existing collection
      await this.chromaService.deleteCollection(collectionName);

      // Load memories from FileStorage
      const FileStorage = (await import('./file.js')).default;
      const fileStorage = new FileStorage();
      const memories = await fileStorage.loadUserMemories(userId);

      // Also load conversation memories from MemoryStore
      const MemoryStore = (await import('../../modules/memory/MemoryStore.js')).default;
      const memoryStore = new MemoryStore();
      const conversationMemories = await memoryStore.loadUserMemories(userId);

      // Combine all memories
      const allMemories = [
        ...memories.A_set.map(m => ({ ...m, category: 'self' })),
        ...memories.Bste.map(m => ({ ...m, category: 'family' })),
        ...memories.Cste.map(m => ({ ...m, category: 'friend' })),
        ...Object.values(conversationMemories).flat()
      ];

      if (allMemories.length === 0) {
        throw new Error('用户没有任何记忆文件');
      }

      const total = allMemories.length;
      logger.info(`[VectorIndexService] Loading ${total} memories`);

      // Get or create collection
      const collection = await this.chromaService.getCollection(collectionName);

      // Batch process
      const batchSize = 50;
      let currentProcessed = 0;

      for (let i = 0; i < allMemories.length; i += batchSize) {
        const batch = allMemories.slice(i, i + batchSize);

        const ids = [];
        const documents = [];
        const metadatas = [];
        const texts = [];

        for (const memory of batch) {
          const text = this.buildMemoryText(memory);
          texts.push(text);
          ids.push(memory.memoryId);
          documents.push(text);
          metadatas.push(this.buildMetadata(memory));
          currentProcessed++;
        }

        // Generate embeddings for batch
        const embeddings = await this.embeddingService.embedDocuments(texts);

        // Add to collection
        await collection.add({
          ids,
          embeddings,
          documents,
          metadatas
        });

        logger.info(`[VectorIndexService] Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(total / batchSize)} complete`);

        if (progressCallback) {
          progressCallback({
            current: Math.min(currentProcessed, total),
            total,
            message: `正在处理记忆 ${Math.min(currentProcessed, total)}/${total}...`
          });
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`[VectorIndexService] Index rebuild complete: ${total} documents, ${duration}ms`);

      return {
        success: true,
        userId,
        memoryCount: total,
        duration
      };
    } catch (error) {
      logger.error('[VectorIndexService] Index rebuild failed:', error);
      throw error;
    }
  }

  /**
   * Search memories
   * @param {string} userId - User ID
   * @param {string} query - Query text
   * @param {number} topK - Number of results
   * @param {string} relationType - Filter by category
   * @param {string} relationSpecificId - Filter by helper ID
   */
  async search(userId, query, topK = 5, relationType = null, relationSpecificId = null) {
    await this.initialize();

    try {
      const collectionName = this.getCollectionName(userId);
      const collection = await this.chromaService.getCollection(collectionName);

      // Generate query embedding
      const queryEmbedding = await this.embeddingService.embedQuery(query);

      // Build where filter
      let where = null;
      if (relationType) {
        where = { category: relationType };
      }

      // Search
      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK,
        where
      });

      // Format results
      const memories = [];
      if (results.ids && results.ids[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          // Filter by helperId if specified (post-filter)
          if (relationSpecificId && results.metadatas[0][i].helperId !== relationSpecificId) {
            continue;
          }

          memories.push({
            content: results.documents[0][i],
            relevanceScore: 1 - (results.distances?.[0]?.[i] || 0),
            category: results.metadatas[0][i].category,
            metadata: results.metadatas[0][i]
          });
        }
      }

      logger.info(`[VectorIndexService] Search complete: ${memories.length} results`);
      return memories;
    } catch (error) {
      logger.error('[VectorIndexService] Search failed:', error);
      return [];
    }
  }

  /**
   * Check if index exists
   * @param {string} userId - User ID
   */
  async indexExists(userId) {
    try {
      await this.initialize();
      const collectionName = this.getCollectionName(userId);
      const collection = await this.chromaService.getCollection(collectionName);
      const count = await collection.count();
      return count > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get index stats
   * @param {string} userId - User ID
   */
  async getStats(userId) {
    try {
      await this.initialize();
      const collectionName = this.getCollectionName(userId);
      const collection = await this.chromaService.getCollection(collectionName);
      const count = await collection.count();

      return {
        totalDocuments: count,
        collectionName
      };
    } catch (error) {
      return {
        totalDocuments: 0,
        collectionName: this.getCollectionName(userId)
      };
    }
  }

  /**
   * Add single memory to index
   * @param {string} userId - User ID
   * @param {Object} memory - Memory object
   */
  async addMemory(userId, memory) {
    await this.initialize();

    const collectionName = this.getCollectionName(userId);
    const collection = await this.chromaService.getCollection(collectionName);

    const text = this.buildMemoryText(memory);
    const embedding = await this.embeddingService.embedQuery(text);
    const metadata = this.buildMetadata(memory);

    await collection.add({
      ids: [memory.memoryId],
      embeddings: [embedding],
      documents: [text],
      metadatas: [metadata]
    });

    logger.info(`[VectorIndexService] Added memory ${memory.memoryId}`);
  }

  /**
   * Delete memory from index
   * @param {string} userId - User ID
   * @param {string} memoryId - Memory ID
   */
  async deleteMemory(userId, memoryId) {
    await this.initialize();

    const collectionName = this.getCollectionName(userId);
    const collection = await this.chromaService.getCollection(collectionName);

    await collection.delete({ ids: [memoryId] });
    logger.info(`[VectorIndexService] Deleted memory ${memoryId}`);
  }

  /**
   * Update memory in index
   * @param {string} userId - User ID
   * @param {Object} memory - Updated memory
   */
  async updateMemory(userId, memory) {
    // ChromaDB doesn't have update, so delete and re-add
    await this.deleteMemory(userId, memory.memoryId);
    await this.addMemory(userId, memory);
    logger.info(`[VectorIndexService] Updated memory ${memory.memoryId}`);
  }
}

export default VectorIndexService;
```

**Step 2: Commit**

```bash
git add server/src/core/storage/vector.js
git commit -m "refactor(storage): migrate VectorIndexService to ChromaDB"
```

---

### Task 0.3: Update Environment Variables

**Files:**
- Verify: `server/.env`

**Step 1: Ensure CHROMA_URL is set**

```env
# ChromaDB Configuration
CHROMA_URL=http://chromaserver:8000
```

Already configured in docker-compose.yml environment.

---

### Task 0.4: Update Tests for ChromaDB

**Files:**
- Modify: `server/tests/unit/vectorIndexService.test.js`

**Step 1: Update tests for ChromaDB**

```javascript
/**
 * VectorIndexService Tests (ChromaDB)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import VectorIndexService from '../../../src/core/storage/vector.js';

describe('VectorIndexService (ChromaDB)', () => {
  let service;

  beforeAll(async () => {
    service = new VectorIndexService();
    await service.initialize();
  });

  describe('initialize', () => {
    it('should connect to ChromaDB', async () => {
      const health = await service.chromaService.healthCheck();
      expect(health).toBe(true);
    });
  });

  describe('search', () => {
    it('should return empty array for non-existent collection', async () => {
      const results = await service.search('nonexistent_user', 'test query');
      expect(results).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return stats for collection', async () => {
      const stats = await service.getStats('test_user');
      expect(stats).toHaveProperty('totalDocuments');
      expect(stats).toHaveProperty('collectionName');
    });
  });
});
```

**Step 2: Commit**

```bash
git add server/tests/unit/vectorIndexService.test.js
git commit -m "test(storage): update tests for ChromaDB"
```

---

## Phase 0 Complete

Phase 0 migrates from custom memory index to ChromaDB:

- ✅ ChromaDB client service
- ✅ Refactored VectorIndexService
- ✅ Environment variables verified
- ✅ Tests updated

---

## Phase 1: Memory Storage Foundation

### Task 1.1: Create MemoryStore Module

**Files:**
- Create: `server/src/modules/memory/index.js`
- Create: `server/src/modules/memory/MemoryStore.js`

**Step 1: Write the module structure**

Create `server/src/modules/memory/index.js`:

```javascript
/**
 * Memory Management Module
 * Handles conversation memory storage, extraction, and compression
 *
 * @module memory
 */

import MemoryStore from './MemoryStore.js';
import MemoryExtractor from './MemoryExtractor.js';
import Compressor from './Compressor.js';
import Scheduler from './Scheduler.js';
import PendingTopicsManager from './PendingTopicsManager.js';

export {
  MemoryStore,
  MemoryExtractor,
  Compressor,
  Scheduler,
  PendingTopicsManager
};

export default {
  MemoryStore,
  MemoryExtractor,
  Compressor,
  Scheduler,
  PendingTopicsManager
};
```

**Step 2: Write the MemoryStore class skeleton**

Create `server/src/modules/memory/MemoryStore.js`:

```javascript
/**
 * MemoryStore - Conversation Memory Storage
 * Handles saving and loading conversation memories with personality filtering
 *
 * @author AFS Team
 * @version 1.0.0
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import logger from '../../core/utils/logger.js';

class MemoryStore {
  constructor() {
    // Detect Docker environment
    const isDocker = fs.existsSync('/.dockerenv') ||
                     process.env.DOCKER_CONTAINER === 'true' ||
                     process.env.NODE_ENV === 'docker';

    this.basePath = isDocker
      ? '/app/storage/userdata'
      : path.join(process.cwd(), 'server', 'storage', 'userdata');
  }

  /**
   * Save conversation memory for a user
   * @param {string} userId - User ID (memory owner)
   * @param {string} withUserId - Conversation partner ID
   * @param {Object} memoryData - Memory data to save
   * @returns {Promise<Object>} Saved memory with ID
   */
  async saveMemory(userId, withUserId, memoryData) {
    // Implementation in next task
    throw new Error('Not implemented');
  }

  /**
   * Load all conversation memories for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Memories organized by conversation partner
   */
  async loadUserMemories(userId) {
    // Implementation in next task
    throw new Error('Not implemented');
  }

  /**
   * Get conversation folder path
   * @param {string} userId - User ID
   * @param {string} withUserId - Partner ID
   * @returns {string} Folder path
   */
  getConversationPath(userId, withUserId) {
    return path.join(this.basePath, String(userId), 'conversations', `with_${withUserId}`);
  }

  /**
   * Generate memory file name
   * @param {Object} memoryData - Memory data with topicSummary
   * @returns {string} File name
   */
  generateFileName(memoryData) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const topic = (memoryData.topicSummary || 'conversation').slice(0, 20);
    const sanitizedName = topic.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
    return `${timestamp}_${sanitizedName}.json`;
  }

  /**
   * Generate unique memory ID
   * @returns {string} UUID
   */
  generateMemoryId() {
    return `mem_${crypto.randomUUID()}`;
  }
}

export default MemoryStore;
```

**Step 3: Verify files are created**

Run: `ls -la server/src/modules/memory/`

Expected: Two files created with proper structure

**Step 4: Commit**

```bash
git add server/src/modules/memory/
git commit -m "feat(memory): create MemoryStore module skeleton"
```

---

### Task 1.2: Implement MemoryStore saveMemory

**Files:**
- Modify: `server/src/modules/memory/MemoryStore.js`

**Step 1: Implement saveMemory method**

Replace the `saveMemory` method in `MemoryStore.js`:

```javascript
  /**
   * Save conversation memory for a user
   * @param {string} userId - User ID (memory owner)
   * @param {string} withUserId - Conversation partner ID
   * @param {Object} memoryData - Memory data to save
   * @returns {Promise<Object>} Saved memory with ID
   */
  async saveMemory(userId, withUserId, memoryData) {
    try {
      const conversationPath = this.getConversationPath(userId, withUserId);
      await fsPromises.mkdir(conversationPath, { recursive: true });

      const memoryId = memoryData.memoryId || this.generateMemoryId();
      const fileName = this.generateFileName(memoryData);
      const filePath = path.join(conversationPath, fileName);

      const memory = {
        memoryId,
        version: '1.0.0',
        meta: {
          createdAt: memoryData.createdAt || new Date().toISOString(),
          participants: [userId, withUserId],
          participantRoles: memoryData.participantRoles || {},
          messageCount: memoryData.messageCount || 0,
          compressionStage: 'raw',
          compressedAt: null
        },
        content: {
          raw: memoryData.raw || '',
          processed: memoryData.processed || null
        },
        pendingTopics: memoryData.pendingTopics || { hasUnfinished: false, topics: [] },
        personalityFiltered: memoryData.personalityFiltered || null,
        vectorIndex: {
          indexed: false,
          indexedAt: null
        },
        tags: memoryData.tags || []
      };

      await fsPromises.writeFile(filePath, JSON.stringify(memory, null, 2), 'utf-8');
      logger.info(`[MemoryStore] Saved memory: ${memoryId} for user ${userId}`);

      return { memoryId, filePath, memory };
    } catch (error) {
      logger.error('[MemoryStore] Failed to save memory:', error);
      throw error;
    }
  }
```

**Step 2: Add import for path utilities**

The imports are already at the top of the file. Verify they include:
- `fs`, `fsPromises`, `path`, `crypto`, `logger`

**Step 3: Commit**

```bash
git add server/src/modules/memory/MemoryStore.js
git commit -m "feat(memory): implement saveMemory method"
```

---

### Task 1.3: Implement MemoryStore loadUserMemories

**Files:**
- Modify: `server/src/modules/memory/MemoryStore.js`

**Step 1: Implement loadUserMemories method**

Replace the `loadUserMemories` method in `MemoryStore.js`:

```javascript
  /**
   * Load all conversation memories for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Memories organized by conversation partner
   */
  async loadUserMemories(userId) {
    const memories = {};

    try {
      const conversationsPath = path.join(this.basePath, String(userId), 'conversations');

      // Check if conversations directory exists
      try {
        await fsPromises.access(conversationsPath);
      } catch {
        logger.info(`[MemoryStore] No conversations directory for user ${userId}`);
        return memories;
      }

      // Get all partner folders
      const partnerFolders = await fsPromises.readdir(conversationsPath);

      for (const partnerFolder of partnerFolders) {
        if (partnerFolder.startsWith('.') || !partnerFolder.startsWith('with_')) {
          continue;
        }

        const partnerId = partnerFolder.replace('with_', '');
        const partnerPath = path.join(conversationsPath, partnerFolder);

        memories[partnerId] = [];

        // Recursively load all memory files
        await this.loadMemoriesFromFolder(partnerPath, memories[partnerId]);
      }

      logger.info(`[MemoryStore] Loaded memories for user ${userId}: ${Object.keys(memories).length} partners`);
    } catch (error) {
      logger.error(`[MemoryStore] Failed to load memories for user ${userId}:`, error);
    }

    return memories;
  }

  /**
   * Recursively load memory files from a folder
   * @param {string} folderPath - Folder path
   * @param {Array} targetArray - Array to append memories to
   */
  async loadMemoriesFromFolder(folderPath, targetArray) {
    try {
      const entries = await fsPromises.readdir(folderPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;

        const fullPath = path.join(folderPath, entry.name);

        if (entry.isDirectory()) {
          await this.loadMemoriesFromFolder(fullPath, targetArray);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          const data = await fsPromises.readFile(fullPath, 'utf-8');
          const memory = JSON.parse(data);
          memory._filePath = fullPath; // Track file path for updates
          targetArray.push(memory);
        }
      }
    } catch (error) {
      logger.warn(`[MemoryStore] Failed to load from folder ${folderPath}:`, error.message);
    }
  }
```

**Step 2: Commit**

```bash
git add server/src/modules/memory/MemoryStore.js
git commit -m "feat(memory): implement loadUserMemories method"
```

---

### Task 1.4: Implement Bidirectional Storage

**Files:**
- Modify: `server/src/modules/memory/MemoryStore.js`

**Step 1: Add saveBidirectional method**

Add this method to `MemoryStore.js`:

```javascript
  /**
   * Save conversation memory for both participants
   * Each participant gets their own personality-filtered version
   *
   * @param {Object} options - Save options
   * @param {string} options.userAId - First user ID
   * @param {string} options.userBId - Second user ID
   * @param {Object} options.conversationData - Raw conversation data
   * @param {Object} options.userAMemory - User A's personality-filtered memory
   * @param {Object} options.userBMemory - User B's personality-filtered memory (or null if no role card)
   * @returns {Promise<Object>} Results for both users
   */
  async saveBidirectional(options) {
    const { userAId, userBId, conversationData, userAMemory, userBMemory } = options;

    const results = {
      userA: null,
      userB: null
    };

    try {
      // Save for User A
      results.userA = await this.saveMemory(userAId, userBId, {
        ...conversationData,
        ...userAMemory,
        participantRoles: {
          [userAId]: 'roleCard',
          [userBId]: conversationData.userBRole || 'interlocutor'
        }
      });

      logger.info(`[MemoryStore] Saved bidirectional memory for ${userAId}`);

      // Save for User B
      if (userBMemory) {
        // User B has role card - save personality-filtered version
        results.userB = await this.saveMemory(userBId, userAId, {
          ...conversationData,
          ...userBMemory,
          participantRoles: {
            [userBId]: 'roleCard',
            [userAId]: conversationData.userARole || 'interlocutor'
          }
        });
      } else {
        // User B has no role card - save simplified version
        results.userB = await this.saveMemory(userBId, userAId, {
          raw: conversationData.raw,
          processed: null, // Will be processed when role card is created
          participantRoles: {
            [userBId]: 'pending_rolecard',
            [userAId]: conversationData.userARole || 'interlocutor'
          },
          messageCount: conversationData.messageCount,
          tags: ['pending_processing']
        });
      }

      logger.info(`[MemoryStore] Saved bidirectional memory for ${userBId}`);

      return results;
    } catch (error) {
      logger.error('[MemoryStore] Failed to save bidirectional memory:', error);
      throw error;
    }
  }
```

**Step 2: Commit**

```bash
git add server/src/modules/memory/MemoryStore.js
git commit -m "feat(memory): implement bidirectional storage"
```

---

### Task 1.5: Implement Memory Update Methods

**Files:**
- Modify: `server/src/modules/memory/MemoryStore.js`

**Step 1: Add update methods**

Add these methods to `MemoryStore.js`:

```javascript
  /**
   * Update existing memory file
   * @param {string} filePath - Path to memory file
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated memory
   */
  async updateMemory(filePath, updates) {
    try {
      const data = await fsPromises.readFile(filePath, 'utf-8');
      const memory = JSON.parse(data);

      const updatedMemory = {
        ...memory,
        ...updates,
        meta: {
          ...memory.meta,
          ...(updates.meta || {})
        },
        content: {
          ...memory.content,
          ...(updates.content || {})
        }
      };

      await fsPromises.writeFile(filePath, JSON.stringify(updatedMemory, null, 2), 'utf-8');
      logger.info(`[MemoryStore] Updated memory: ${memory.memoryId}`);

      return updatedMemory;
    } catch (error) {
      logger.error('[MemoryStore] Failed to update memory:', error);
      throw error;
    }
  }

  /**
   * Mark memory as indexed
   * @param {string} filePath - Path to memory file
   * @returns {Promise<Object>} Updated memory
   */
  async markAsIndexed(filePath) {
    return this.updateMemory(filePath, {
      vectorIndex: {
        indexed: true,
        indexedAt: new Date().toISOString()
      }
    });
  }

  /**
   * Update compression stage
   * @param {string} filePath - Path to memory file
   * @param {string} stage - New compression stage (raw, v1, v2)
   * @returns {Promise<Object>} Updated memory
   */
  async updateCompressionStage(filePath, stage) {
    return this.updateMemory(filePath, {
      meta: {
        compressionStage: stage,
        compressedAt: new Date().toISOString()
      }
    });
  }

  /**
   * Get memories pending compression
   * @param {string} userId - User ID
   * @param {string} stage - Stage to filter (raw for v1, v1 for v2)
   * @param {number} minDaysOld - Minimum days since creation
   * @returns {Promise<Array>} Memories pending compression
   */
  async getMemoriesPendingCompression(userId, stage, minDaysOld) {
    const allMemories = await this.loadUserMemories(userId);
    const pending = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - minDaysOld);

    for (const partnerId in allMemories) {
      for (const memory of allMemories[partnerId]) {
        if (memory.meta.compressionStage === stage) {
          const createdAt = new Date(memory.meta.createdAt);
          if (createdAt < cutoffDate) {
            pending.push(memory);
          }
        }
      }
    }

    logger.info(`[MemoryStore] Found ${pending.length} memories pending compression for user ${userId}`);
    return pending;
  }
```

**Step 2: Commit**

```bash
git add server/src/modules/memory/MemoryStore.js
git commit -m "feat(memory): add memory update and compression methods"
```

---

## Phase 1 Complete

Phase 1 establishes the foundation for memory storage. The `MemoryStore` class provides:

- ✅ Save conversation memories to user folders
- ✅ Load all memories for a user
- ✅ Bidirectional storage (both participants get their copy)
- ✅ Memory update methods
- ✅ Compression tracking

**Next: Phase 2 - LLM Memory Extraction**

---

## Phase 2: LLM Memory Extraction

### Task 2.1: Create Memory Extraction Prompt

**Files:**
- Create: `server/src/modules/memory/prompts/memoryExtraction.js`

**Step 1: Create prompts directory and file**

```javascript
/**
 * Memory Extraction Prompt
 * Personality-driven conversation memory extraction
 *
 * @module memory/prompts
 */

export const MEMORY_EXTRACTION_PROMPT = `# 角色定义
你是一位专业的记忆分析专家，擅长从对话中提取关键信息，并根据说话人的人格特点进行记忆过滤。

# 任务说明
请分析以下对话内容，从【角色卡主人】的视角提取并组织记忆信息。

## 角色卡主人的人格信息
\${roleCardPersonality}

## 对话参与者
- 角色卡主人：\${roleCardOwnerName}
- 对话对象：\${interlocutorName}（\${relationType}）

## 对话内容
\${conversationHistory}

---

# 处理步骤

## 步骤1：对话摘要
用 2-3 句话概括本次对话的核心内容，突出最重要的信息。

## 步骤2：关键话题提取
提取对话中讨论的所有主要话题（3-7个）。

## 步骤3：事实信息提取
提取对话中提到的具体事实，包括：
- 时间、地点、人物
- 具体事件
- 重要数字或名称

## 步骤4：情感走向分析
分析对话中的情感变化：
- 开始时的情绪状态
- 情绪最高点及触发事件
- 结束时的情绪状态

## 步骤5：难忘时刻识别
根据角色卡主人的人格特点，判断哪些内容会留下深刻印象。

人格与记忆倾向对照：
| 人格特点 | 记忆倾向 |
|---------|---------|
| 乐观开朗 | 容易记住开心的事，淡化不愉快 |
| 敏感细腻 | 容易记住情感细节、言外之意 |
| 务实理性 | 容易记住事实信息，忽略情绪 |
| 健忘随性 | 很多细节变模糊，但大致轮廓在 |
| 重感情 | 与亲人朋友相关的事记得清楚 |
| 记仇 | 不愉快的事反而记得更清楚 |

## 步骤6：待续话题检测
识别哪些话题没有讨论完，需要下次继续：
- 明确未完成的讨论
- 提出但未得到答案的问题
- 需要后续确认的事情

为每个待续话题生成一句角色卡可能主动提起的话（符合人格特点）。

## 步骤7：人格过滤评分
根据角色卡主人的性格特点，计算这段对话的：
- 整体保留评分（0-1）：此记忆被长期保留的概率
- 最可能记住的内容：3-5个
- 可能被淡忘的内容：2-3个
- 淡忘理由：与人格特点的关联

## 步骤8：生成话题摘要
用 10 个字以内概括本次对话主题，用于文件命名。

---

# 输出格式（严格 JSON）

\`\`\`json
{
  "summary": "本次对话的2-3句摘要",
  "topicSummary": "10字内主题",
  "keyTopics": ["话题1", "话题2", "话题3"],
  "facts": [
    "事实1：具体内容",
    "事实2：具体内容"
  ],
  "emotionalJourney": {
    "start": "对话开始时的情绪",
    "peak": "情绪最高点及触发事件",
    "end": "对话结束时的情绪"
  },
  "memorableMoments": [
    {
      "content": "难忘时刻的具体内容",
      "importance": 0.9,
      "emotionTag": "自豪/开心/担忧/感动等",
      "reason": "为什么这个时刻对角色卡主人很重要"
    }
  ],
  "pendingTopics": [
    {
      "topic": "未完成的话题",
      "context": "话题的背景和当前进展",
      "suggestedFollowUp": "角色卡可能主动说的话（符合人格）",
      "urgency": "high/medium/low"
    }
  ],
  "personalityFiltered": {
    "retentionScore": 0.85,
    "reasoning": "基于人格特点的保留评分理由",
    "likelyToRecall": ["最可能记住的内容1", "内容2"],
    "likelyToForget": ["可能被淡忘的内容1"],
    "forgetReason": "为什么这些内容会被淡忘（人格相关）"
  },
  "tags": ["家庭", "孙子", "聚餐", "自豪"],
  "messageCount": 24,
  "estimatedTokens": 1500
}
\`\`\`

# 约束条件
1. 所有文本使用中文
2. importance 评分为 0-1 之间的小数
3. retentionScore 基于人格特点客观评估，不是所有记忆都高分
4. suggestedFollowUp 必须符合角色卡主人的人格和说话风格
5. 如果没有待续话题，pendingTopics 为空数组
6. tags 限制在 5 个以内`;

export default MEMORY_EXTRACTION_PROMPT;
```

**Step 2: Commit**

```bash
git add server/src/modules/memory/prompts/
git commit -m "feat(memory): add memory extraction prompt"
```

---

### Task 2.2: Create MemoryExtractor Class

**Files:**
- Create: `server/src/modules/memory/MemoryExtractor.js`

**Step 1: Create MemoryExtractor skeleton**

```javascript
/**
 * MemoryExtractor - LLM-based Memory Extraction
 * Extracts structured memories from conversations with personality filtering
 *
 * @author AFS Team
 * @version 1.0.0
 */

import LLMClient from '../../core/llm/client.js';
import { MEMORY_EXTRACTION_PROMPT } from './prompts/memoryExtraction.js';
import logger from '../../core/utils/logger.js';

class MemoryExtractor {
  constructor() {
    this.llmClient = new LLMClient(process.env.OLLAMA_MODEL || 'deepseek-r1:14b', {
      temperature: 0.3, // Lower temperature for consistent extraction
      timeout: 60000
    });
  }

  /**
   * Extract memory from conversation
   * @param {Object} options - Extraction options
   * @param {Array} options.messages - Conversation messages
   * @param {Object} options.roleCard - Role card core layer
   * @param {Object} options.participants - Participant info
   * @returns {Promise<Object>} Extracted memory data
   */
  async extract(options) {
    // Implementation in next task
    throw new Error('Not implemented');
  }

  /**
   * Format role card personality for prompt
   * @param {Object} coreLayer - Role card core layer
   * @returns {string} Formatted personality text
   */
  formatPersonality(coreLayer) {
    if (!coreLayer) return '未提供人格信息';

    const parts = [];

    if (coreLayer.personality?.summary) {
      parts.push(`【性格特点】${coreLayer.personality.summary}`);
    }
    if (coreLayer.values?.summary) {
      parts.push(`【价值观】${coreLayer.values.summary}`);
    }
    if (coreLayer.communicationStyle?.summary) {
      parts.push(`【沟通风格】${coreLayer.communicationStyle.summary}`);
    }
    if (coreLayer.emotionalNeeds?.summary) {
      parts.push(`【情感需求】${coreLayer.emotionalNeeds.summary}`);
    }

    return parts.join('\n') || '未提供详细人格信息';
  }

  /**
   * Format conversation history for prompt
   * @param {Array} messages - Conversation messages
   * @returns {string} Formatted conversation text
   */
  formatConversation(messages) {
    return messages.map(msg => {
      const role = msg.role === 'user' ? '对话对象' : '角色卡';
      return `[${role}] ${msg.content}`;
    }).join('\n');
  }

  /**
   * Parse LLM response to JSON
   * @param {string} response - LLM response text
   * @returns {Object} Parsed memory data
   */
  parseResponse(response) {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      // Try direct JSON parse
      const cleanResponse = response.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
      return JSON.parse(cleanResponse);
    } catch (error) {
      logger.error('[MemoryExtractor] Failed to parse LLM response:', error);
      throw new Error('无法解析记忆提取结果');
    }
  }
}

export default MemoryExtractor;
```

**Step 2: Commit**

```bash
git add server/src/modules/memory/MemoryExtractor.js
git commit -m "feat(memory): create MemoryExtractor class skeleton"
```

---

### Task 2.3: Implement MemoryExtractor.extract Method

**Files:**
- Modify: `server/src/modules/memory/MemoryExtractor.js`

**Step 1: Implement extract method**

Replace the `extract` method:

```javascript
  /**
   * Extract memory from conversation
   * @param {Object} options - Extraction options
   * @param {Array} options.messages - Conversation messages
   * @param {Object} options.roleCard - Role card core layer (can be null)
   * @param {Object} options.participants - Participant info
   * @param {string} options.participants.ownerId - Role card owner ID
   * @param {string} options.participants.ownerName - Role card owner name
   * @param {string} options.participants.interlocutorId - Interlocutor ID
   * @param {string} options.participants.interlocutorName - Interlocutor name
   * @param {string} options.participants.relationType - Relation type
   * @returns {Promise<Object>} Extracted memory data
   */
  async extract(options) {
    const { messages, roleCard, participants } = options;

    try {
      logger.info('[MemoryExtractor] Starting memory extraction');

      // If no role card, return simplified memory (raw only)
      if (!roleCard) {
        logger.info('[MemoryExtractor] No role card, returning raw memory');
        return this.createRawMemory(messages, participants);
      }

      // Format inputs for prompt
      const personalityText = this.formatPersonality(roleCard.coreLayer || roleCard);
      const conversationText = this.formatConversation(messages);

      // Build prompt
      const prompt = MEMORY_EXTRACTION_PROMPT
        .replace('${roleCardPersonality}', personalityText)
        .replace('${roleCardOwnerName}', participants.ownerName || '角色卡主人')
        .replace('${interlocutorName}', participants.interlocutorName || '对话对象')
        .replace('${relationType}', participants.relationType || '未知关系')
        .replace('${conversationHistory}', conversationText);

      // Call LLM
      const response = await this.llmClient.generate(prompt, {
        temperature: 0.3,
        maxTokens: 2000
      });

      // Parse response
      const extractedData = this.parseResponse(response);

      // Add metadata
      extractedData.messageCount = messages.length;
      extractedData.extractedAt = new Date().toISOString();

      logger.info(`[MemoryExtractor] Extraction complete. Retention score: ${extractedData.personalityFiltered?.retentionScore}`);

      return extractedData;
    } catch (error) {
      logger.error('[MemoryExtractor] Extraction failed:', error);
      throw error;
    }
  }

  /**
   * Create raw memory for users without role card
   * @param {Array} messages - Conversation messages
   * @param {Object} participants - Participant info
   * @returns {Object} Raw memory data
   */
  createRawMemory(messages, participants) {
    const raw = this.formatConversation(messages);

    return {
      summary: '待处理：用户暂无角色卡，记忆将在生成角色卡后处理',
      topicSummary: '待处理',
      keyTopics: [],
      facts: [],
      emotionalJourney: null,
      memorableMoments: [],
      pendingTopics: [],
      personalityFiltered: null,
      tags: ['pending_processing'],
      messageCount: messages.length,
      raw,
      needsProcessing: true
    };
  }
```

**Step 2: Commit**

```bash
git add server/src/modules/memory/MemoryExtractor.js
git commit -m "feat(memory): implement extract method with personality filtering"
```

---

### Task 2.4: Add Batch Processing for Pending Memories

**Files:**
- Modify: `server/src/modules/memory/MemoryExtractor.js`

**Step 1: Add batch processing method**

Add this method to MemoryExtractor:

```javascript
  /**
   * Process pending memories when user creates role card
   * @param {string} userId - User ID
   * @param {Object} roleCard - Newly created role card
   * @param {Object} memoryStore - MemoryStore instance
   * @returns {Promise<Object>} Processing results
   */
  async processPendingMemories(userId, roleCard, memoryStore) {
    try {
      logger.info(`[MemoryExtractor] Processing pending memories for user ${userId}`);

      const allMemories = await memoryStore.loadUserMemories(userId);
      const results = {
        processed: 0,
        failed: 0,
        skipped: 0
      };

      for (const partnerId in allMemories) {
        for (const memory of allMemories[partnerId]) {
          // Skip already processed memories
          if (!memory.needsProcessing && memory.processed) {
            results.skipped++;
            continue;
          }

          try {
            // Determine compression stage based on age
            const daysSinceCreation = this.getDaysSinceCreation(memory.meta.createdAt);
            let compressionStage = 'raw';

            if (daysSinceCreation >= 7) {
              compressionStage = 'v2';
            } else if (daysSinceCreation >= 3) {
              compressionStage = 'v1';
            }

            // Extract memory with role card
            const extractedData = await this.extract({
              messages: this.parseRawToMessages(memory.content.raw),
              roleCard,
              participants: {
                ownerId: userId,
                interlocutorId: partnerId,
                relationType: 'unknown'
              }
            });

            // Update memory file
            const updates = {
              content: {
                raw: memory.content.raw,
                processed: {
                  summary: extractedData.summary,
                  keyTopics: extractedData.keyTopics,
                  facts: extractedData.facts,
                  emotionalJourney: extractedData.emotionalJourney,
                  memorableMoments: extractedData.memorableMoments
                }
              },
              personalityFiltered: extractedData.personalityFiltered,
              tags: extractedData.tags,
              pendingTopics: extractedData.pendingTopics,
              needsProcessing: false,
              processed: true
            };

            // Apply compression if needed
            if (compressionStage !== 'raw') {
              updates.meta = {
                compressionStage,
                compressedAt: new Date().toISOString()
              };
            }

            await memoryStore.updateMemory(memory._filePath, updates);
            results.processed++;

            logger.info(`[MemoryExtractor] Processed memory ${memory.memoryId}`);
          } catch (error) {
            logger.error(`[MemoryExtractor] Failed to process memory ${memory.memoryId}:`, error);
            results.failed++;
          }
        }
      }

      logger.info(`[MemoryExtractor] Batch processing complete:`, results);
      return results;
    } catch (error) {
      logger.error('[MemoryExtractor] Batch processing failed:', error);
      throw error;
    }
  }

  /**
   * Get days since creation
   * @param {string} createdAt - ISO date string
   * @returns {number} Days since creation
   */
  getDaysSinceCreation(createdAt) {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now - created;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Parse raw text back to messages array (approximate)
   * @param {string} raw - Raw conversation text
   * @returns {Array} Messages array
   */
  parseRawToMessages(raw) {
    const lines = raw.split('\n');
    const messages = [];

    for (const line of lines) {
      const match = line.match(/\[(对话对象|角色卡)\]\s*(.+)/);
      if (match) {
        messages.push({
          role: match[1] === '对话对象' ? 'user' : 'assistant',
          content: match[2]
        });
      }
    }

    return messages;
  }
```

**Step 2: Commit**

```bash
git add server/src/modules/memory/MemoryExtractor.js
git commit -m "feat(memory): add batch processing for pending memories"
```

---

### Task 2.5: Integrate MemoryExtractor with Role Card Generation

**Files:**
- Modify: `server/src/modules/rolecard/controller.js`

**Step 1: Add pending memory processing trigger**

Find the role card generation success handler and add:

```javascript
// In rolecard controller, after successful role card generation
import { MemoryExtractor, MemoryStore } from '../memory/index.js';

// After roleCard is successfully generated:
async function onRoleCardGenerated(userId, roleCard) {
  try {
    const memoryStore = new MemoryStore();
    const memoryExtractor = new MemoryExtractor();

    // Check for pending memories
    const allMemories = await memoryStore.loadUserMemories(userId);
    const hasPendingMemories = Object.values(allMemories)
      .flat()
      .some(m => m.needsProcessing || m.tags?.includes('pending_processing'));

    if (hasPendingMemories) {
      logger.info(`[RolecardController] Processing pending memories for user ${userId}`);

      // Process in background
      memoryExtractor.processPendingMemories(userId, roleCard, memoryStore)
        .then(results => {
          logger.info(`[RolecardController] Pending memory processing complete:`, results);
        })
        .catch(error => {
          logger.error('[RolecardController] Pending memory processing failed:', error);
        });
    }
  } catch (error) {
    logger.error('[RolecardController] Failed to check pending memories:', error);
  }
}
```

**Step 2: Commit**

```bash
git add server/src/modules/rolecard/controller.js
git commit -m "feat(rolecard): integrate pending memory processing on role card generation"
```

---

## Phase 2 Complete

Phase 2 implements LLM-based memory extraction with:

- ✅ Personality-driven memory extraction prompt
- ✅ MemoryExtractor class for conversation analysis
- ✅ Support for users without role cards (raw memory)
- ✅ Batch processing for pending memories
- ✅ Integration with role card generation

**Key Features:**
- Retention score based on personality
- Pending topic detection
- Emotional journey tracking
- Personality-based filtering

**Next: Phase 3 - Compression System**

---

## Phase 3: Compression System

### Task 3.1: Create Compression Prompts

**Files:**
- Create: `server/src/modules/memory/prompts/compressV1.js`
- Create: `server/src/modules/memory/prompts/compressV2.js`

**Step 1: Create v1 compression prompt**

Create `server/src/modules/memory/prompts/compressV1.js`:

```javascript
/**
 * Compression V1 Prompt - Initial Compression (Day 3)
 * Removes redundancy, merges content, preserves key information
 */

export const COMPRESS_V1_PROMPT = `# 角色定义
你是一位模拟人类记忆的专家，擅长根据人格特点对记忆进行初步压缩。

# 任务说明
请对以下对话记忆进行初步压缩（模拟3天后的记忆状态）。
目标是保留重要信息，去除冗余，使记忆更加精炼但仍然完整。

## 角色卡主人的人格信息
\${roleCardPersonality}

## 待压缩的记忆（3天前）
\${memoryContent}

---

# 处理步骤

## 步骤1：识别冗余内容
找出对话中的重复信息、闲聊、无关细节。

## 步骤2：合并相似内容
将表达相同意思的多句话合并为一句。

## 步骤3：保留核心信息
确保以下内容被保留：
- 重要事实（时间、地点、人物、事件）
- 情感高峰时刻
- 待续话题

## 步骤4：人格驱动的保留策略
根据角色卡主人的性格特点调整保留重点：

| 人格特点 | 保留策略 |
|---------|---------|
| 乐观开朗 | 保留开心的事，负面内容可适当淡化 |
| 敏感细腻 | 保留情感细节和言外之意 |
| 务实理性 | 保留事实，简化情感表达 |
| 健忘随性 | 保留大致轮廓，细节可以模糊 |
| 重感情 | 保留与关系人相关的所有细节 |

## 步骤5：生成压缩版本
将记忆压缩到原长度的 30-50%。

---

# 输出格式（严格 JSON）

\`\`\`json
{
  "compressedContent": "压缩后的记忆内容",
  "compressionRatio": 0.4,
  "removedContent": ["被移除的冗余内容"],
  "preservedContent": ["保留的重要信息"],
  "personalityAdjustment": {
    "appliedStrategy": "根据人格特点应用的压缩策略",
    "keptMore": ["因人格特点额外保留的内容"],
    "keptLess": ["因人格特点适当淡化的内容"]
  },
  "keyPoints": ["核心要点1", "核心要点2"],
  "emotionalHighlights": [
    {
      "moment": "情感高峰时刻",
      "intensity": "high/medium/low",
      "preserved": true
    }
  ],
  "pendingTopicsPreserved": true,
  "wordCountBefore": 500,
  "wordCountAfter": 200
}
\`\`\`

# 约束条件
1. 压缩比例控制在 30-50%
2. 不得删除待续话题相关内容
3. 情感高峰必须保留（但可简化）
4. 压缩后的内容仍需保持连贯性
5. 所有文本使用中文`;

export default COMPRESS_V1_PROMPT;
```

**Step 2: Create v2 compression prompt**

Create `server/src/modules/memory/prompts/compressV2.js`:

```javascript
/**
 * Compression V2 Prompt - Core Compression (Day 7)
 * Extracts core memories, simulates personality-driven forgetting
 */

export const COMPRESS_V2_PROMPT = `# 角色定义
你是一位模拟人类长期记忆的专家，擅长提取核心记忆并模拟"记忆模糊"过程。

# 任务说明
请对以下已压缩的记忆进行精准压缩（模拟7天后的记忆状态）。
目标是提取核心记忆点，同时模拟人类记忆的"模糊化"和"遗忘"过程。

## 角色卡主人的人格信息
\${roleCardPersonality}

## 已压缩的记忆（7天前，经过v1压缩）
\${compressedMemory}

---

# 处理步骤

## 步骤1：提取核心记忆点
从压缩记忆中提炼 3-5 个最核心的记忆点。

## 步骤2：人格驱动的遗忘
根据角色卡主人的性格特点，决定哪些内容被遗忘：

| 人格特点 | 遗忘倾向 |
|---------|---------|
| 乐观开朗 | 容易遗忘不愉快的事，或将其"美化" |
| 敏感细腻 | 难以遗忘情感相关的事 |
| 务实理性 | 容易遗忘情绪表达，保留事实 |
| 健忘随性 | 很多细节自然模糊，但印象在 |
| 记仇 | 不愉快的事反而记得更清楚 |

## 步骤3：生成记忆痕迹
对于被"遗忘"的内容，生成"模糊的记忆痕迹"。
这些痕迹可以被未来对话唤起，但不会主动想起。

记忆痕迹的清晰度分级：
- clear（清晰）：能主动回忆起的细节
- fuzzy（模糊）：需要提示才能想起
- vague（隐约）：只剩下大致印象

## 步骤4：生成核心摘要
用 100-200 字概括整个对话的核心内容。

---

# 输出格式（严格 JSON）

\`\`\`json
{
  "coreMemory": "核心记忆摘要（100-200字）",
  "coreMemoryPoints": ["核心记忆点1", "核心记忆点2"],
  "memoryTraces": [
    {
      "original": "原始详细内容",
      "trace": "模糊后的记忆痕迹",
      "clarity": "clear/fuzzy/vague",
      "triggerHint": "什么话题可能唤起这段记忆"
    }
  ],
  "forgotten": [
    {
      "content": "被遗忘的内容",
      "reason": "遗忘原因（人格相关）",
      "recoverable": true
    }
  ],
  "personalityEffect": {
    "forgettingPattern": "遗忘模式描述",
    "retentionPattern": "保留模式描述"
  },
  "emotionalResidue": {
    "overallTone": "愉快/平淡/复杂",
    "lingeringEmotion": "残留的情感",
    "emotionalIntensity": "strong/medium/weak"
  },
  "pendingTopicsStatus": [
    {
      "topic": "待续话题",
      "status": "remembered/forgotten/fuzzy",
      "followUpSuggestion": "建议的后续"
    }
  ],
  "wordCount": 150
}
\`\`\`

# 约束条件
1. 核心摘要严格控制在 100-200 字
2. 必须体现人格特点对记忆的影响
3. 被遗忘的内容要标注是否可恢复
4. 待续话题的处理要符合人格特点
5. 所有文本使用中文`;

export default COMPRESS_V2_PROMPT;
```

**Step 3: Commit**

```bash
git add server/src/modules/memory/prompts/
git commit -m "feat(memory): add v1 and v2 compression prompts"
```

---

### Task 3.2: Create Compressor Class

**Files:**
- Create: `server/src/modules/memory/Compressor.js`

**Step 1: Create Compressor skeleton**

```javascript
/**
 * Compressor - Three-Stage Memory Compression
 * Handles progressive compression with personality-driven filtering
 *
 * @author AFS Team
 * @version 1.0.0
 */

import LLMClient from '../../core/llm/client.js';
import { COMPRESS_V1_PROMPT } from './prompts/compressV1.js';
import { COMPRESS_V2_PROMPT } from './prompts/compressV2.js';
import logger from '../../core/utils/logger.js';

class Compressor {
  constructor() {
    this.llmClient = new LLMClient(process.env.OLLAMA_MODEL || 'deepseek-r1:14b', {
      temperature: 0.3,
      timeout: 60000
    });
  }

  /**
   * Compress memory to specified stage
   * @param {Object} memory - Memory object to compress
   * @param {string} targetStage - Target stage (v1 or v2)
   * @param {Object} roleCard - Role card for personality filtering
   * @returns {Promise<Object>} Compressed memory data
   */
  async compress(memory, targetStage, roleCard) {
    if (targetStage === 'v1') {
      return this.compressV1(memory, roleCard);
    } else if (targetStage === 'v2') {
      return this.compressV2(memory, roleCard);
    }
    throw new Error(`Unknown compression stage: ${targetStage}`);
  }

  /**
   * Determine which compression stage to apply based on memory age
   * @param {Object} memory - Memory object
   * @returns {string|null} Stage to apply (v1, v2, or null)
   */
  determineCompressionStage(memory) {
    const daysSinceCreation = this.getDaysSinceCreation(memory.meta.createdAt);
    const currentStage = memory.meta.compressionStage;

    if (currentStage === 'raw' && daysSinceCreation >= 3) {
      return 'v1';
    }
    if (currentStage === 'v1' && daysSinceCreation >= 7) {
      return 'v2';
    }
    return null;
  }

  /**
   * Get days since memory creation
   * @param {string} createdAt - ISO date string
   * @returns {number} Days since creation
   */
  getDaysSinceCreation(createdAt) {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now - created;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Format memory content for compression prompt
   * @param {Object} memory - Memory object
   * @returns {string} Formatted content
   */
  formatMemoryForPrompt(memory) {
    const parts = [];

    if (memory.content.processed?.summary) {
      parts.push(`【摘要】${memory.content.processed.summary}`);
    }

    if (memory.content.processed?.keyTopics) {
      parts.push(`【话题】${memory.content.processed.keyTopics.join('、')}`);
    }

    if (memory.content.processed?.facts) {
      parts.push(`【事实】${memory.content.processed.facts.join('；')}`);
    }

    if (memory.content.compressed) {
      parts.push(`【压缩内容】${memory.content.compressed}`);
    }

    if (memory.content.raw) {
      parts.push(`【原始对话】\n${memory.content.raw}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Parse compression response
   * @param {string} response - LLM response
   * @returns {Object} Parsed data
   */
  parseResponse(response) {
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      const cleanResponse = response.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
      return JSON.parse(cleanResponse);
    } catch (error) {
      logger.error('[Compressor] Failed to parse response:', error);
      throw new Error('无法解析压缩结果');
    }
  }
}

export default Compressor;
```

**Step 2: Commit**

```bash
git add server/src/modules/memory/Compressor.js
git commit -m "feat(memory): create Compressor class skeleton"
```

---

### Task 3.3: Implement Compressor Methods

**Files:**
- Modify: `server/src/modules/memory/Compressor.js`

**Step 1: Implement compressV1 method**

Add this method to Compressor class:

```javascript
  /**
   * Stage 1 compression (Day 3)
   * @param {Object} memory - Memory to compress
   * @param {Object} roleCard - Role card for personality
   * @returns {Promise<Object>} Compressed data
   */
  async compressV1(memory, roleCard) {
    try {
      logger.info(`[Compressor] Starting v1 compression for memory ${memory.memoryId}`);

      const personalityText = this.formatPersonality(roleCard);
      const memoryContent = this.formatMemoryForPrompt(memory);

      const prompt = COMPRESS_V1_PROMPT
        .replace('${roleCardPersonality}', personalityText)
        .replace('${memoryContent}', memoryContent);

      const response = await this.llmClient.generate(prompt, {
        temperature: 0.3,
        maxTokens: 1500
      });

      const compressedData = this.parseResponse(response);

      logger.info(`[Compressor] v1 compression complete. Ratio: ${compressedData.compressionRatio}`);

      return {
        compressedContent: compressedData.compressedContent,
        keyPoints: compressedData.keyPoints,
        emotionalHighlights: compressedData.emotionalHighlights,
        personalityAdjustment: compressedData.personalityAdjustment,
        compressionRatio: compressedData.compressionRatio,
        wordCount: compressedData.wordCountAfter
      };
    } catch (error) {
      logger.error('[Compressor] v1 compression failed:', error);
      throw error;
    }
  }

  /**
   * Format personality from role card
   * @param {Object} roleCard - Role card object
   * @returns {string} Formatted personality text
   */
  formatPersonality(roleCard) {
    if (!roleCard) return '未提供人格信息';

    const coreLayer = roleCard.coreLayer || roleCard;
    const parts = [];

    if (coreLayer.personality?.summary) {
      parts.push(`【性格】${coreLayer.personality.summary}`);
    }
    if (coreLayer.values?.summary) {
      parts.push(`【价值观】${coreLayer.values.summary}`);
    }
    if (coreLayer.emotionalNeeds?.summary) {
      parts.push(`【情感需求】${coreLayer.emotionalNeeds.summary}`);
    }

    return parts.join('\n') || '未提供详细人格信息';
  }
```

**Step 2: Implement compressV2 method**

Add this method to Compressor class:

```javascript
  /**
   * Stage 2 compression (Day 7)
   * @param {Object} memory - Memory already compressed to v1
   * @param {Object} roleCard - Role card for personality
   * @returns {Promise<Object>} Compressed data
   */
  async compressV2(memory, roleCard) {
    try {
      logger.info(`[Compressor] Starting v2 compression for memory ${memory.memoryId}`);

      const personalityText = this.formatPersonality(roleCard);
      const memoryContent = this.formatMemoryForPrompt(memory);

      const prompt = COMPRESS_V2_PROMPT
        .replace('${roleCardPersonality}', personalityText)
        .replace('${compressedMemory}', memoryContent);

      const response = await this.llmClient.generate(prompt, {
        temperature: 0.3,
        maxTokens: 1000
      });

      const compressedData = this.parseResponse(response);

      logger.info(`[Compressor] v2 compression complete. Core memory: ${compressedData.coreMemoryPoints?.length} points`);

      return {
        coreMemory: compressedData.coreMemory,
        coreMemoryPoints: compressedData.coreMemoryPoints,
        memoryTraces: compressedData.memoryTraces,
        forgotten: compressedData.forgotten,
        personalityEffect: compressedData.personalityEffect,
        emotionalResidue: compressedData.emotionalResidue,
        pendingTopicsStatus: compressedData.pendingTopicsStatus,
        wordCount: compressedData.wordCount
      };
    } catch (error) {
      logger.error('[Compressor] v2 compression failed:', error);
      throw error;
    }
  }
```

**Step 3: Commit**

```bash
git add server/src/modules/memory/Compressor.js
git commit -m "feat(memory): implement compressV1 and compressV2 methods"
```

---

### Task 3.4: Create Scheduler for Timed Compression

**Files:**
- Create: `server/src/modules/memory/Scheduler.js`

**Step 1: Create Scheduler class**

```javascript
/**
 * Scheduler - Memory Compression Scheduler
 * Runs daily to check and compress memories based on age
 *
 * @author AFS Team
 * @version 1.0.0
 */

import MemoryStore from './MemoryStore.js';
import Compressor from './Compressor.js';
import VectorIndexService from '../../core/storage/vector.js';
import DualStorage from '../../core/storage/dual.js';
import logger from '../../core/utils/logger.js';

class Scheduler {
  constructor() {
    this.memoryStore = new MemoryStore();
    this.compressor = new Compressor();
    this.vectorService = new VectorIndexService();
    this.dualStorage = new DualStorage();

    this.isRunning = false;
    this.lastRunTime = null;
  }

  /**
   * Start the scheduler
   * Runs daily at 3:00 AM
   */
  start() {
    logger.info('[Scheduler] Starting memory compression scheduler');

    // Calculate time until next 3:00 AM
    const now = new Date();
    const next3AM = new Date(now);
    next3AM.setHours(3, 0, 0, 0);

    if (now >= next3AM) {
      next3AM.setDate(next3AM.getDate() + 1);
    }

    const msUntil3AM = next3AM - now;

    // Schedule first run
    setTimeout(() => {
      this.runDailyTask();
      // Then run every 24 hours
      setInterval(() => this.runDailyTask(), 24 * 60 * 60 * 1000);
    }, msUntil3AM);

    logger.info(`[Scheduler] First run scheduled at ${next3AM.toISOString()}`);
  }

  /**
   * Run daily compression task
   */
  async runDailyTask() {
    if (this.isRunning) {
      logger.warn('[Scheduler] Task already running, skipping');
      return;
    }

    this.isRunning = true;
    this.lastRunTime = new Date();

    try {
      logger.info('[Scheduler] Starting daily compression task');

      const stats = {
        usersProcessed: 0,
        memoriesCompressed: 0,
        v1Compressions: 0,
        v2Compressions: 0,
        errors: 0
      };

      // Get all users with memories
      const userIds = await this.getAllUsersWithMemories();

      for (const userId of userIds) {
        try {
          const userStats = await this.processUserMemories(userId);
          stats.usersProcessed++;
          stats.memoriesCompressed += userStats.compressed;
          stats.v1Compressions += userStats.v1;
          stats.v2Compressions += userStats.v2;
        } catch (error) {
          logger.error(`[Scheduler] Failed to process user ${userId}:`, error);
          stats.errors++;
        }
      }

      logger.info('[Scheduler] Daily task complete:', stats);
      return stats;
    } catch (error) {
      logger.error('[Scheduler] Daily task failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get all user IDs that have conversation memories
   * @returns {Promise<string[]>} User IDs
   */
  async getAllUsersWithMemories() {
    // This would typically query the database or scan the filesystem
    // For now, return from MongoDB
    const User = (await import('../user/model.js')).default;
    const users = await User.find({ 'companionChat.roleCard': { $exists: true } });
    return users.map(u => u._id.toString());
  }

  /**
   * Process memories for a single user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Processing stats
   */
  async processUserMemories(userId) {
    const stats = { compressed: 0, v1: 0, v2: 0 };

    // Get user's role card
    const roleCard = await this.dualStorage.loadRoleCardV2(userId);
    if (!roleCard) {
      logger.info(`[Scheduler] User ${userId} has no role card, skipping`);
      return stats;
    }

    // Get memories pending compression
    const pendingV1 = await this.memoryStore.getMemoriesPendingCompression(userId, 'raw', 3);
    const pendingV2 = await this.memoryStore.getMemoriesPendingCompression(userId, 'v1', 7);

    // Process v1 compressions
    for (const memory of pendingV1) {
      try {
        const compressedData = await this.compressor.compress(memory, 'v1', roleCard);

        await this.memoryStore.updateMemory(memory._filePath, {
          content: {
            ...memory.content,
            compressed: compressedData.compressedContent
          },
          meta: {
            compressionStage: 'v1',
            compressedAt: new Date().toISOString()
          },
          keyPoints: compressedData.keyPoints
        });

        // Re-index after compression
        await this.reindexMemory(userId, memory);

        stats.compressed++;
        stats.v1++;
        logger.info(`[Scheduler] Compressed memory ${memory.memoryId} to v1`);
      } catch (error) {
        logger.error(`[Scheduler] Failed to compress memory ${memory.memoryId}:`, error);
      }
    }

    // Process v2 compressions
    for (const memory of pendingV2) {
      try {
        const compressedData = await this.compressor.compress(memory, 'v2', roleCard);

        await this.memoryStore.updateMemory(memory._filePath, {
          content: {
            ...memory.content,
            core: compressedData.coreMemory
          },
          meta: {
            compressionStage: 'v2',
            compressedAt: new Date().toISOString()
          },
          memoryTraces: compressedData.memoryTraces,
          forgotten: compressedData.forgotten
        });

        // Re-index after compression
        await this.reindexMemory(userId, memory);

        stats.compressed++;
        stats.v2++;
        logger.info(`[Scheduler] Compressed memory ${memory.memoryId} to v2`);
      } catch (error) {
        logger.error(`[Scheduler] Failed to compress memory ${memory.memoryId}:`, error);
      }
    }

    return stats;
  }

  /**
   * Re-index a memory after compression
   * @param {string} userId - User ID
   * @param {Object} memory - Memory object
   */
  async reindexMemory(userId, memory) {
    try {
      await this.vectorService.initialize();

      // Get the text to index (compressed or core content)
      const textToIndex = memory.content.compressed ||
                          memory.content.core ||
                          memory.content.raw;

      if (!textToIndex) {
        logger.warn(`[Scheduler] No content to re-index for memory ${memory.memoryId}`);
        return;
      }

      // Generate new embedding
      const embedding = await this.vectorService.embeddingService.embedQuery(textToIndex);

      // Update in vector store
      const collection = await this.vectorService.getCollection(userId);

      // Delete old entry
      await collection.delete({ where: { memoryId: memory.memoryId } });

      // Add new entry with updated content
      await collection.add({
        ids: [memory.memoryId],
        embeddings: [embedding],
        documents: [textToIndex],
        metadatas: [{
          ...memory.meta,
          source: 'conversation',
          compressionStage: memory.meta.compressionStage
        }]
      });

      await this.memoryStore.markAsIndexed(memory._filePath);

      logger.info(`[Scheduler] Re-indexed memory ${memory.memoryId}`);
    } catch (error) {
      logger.error(`[Scheduler] Failed to re-index memory ${memory.memoryId}:`, error);
    }
  }

  /**
   * Manually trigger compression for testing
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Compression stats
   */
  async triggerNow(userId) {
    logger.info(`[Scheduler] Manual trigger for user ${userId}`);
    return this.processUserMemories(userId);
  }

  /**
   * Get scheduler status
   * @returns {Object} Status info
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime,
      nextRunTime: this.getNextRunTime()
    };
  }

  /**
   * Get next scheduled run time
   * @returns {Date} Next run time
   */
  getNextRunTime() {
    const now = new Date();
    const next3AM = new Date(now);
    next3AM.setHours(3, 0, 0, 0);
    if (now >= next3AM) {
      next3AM.setDate(next3AM.getDate() + 1);
    }
    return next3AM;
  }
}

export default Scheduler;
```

**Step 2: Commit**

```bash
git add server/src/modules/memory/Scheduler.js
git commit -m "feat(memory): create Scheduler for timed compression"
```

---

### Task 3.5: Integrate Scheduler with Server Startup

**Files:**
- Modify: `server/src/server.js`

**Step 1: Add scheduler initialization**

In server.js, add:

```javascript
import { Scheduler } from './modules/memory/index.js';

// After server starts, initialize scheduler
const scheduler = new Scheduler();
scheduler.start();

logger.info('[Server] Memory compression scheduler started');
```

**Step 2: Commit**

```bash
git add server/src/server.js
git commit -m "feat(server): integrate memory compression scheduler"
```

---

## Phase 3 Complete

Phase 3 implements the three-stage compression system:

- ✅ V1 compression prompt (Day 3, 30-50% reduction)
- ✅ V2 compression prompt (Day 7, core extraction)
- ✅ Compressor class with personality-driven filtering
- ✅ Scheduler for daily compression tasks
- ✅ Memory re-indexing after compression

**Key Features:**
- Personality-driven retention/forgetting
- Memory traces (clear → fuzzy → vague)
- Automatic daily execution at 3:00 AM
- Re-indexing after compression

**Next: Phase 4 - Vector Index Integration**

---

## Phase 4: Vector Index Integration

### Task 4.1: Refactor VectorIndexService

**Files:**
- Modify: `server/src/core/storage/vector.js`

**Step 1: Add conversation memory support to buildMemoryText**

Add this method to VectorIndexService:

```javascript
  /**
   * Build text for indexing from memory object
   * Supports both questionnaire and conversation memories
   * @param {Object} memory - Memory object
   * @returns {string} Text for embedding
   */
  buildMemoryText(memory) {
    // Conversation memory format
    if (memory.content) {
      const parts = [];

      // Use compressed content if available
      if (memory.content.compressed) {
        parts.push(memory.content.compressed);
      } else if (memory.content.core) {
        parts.push(memory.content.core);
      } else if (memory.content.processed?.summary) {
        parts.push(`摘要：${memory.content.processed.summary}`);

        if (memory.content.processed.keyTopics) {
          parts.push(`话题：${memory.content.processed.keyTopics.join('、')}`);
        }
        if (memory.content.processed.facts) {
          parts.push(`事实：${memory.content.processed.facts.join('；')}`);
        }
      } else if (memory.content.raw) {
        // Raw conversation (no processing yet)
        parts.push(memory.content.raw);
      }

      return parts.join('\n');
    }

    // Questionnaire memory format (existing)
    const parts = [];
    if (memory.question) {
      parts.push(`问题: ${memory.question}`);
    }
    if (memory.answer) {
      parts.push(`回答: ${memory.answer}`);
    }
    return parts.join('\n');
  }
```

**Step 2: Add conversation memory support to buildMetadata**

Update buildMetadata method:

```javascript
  /**
   * Build metadata for memory indexing
   * @param {Object} memory - Memory object
   * @returns {Object} Metadata object
   */
  buildMetadata(memory) {
    // Conversation memory format
    if (memory.participants || memory.meta?.participants) {
      const meta = memory.meta || {};
      return {
        userId: memory.userId || meta.participants?.[0],
        memoryId: memory.memoryId,
        source: 'conversation',
        participants: meta.participants || memory.participants,
        participantRoles: memory.participantRoles || meta.participantRoles,
        compressionStage: meta.compressionStage || 'raw',
        createdAt: memory.createdAt || meta.createdAt,
        category: this.inferCategory(memory),
        helperId: this.extractHelperId(memory),
        tags: memory.tags || []
      };
    }

    // Questionnaire memory format (existing)
    const metadata = {
      userId: memory.targetUserId,
      memoryId: memory.memoryId,
      questionId: memory.questionId,
      questionRole: memory.questionRole,
      questionLayer: memory.questionLayer,
      questionOrder: memory.questionOrder,
      source: 'questionnaire',
      createdAt: memory.createdAt
    };

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

    if (memory.importance !== undefined) {
      metadata.importance = memory.importance;
    }

    if (memory.tags && Array.isArray(memory.tags)) {
      metadata.tags = memory.tags.join(',');
    }

    return metadata;
  }

  /**
   * Infer category from memory structure
   * @param {Object} memory - Memory object
   * @returns {string} Category
   */
  inferCategory(memory) {
    if (memory.category) return memory.category;
    if (memory.meta?.participantRoles) {
      const roles = memory.meta.participantRoles;
      for (const userId in roles) {
        if (roles[userId] === 'family') return 'family';
        if (roles[userId] === 'friend') return 'friend';
      }
    }
    return 'conversation';
  }

  /**
   * Extract helper ID from memory
   * @param {Object} memory - Memory object
   * @returns {string|null} Helper ID
   */
  extractHelperId(memory) {
    if (memory.helperId) return memory.helperId;
    if (memory.meta?.participants) {
      // Return the non-owner participant
      return memory.meta.participants.find(p => p !== memory.userId);
    }
    return null;
  }
```

**Step 3: Commit**

```bash
git add server/src/core/storage/vector.js
git commit -m "feat(vector): add conversation memory support"
```

---

### Task 4.2: Create Real-Time Indexer

**Files:**
- Create: `server/src/modules/memory/Indexer.js`

**Step 1: Create Indexer class**

```javascript
/**
 * Indexer - Real-Time Memory Indexing
 * Handles indexing of new conversation memories
 *
 * @author AFS Team
 * @version 1.0.0
 */

import VectorIndexService from '../../core/storage/vector.js';
import logger from '../../core/utils/logger.js';

class Indexer {
  constructor() {
    this.vectorService = new VectorIndexService();
    this.indexingQueue = new Map(); // userId -> { status, memories }
  }

  /**
   * Index a single memory
   * @param {string} userId - User ID
   * @param {Object} memory - Memory to index
   * @returns {Promise<Object>} Indexing result
   */
  async indexMemory(userId, memory) {
    try {
      await this.vectorService.initialize();

      const text = this.vectorService.buildMemoryText(memory);
      const metadata = this.vectorService.buildMetadata(memory);
      const embedding = await this.vectorService.embeddingService.embedQuery(text);

      const collection = await this.vectorService.getCollection(userId);
      await collection.add({
        ids: [memory.memoryId],
        embeddings: [embedding],
        documents: [text],
        metadatas: [metadata]
      });

      logger.info(`[Indexer] Indexed memory ${memory.memoryId} for user ${userId}`);

      return {
        success: true,
        memoryId: memory.memoryId,
        indexed: true,
        indexedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`[Indexer] Failed to index memory ${memory.memoryId}:`, error);
      throw error;
    }
  }

  /**
   * Index multiple memories (batch)
   * @param {string} userId - User ID
   * @param {Array} memories - Memories to index
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<Object>} Indexing result
   */
  async indexBatch(userId, memories, progressCallback) {
    const results = {
      total: memories.length,
      indexed: 0,
      failed: 0,
      errors: []
    };

    try {
      await this.vectorService.initialize();
      const collection = await this.vectorService.getCollection(userId);

      const batchSize = 10;
      for (let i = 0; i < memories.length; i += batchSize) {
        const batch = memories.slice(i, i + batchSize);

        const ids = [];
        const embeddings = [];
        const documents = [];
        const metadatas = [];

        for (const memory of batch) {
          try {
            const text = this.vectorService.buildMemoryText(memory);
            const embedding = await this.vectorService.embeddingService.embedQuery(text);
            const metadata = this.vectorService.buildMetadata(memory);

            ids.push(memory.memoryId);
            embeddings.push(embedding);
            documents.push(text);
            metadatas.push(metadata);

            results.indexed++;
          } catch (error) {
            results.failed++;
            results.errors.push({
              memoryId: memory.memoryId,
              error: error.message
            });
          }
        }

        if (ids.length > 0) {
          await collection.add({
            ids,
            embeddings,
            documents,
            metadatas
          });
        }

        if (progressCallback) {
          progressCallback({
            current: Math.min(i + batchSize, memories.length),
            total: memories.length,
            message: `正在索引 ${Math.min(i + batchSize, memories.length)}/${memories.length}...`
          });
        }
      }

      logger.info(`[Indexer] Batch indexing complete for user ${userId}: ${results.indexed}/${results.total}`);
      return results;
    } catch (error) {
      logger.error('[Indexer] Batch indexing failed:', error);
      throw error;
    }
  }

  /**
   * Get indexing status for a user
   * @param {string} userId - User ID
   * @returns {Object} Status info
   */
  getIndexingStatus(userId) {
    const status = this.indexingQueue.get(userId);
    return status || { status: 'idle' };
  }

  /**
   * Check if indexing is in progress
   * @param {string} userId - User ID
   * @returns {boolean}
   */
  isIndexing(userId) {
    const status = this.indexingQueue.get(userId);
    return status && status.status === 'indexing';
  }

  /**
   * Set indexing status
   * @param {string} userId - User ID
   * @param {string} status - Status
   * @param {Object} data - Additional data
   */
  setIndexingStatus(userId, status, data = {}) {
    this.indexingQueue.set(userId, {
      status,
      startedAt: data.startedAt || new Date().toISOString(),
      ...data
    });
  }

  /**
   * Clear indexing status
   * @param {string} userId - User ID
   */
  clearIndexingStatus(userId) {
    this.indexingQueue.delete(userId);
  }

  /**
   * Index conversation memories for a user
   * Called after conversation is saved
   * @param {string} userId - User ID
   * @param {Object} memory - Memory object
   * @returns {Promise<Object>} Result
   */
  async indexConversationMemory(userId, memory) {
    // Check if already indexing
    if (this.isIndexing(userId)) {
      logger.info(`[Indexer] Already indexing for user ${userId}, queuing memory ${memory.memoryId}`);
      const status = this.indexingQueue.get(userId);
      status.pendingMemories = status.pendingMemories || [];
      status.pendingMemories.push(memory);
      return { queued: true };
    }

    try {
      this.setIndexingStatus(userId, 'indexing', {
        memoryId: memory.memoryId
      });

      const result = await this.indexMemory(userId, memory);

      this.setIndexingStatus(userId, 'complete', {
        memoryId: memory.memoryId,
        completedAt: new Date().toISOString()
      });

      // Process any pending memories
      const status = this.indexingQueue.get(userId);
      if (status.pendingMemories?.length > 0) {
        const pending = status.pendingMemories.shift();
        // Process next in background
        setImmediate(() => this.indexConversationMemory(userId, pending));
      } else {
        // Clear status after a delay
        setTimeout(() => this.clearIndexingStatus(userId), 5000);
      }

      return result;
    } catch (error) {
      this.setIndexingStatus(userId, 'error', {
        memoryId: memory.memoryId,
        error: error.message
      });
      throw error;
    }
  }
}

export default Indexer;
```

**Step 2: Commit**

```bash
git add server/src/modules/memory/Indexer.js
git commit -m "feat(memory): create real-time Indexer for conversation memories"
```

---

### Task 4.3: Add Index Status API

**Files:**
- Modify: `server/src/modules/memory/controller.js` (create if needed)

**Step 1: Create memory controller**

```javascript
/**
 * Memory Controller
 * API endpoints for memory management
 */

import MemoryStore from './MemoryStore.js';
import Indexer from './Indexer.js';
import MemoryExtractor from './MemoryExtractor.js';
import logger from '../../core/utils/logger.js';

const memoryStore = new MemoryStore();
const indexer = new Indexer();
const memoryExtractor = new MemoryExtractor();

/**
 * Get indexing status
 * GET /api/memory/index/status
 */
export async function getIndexStatus(req, res) {
  try {
    const userId = req.user._id.toString();
    const status = indexer.getIndexingStatus(userId);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('[MemoryController] Failed to get index status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Check if user is busy (indexing)
 * GET /api/memory/busy
 */
export async function checkBusy(req, res) {
  try {
    const userId = req.user._id.toString();
    const isIndexing = indexer.isIndexing(userId);

    res.json({
      success: true,
      data: {
        busy: isIndexing,
        message: isIndexing ? '用户繁忙中...' : null
      }
    });
  } catch (error) {
    logger.error('[MemoryController] Failed to check busy:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get pending topics
 * GET /api/memory/pending-topics
 */
export async function getPendingTopics(req, res) {
  try {
    const userId = req.user._id.toString();
    const PendingTopicsManager = (await import('./PendingTopicsManager.js')).default;
    const manager = new PendingTopicsManager();

    const topics = await manager.getPendingTopics(userId);

    res.json({
      success: true,
      data: topics
    });
  } catch (error) {
    logger.error('[MemoryController] Failed to get pending topics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Clear pending topic
 * DELETE /api/memory/pending-topics/:topicId
 */
export async function clearPendingTopic(req, res) {
  try {
    const userId = req.user._id.toString();
    const { topicId } = req.params;

    const PendingTopicsManager = (await import('./PendingTopicsManager.js')).default;
    const manager = new PendingTopicsManager();

    await manager.clearTopic(userId, topicId);

    res.json({
      success: true,
      message: '话题已清除'
    });
  } catch (error) {
    logger.error('[MemoryController] Failed to clear pending topic:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export default {
  getIndexStatus,
  checkBusy,
  getPendingTopics,
  clearPendingTopic
};
```

**Step 2: Commit**

```bash
git add server/src/modules/memory/controller.js
git commit -m "feat(memory): add memory controller with index status API"
```

---

### Task 4.4: Add Memory Routes

**Files:**
- Create: `server/src/modules/memory/route.js`

**Step 1: Create memory routes**

```javascript
/**
 * Memory Routes
 */

import express from 'express';
import { authenticate } from '../auth/middleware.js';
import {
  getIndexStatus,
  checkBusy,
  getPendingTopics,
  clearPendingTopic
} from './controller.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Index status
router.get('/index/status', getIndexStatus);
router.get('/busy', checkBusy);

// Pending topics
router.get('/pending-topics', getPendingTopics);
router.delete('/pending-topics/:topicId', clearPendingTopic);

export default router;
```

**Step 2: Register routes in server.js**

In `server/src/server.js`, add:

```javascript
import memoryRoutes from './modules/memory/route.js';
// ...
app.use('/api/memory', memoryRoutes);
```

**Step 3: Commit**

```bash
git add server/src/modules/memory/route.js server/src/server.js
git commit -m "feat(memory): add memory API routes"
```

---

### Task 4.5: Update Memory Index on Save

**Files:**
- Modify: `server/src/modules/memory/MemoryStore.js`

**Step 1: Add auto-indexing to saveMemory**

Update the `saveMemory` method to trigger indexing:

```javascript
  /**
   * Save conversation memory with auto-indexing
   * @param {string} userId - User ID
   * @param {string} withUserId - Partner ID
   * @param {Object} memoryData - Memory data
   * @param {boolean} autoIndex - Whether to auto-index (default true)
   * @returns {Promise<Object>} Saved memory
   */
  async saveMemory(userId, withUserId, memoryData, autoIndex = true) {
    try {
      const conversationPath = this.getConversationPath(userId, withUserId);
      await fsPromises.mkdir(conversationPath, { recursive: true });

      const memoryId = memoryData.memoryId || this.generateMemoryId();
      const fileName = this.generateFileName(memoryData);
      const filePath = path.join(conversationPath, fileName);

      const memory = {
        memoryId,
        version: '1.0.0',
        meta: {
          createdAt: memoryData.createdAt || new Date().toISOString(),
          participants: [userId, withUserId],
          participantRoles: memoryData.participantRoles || {},
          messageCount: memoryData.messageCount || 0,
          compressionStage: 'raw',
          compressedAt: null
        },
        content: {
          raw: memoryData.raw || '',
          processed: memoryData.processed || null
        },
        pendingTopics: memoryData.pendingTopics || { hasUnfinished: false, topics: [] },
        personalityFiltered: memoryData.personalityFiltered || null,
        vectorIndex: {
          indexed: false,
          indexedAt: null
        },
        tags: memoryData.tags || []
      };

      await fsPromises.writeFile(filePath, JSON.stringify(memory, null, 2), 'utf-8');
      logger.info(`[MemoryStore] Saved memory: ${memoryId} for user ${userId}`);

      // Auto-index if enabled
      if (autoIndex) {
        this.triggerIndexing(userId, memory).catch(error => {
          logger.error(`[MemoryStore] Auto-indexing failed for ${memoryId}:`, error);
        });
      }

      return { memoryId, filePath, memory };
    } catch (error) {
      logger.error('[MemoryStore] Failed to save memory:', error);
      throw error;
    }
  }

  /**
   * Trigger async indexing
   * @param {string} userId - User ID
   * @param {Object} memory - Memory to index
   */
  async triggerIndexing(userId, memory) {
    const Indexer = (await import('./Indexer.js')).default;
    const indexer = new Indexer();

    const result = await indexer.indexConversationMemory(userId, memory);

    if (result.success) {
      // Update memory file to mark as indexed
      const files = await this.findMemoryFile(userId, memory.memoryId);
      if (files.length > 0) {
        await this.markAsIndexed(files[0]);
      }
    }

    return result;
  }

  /**
   * Find memory file by ID
   * @param {string} userId - User ID
   * @param {string} memoryId - Memory ID
   * @returns {Promise<string[]>} File paths
   */
  async findMemoryFile(userId, memoryId) {
    const memories = await this.loadUserMemories(userId);
    const files = [];

    for (const partnerId in memories) {
      for (const memory of memories[partnerId]) {
        if (memory.memoryId === memoryId && memory._filePath) {
          files.push(memory._filePath);
        }
      }
    }

    return files;
  }
```

**Step 2: Commit**

```bash
git add server/src/modules/memory/MemoryStore.js
git commit -m "feat(memory): add auto-indexing on memory save"
```

---

## Phase 4 Complete

Phase 4 implements vector index integration:

- ✅ Refactored VectorIndexService for conversation memories
- ✅ Real-time Indexer class
- ✅ Index status API endpoints
- ✅ Memory routes registration
- ✅ Auto-indexing on memory save

**Key Features:**
- Supports both questionnaire and conversation memories
- Batch indexing with progress callback
- Index status tracking (idle/indexing/complete/error)
- Queue system for concurrent indexing requests

**Next: Phase 5 - Token Management**

---

## Phase 5: Token Management

### Task 5.1: Create TokenMonitor Node

**Files:**
- Create: `server/src/modules/chat/nodes/tokenMonitor.js`

**Step 1: Create TokenMonitor node**

```javascript
/**
 * TokenMonitor Node
 * Monitors token usage and triggers conversation termination
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { countTokens } from '../../../core/utils/tokens.js';
import logger from '../../../core/utils/logger.js';

// Model context limits
const MODEL_LIMITS = {
  'deepseek-r1:14b': 65536,
  'deepseek-r1': 65536,
  'qwen2.5': 32768,
  'llama3': 8192,
  'default': 65536
};

// Thresholds
const THRESHOLDS = {
  gentleReminder: 0.6,  // 60% - hint at ending
  forceTerminate: 0.7   // 70% - force end
};

/**
 * Token Monitor Node
 * @param {ConversationState} state - Conversation state
 * @returns {Promise<void>}
 */
export async function tokenMonitorNode(state) {
  try {
    const modelUsed = state.metadata?.modelUsed || process.env.OLLAMA_MODEL || 'deepseek-r1:14b';
    const maxTokens = MODEL_LIMITS[modelUsed] || MODEL_LIMITS.default;

    // Count tokens in conversation
    const tokenCount = calculateConversationTokens(state);

    const ratio = tokenCount / maxTokens;
    const percentage = Math.round(ratio * 100);

    logger.info(`[TokenMonitor] Token usage: ${tokenCount}/${maxTokens} (${percentage}%)`);

    // Store token info in state
    state.tokenInfo = {
      current: tokenCount,
      max: maxTokens,
      ratio,
      percentage,
      modelUsed
    };

    // Check thresholds
    if (ratio >= THRESHOLDS.forceTerminate) {
      state.tokenInfo.action = 'terminate';
      state.tokenInfo.message = await generateTerminationMessage(state);
      logger.info(`[TokenMonitor] Force termination triggered at ${percentage}%`);
    } else if (ratio >= THRESHOLDS.gentleReminder) {
      state.tokenInfo.action = 'remind';
      state.tokenInfo.message = await generateReminderMessage(state);
      logger.info(`[TokenMonitor] Gentle reminder triggered at ${percentage}%`);
    } else {
      state.tokenInfo.action = 'continue';
    }

  } catch (error) {
    logger.error('[TokenMonitor] Error:', error);
    state.tokenInfo = {
      action: 'continue',
      error: error.message
    };
  }
}

/**
 * Calculate total tokens in conversation
 * @param {ConversationState} state - Conversation state
 * @returns {number} Token count
 */
function calculateConversationTokens(state) {
  let total = 0;

  // System prompt
  if (state.systemPrompt) {
    total += countTokens(state.systemPrompt);
  }

  // Messages
  if (state.messages) {
    for (const msg of state.messages) {
      if (msg.content) {
        total += countTokens(msg.content);
      }
    }
  }

  // Retrieved memories (if any)
  if (state.retrievedMemories) {
    for (const memory of state.retrievedMemories) {
      if (memory.content) {
        total += countTokens(memory.content);
      }
    }
  }

  // Current input
  if (state.currentInput) {
    total += countTokens(state.currentInput);
  }

  // Add buffer for response generation
  total += 1000;

  return total;
}

/**
 * Generate gentle reminder message
 * @param {ConversationState} state - Conversation state
 * @returns {Promise<string>} Message
 */
async function generateReminderMessage(state) {
  // Get personality from role card
  const personality = state.roleCard?.personality?.summary || '';
  const communicationStyle = state.roleCard?.communicationStyle?.summary || '';

  // Simple template-based generation
  const templates = [
    '哎呀，聊了这么久，我有点累了，要不先休息一下？',
    '时间过得真快，我们聊了好多呢。我需要歇会儿，等下再聊？',
    '今天聊得很开心，不过我感觉有点乏了，改天再继续？',
    '嗯...说了这么多话，嘴巴都干了。要不先喝口水，休息一下？'
  ];

  // TODO: Could use LLM to generate personality-matched message
  // For now, use template
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Generate termination message
 * @param {ConversationState} state - Conversation state
 * @returns {Promise<string>} Message
 */
async function generateTerminationMessage(state) {
  const templates = [
    '今天实在有点累了，我们下次再聊吧。再见！',
    '抱歉，我现在需要休息一下。很高兴和你聊天，下次见！',
    '时间不早了，我先去休息了。期待下次和你再聊！'
  ];

  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Check if user wants to end conversation
 * @param {string} message - User message
 * @returns {boolean} True if ending
 */
export function detectEndIntent(message) {
  const endPhrases = [
    '结束对话', '不聊了', '再见', '拜拜', '下次聊',
    '先这样', '挂了', '走了', 'bye', 'goodbye',
    '今天就到这里', '不说了', '改天聊', '先忙'
  ];

  const lowerMessage = message.toLowerCase();
  return endPhrases.some(phrase => lowerMessage.includes(phrase));
}

export default tokenMonitorNode;
```

**Step 2: Commit**

```bash
git add server/src/modules/chat/nodes/tokenMonitor.js
git commit -m "feat(chat): create TokenMonitor node"
```

---

### Task 5.2: Add Token Threshold Response Node

**Files:**
- Create: `server/src/modules/chat/nodes/tokenResponse.js`

**Step 1: Create token response handler**

```javascript
/**
 * Token Response Node
 * Handles responses when token thresholds are reached
 *
 * @author AFS Team
 * @version 1.0.0
 */

import logger from '../../../core/utils/logger.js';

/**
 * Token Response Node
 * Checks token info and modifies response if needed
 * @param {ConversationState} state - Conversation state
 * @returns {Promise<Object|null>} Modified response or null
 */
export async function tokenResponseNode(state) {
  try {
    const tokenInfo = state.tokenInfo;

    if (!tokenInfo) {
      return null;
    }

    // If termination needed, override response
    if (tokenInfo.action === 'terminate') {
      logger.info('[TokenResponse] Overriding response with termination message');

      state.generatedResponse = tokenInfo.message;
      state.metadata.tokenTerminated = true;
      state.metadata.shouldEndSession = true;

      return {
        message: tokenInfo.message,
        metadata: {
          tokenTerminated: true,
          tokenPercentage: tokenInfo.percentage
        }
      };
    }

    // If reminder needed, append to response
    if (tokenInfo.action === 'remind') {
      logger.info('[TokenResponse] Appending reminder to response');

      // Don't modify - let the frontend handle the reminder
      state.metadata.tokenWarning = true;
      state.metadata.tokenWarningMessage = tokenInfo.message;
      state.metadata.tokenPercentage = tokenInfo.percentage;
    }

    return null;
  } catch (error) {
    logger.error('[TokenResponse] Error:', error);
    return null;
  }
}

export default tokenResponseNode;
```

**Step 2: Commit**

```bash
git add server/src/modules/chat/nodes/tokenResponse.js
git commit -m "feat(chat): create token response handler node"
```

---

### Task 5.3: Integrate Token Monitoring into Chat Flow

**Files:**
- Modify: `server/src/modules/chat/orchestrator.js`
- Modify: `server/src/modules/chat/edges/edges.js`

**Step 1: Add token nodes to orchestrator**

In `orchestrator.js`, add imports and register nodes:

```javascript
import { tokenMonitorNode } from './nodes/tokenMonitor.js';
import { tokenResponseNode } from './nodes/tokenResponse.js';

// In constructor, add to nodes:
this.nodes = {
  // ... existing nodes
  token_monitor: tokenMonitorNode,
  token_response: tokenResponseNode
};
```

**Step 2: Update edges**

In `edges.js`, add token monitoring:

```javascript
export const edges = {
  input_processor: 'relation_confirm',
  relation_confirm: 'rolecard_assemble',
  rolecard_assemble: 'token_monitor',  // Add token check
  token_monitor: 'rag_retriever',      // Then continue
  // ... rest unchanged
};

export const conditionalEdges = {
  // Add token response check after response generation
  response_generator: (state) => {
    if (state.tokenInfo?.action === 'terminate') {
      return 'token_response';
    }
    return 'memory_updater';
  },

  token_response: (state) => {
    return 'output_formatter';
  },

  // ... rest unchanged
};
```

**Step 3: Commit**

```bash
git add server/src/modules/chat/orchestrator.js server/src/modules/chat/edges/edges.js
git commit -m "feat(chat): integrate token monitoring into chat flow"
```

---

### Task 5.4: Add End Intent Detection

**Files:**
- Modify: `server/src/modules/chat/nodes/inputProcessor.js`

**Step 1: Add end intent detection**

In `inputProcessor.js`, add:

```javascript
import { detectEndIntent } from './tokenMonitor.js';

// In inputProcessorNode function, add:
export async function inputProcessorNode(state) {
  // ... existing code

  // Check for end intent
  if (detectEndIntent(state.currentInput)) {
    logger.info('[InputProcessor] User wants to end conversation');
    state.metadata.endIntentDetected = true;
    state.metadata.shouldEndSession = true;
  }

  // ... rest of function
}
```

**Step 2: Commit**

```bash
git add server/src/modules/chat/nodes/inputProcessor.js
git commit -m "feat(chat): add end intent detection to input processor"
```

---

### Task 5.5: Add 30-Minute Timeout Handler

**Files:**
- Create: `server/src/modules/chat/SessionManager.js`

**Step 1: Create session manager**

```javascript
/**
 * SessionManager - Chat Session Timeout Management
 * Handles 30-minute inactivity timeout
 *
 * @author AFS Team
 * @version 1.0.0
 */

import ChatSession from './model.js';
import { MemoryStore, MemoryExtractor } from '../memory/index.js';
import logger from '../../core/utils/logger.js';

class SessionManager {
  constructor() {
    this.activeSessions = new Map(); // sessionId -> { lastActivity, timeoutHandle }
    this.TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

    this.memoryStore = new MemoryStore();
    this.memoryExtractor = new MemoryExtractor();
  }

  /**
   * Register activity for a session
   * @param {string} sessionId - Session ID
   */
  registerActivity(sessionId) {
    const session = this.activeSessions.get(sessionId);

    if (session) {
      // Clear existing timeout
      if (session.timeoutHandle) {
        clearTimeout(session.timeoutHandle);
      }

      // Set new timeout
      session.lastActivity = Date.now();
      session.timeoutHandle = setTimeout(() => {
        this.handleTimeout(sessionId);
      }, this.TIMEOUT_MS);

      logger.debug(`[SessionManager] Activity registered for session ${sessionId}`);
    }
  }

  /**
   * Start tracking a session
   * @param {string} sessionId - Session ID
   * @param {Object} sessionData - Session data
   */
  startSession(sessionId, sessionData) {
    this.activeSessions.set(sessionId, {
      ...sessionData,
      lastActivity: Date.now(),
      timeoutHandle: setTimeout(() => {
        this.handleTimeout(sessionId);
      }, this.TIMEOUT_MS)
    });

    logger.info(`[SessionManager] Started tracking session ${sessionId}`);
  }

  /**
   * Stop tracking a session
   * @param {string} sessionId - Session ID
   */
  stopSession(sessionId) {
    const session = this.activeSessions.get(sessionId);

    if (session) {
      if (session.timeoutHandle) {
        clearTimeout(session.timeoutHandle);
      }
      this.activeSessions.delete(sessionId);
      logger.info(`[SessionManager] Stopped tracking session ${sessionId}`);
    }
  }

  /**
   * Handle session timeout
   * @param {string} sessionId - Session ID
   */
  async handleTimeout(sessionId) {
    try {
      logger.info(`[SessionManager] Session ${sessionId} timed out after 30 minutes`);

      const session = this.activeSessions.get(sessionId);
      if (!session) return;

      // Get full session from database
      const chatSession = await ChatSession.findOne({ sessionId });
      if (!chatSession || chatSession.messages.length === 0) {
        this.stopSession(sessionId);
        return;
      }

      // Save conversation as memory
      await this.saveConversationMemory(chatSession);

      // Mark session as ended
      chatSession.endedAt = new Date();
      chatSession.isActive = false;
      await chatSession.save();

      // Remove from active sessions
      this.activeSessions.delete(sessionId);

      logger.info(`[SessionManager] Session ${sessionId} saved and closed`);
    } catch (error) {
      logger.error(`[SessionManager] Error handling timeout for ${sessionId}:`, error);
    }
  }

  /**
   * Save conversation as memory
   * @param {Object} chatSession - Chat session from DB
   */
  async saveConversationMemory(chatSession) {
    try {
      const { targetUserId, interlocutorUserId, messages } = chatSession;

      // Format conversation
      const raw = messages.map(msg => {
        const role = msg.role === 'user' ? '对话对象' : '角色卡';
        return `[${role}] ${msg.content}`;
      }).join('\n');

      // Get role cards for both users
      const DualStorage = (await import('../../core/storage/dual.js')).default;
      const dualStorage = new DualStorage();

      const roleCardA = await dualStorage.loadRoleCardV2(targetUserId);
      const roleCardB = await dualStorage.loadRoleCardV2(interlocutorUserId);

      // Extract memory for user A (always has role card)
      const memoryA = await this.memoryExtractor.extract({
        messages,
        roleCard: roleCardA,
        participants: {
          ownerId: targetUserId,
          ownerName: roleCardA?.coreLayer?.basicIdentity?.raw?.name || '角色卡主人',
          interlocutorId: interlocutorUserId,
          interlocutorName: chatSession.interlocutorName || '对话对象',
          relationType: chatSession.relation
        }
      });

      // Extract memory for user B (if has role card)
      let memoryB = null;
      if (roleCardB) {
        memoryB = await this.memoryExtractor.extract({
          messages,
          roleCard: roleCardB,
          participants: {
            ownerId: interlocutorUserId,
            ownerName: roleCardB?.coreLayer?.basicIdentity?.raw?.name || '角色卡主人',
            interlocutorId: targetUserId,
            interlocutorName: chatSession.targetUserName || '对话对象',
            relationType: 'unknown'
          }
        });
      }

      // Save bidirectional
      await this.memoryStore.saveBidirectional({
        userAId: targetUserId,
        userBId: interlocutorUserId,
        conversationData: {
          raw,
          messageCount: messages.length,
          createdAt: chatSession.startedAt
        },
        userAMemory: memoryA,
        userBMemory: memoryB
      });

      logger.info(`[SessionManager] Conversation saved as memory for session ${chatSession.sessionId}`);
    } catch (error) {
      logger.error('[SessionManager] Failed to save conversation memory:', error);
      throw error;
    }
  }

  /**
   * Check if session is still active
   * @param {string} sessionId - Session ID
   * @returns {boolean}
   */
  isActive(sessionId) {
    return this.activeSessions.has(sessionId);
  }

  /**
   * Get time until timeout
   * @param {string} sessionId - Session ID
   * @returns {number|null} Milliseconds until timeout
   */
  getTimeUntilTimeout(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    const elapsed = Date.now() - session.lastActivity;
    return Math.max(0, this.TIMEOUT_MS - elapsed);
  }
}

export default SessionManager;
```

**Step 2: Commit**

```bash
git add server/src/modules/chat/SessionManager.js
git commit -m "feat(chat): create SessionManager for 30-min timeout"
```

---

## Phase 5 Complete

Phase 5 implements token management and session handling:

- ✅ TokenMonitor node (60% warning, 70% terminate)
- ✅ Token response handler
- ✅ Integration with chat flow
- ✅ End intent detection ("结束对话" etc.)
- ✅ 30-minute inactivity timeout
- ✅ Auto-save conversation on timeout

**Key Features:**
- Real-time token counting
- Personality-matched termination messages
- End intent phrase detection
- Automatic memory saving on timeout

**Next: Phase 6 - Pending Topics & Proactive Messaging**

---

## Phase 6: Pending Topics & Proactive Messaging

### Task 6.1: Create PendingTopicsManager

**Files:**
- Create: `server/src/modules/memory/PendingTopicsManager.js`

**Step 1: Create PendingTopicsManager class**

```javascript
/**
 * PendingTopicsManager - Unfinished Conversation Topics
 * Manages topics that need follow-up in future conversations
 *
 * @author AFS Team
 * @version 1.0.0
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import logger from '../../core/utils/logger.js';

class PendingTopicsManager {
  constructor() {
    // Detect Docker environment
    const isDocker = fs.existsSync('/.dockerenv') ||
                     process.env.DOCKER_CONTAINER === 'true';

    this.basePath = isDocker
      ? '/app/storage/userdata'
      : path.join(process.cwd(), 'server', 'storage', 'userdata');
  }

  /**
   * Get pending topics file path
   * @param {string} userId - User ID
   * @returns {string} File path
   */
  getFilePath(userId) {
    return path.join(this.basePath, String(userId), 'pending_topics.json');
  }

  /**
   * Get all pending topics for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Pending topics
   */
  async getPendingTopics(userId) {
    try {
      const filePath = this.getFilePath(userId);

      if (!fs.existsSync(filePath)) {
        return { userId, pendingTopics: [] };
      }

      const data = await fsPromises.readFile(filePath, 'utf-8');
      const topics = JSON.parse(data);

      // Filter out expired topics (older than 7 days)
      const now = Date.now();
      topics.pendingTopics = topics.pendingTopics.filter(topic => {
        const age = now - new Date(topic.createdAt).getTime();
        return age < 7 * 24 * 60 * 60 * 1000; // 7 days
      });

      return topics;
    } catch (error) {
      logger.error(`[PendingTopicsManager] Failed to get topics for ${userId}:`, error);
      return { userId, pendingTopics: [] };
    }
  }

  /**
   * Add a pending topic
   * @param {string} userId - User ID
   * @param {Object} topic - Topic data
   * @returns {Promise<Object>} Added topic
   */
  async addTopic(userId, topic) {
    try {
      const filePath = this.getFilePath(userId);
      await fsPromises.mkdir(path.dirname(filePath), { recursive: true });

      let data = { userId, pendingTopics: [] };

      if (fs.existsSync(filePath)) {
        const fileData = await fsPromises.readFile(filePath, 'utf-8');
        data = JSON.parse(fileData);
      }

      const newTopic = {
        id: `topic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        topic: topic.topic,
        context: topic.context,
        suggestedFollowUp: topic.suggestedFollowUp,
        withUserId: topic.withUserId,
        conversationId: topic.conversationId,
        urgency: topic.urgency || 'medium',
        createdAt: new Date().toISOString(),
        lastChecked: null,
        status: 'pending'
      };

      data.pendingTopics.push(newTopic);

      await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
      logger.info(`[PendingTopicsManager] Added topic ${newTopic.id} for user ${userId}`);

      return newTopic;
    } catch (error) {
      logger.error('[PendingTopicsManager] Failed to add topic:', error);
      throw error;
    }
  }

  /**
   * Clear a pending topic
   * @param {string} userId - User ID
   * @param {string} topicId - Topic ID
   */
  async clearTopic(userId, topicId) {
    try {
      const filePath = this.getFilePath(userId);

      if (!fs.existsSync(filePath)) {
        return;
      }

      const data = await fsPromises.readFile(filePath, 'utf-8');
      const topics = JSON.parse(data);

      topics.pendingTopics = topics.pendingTopics.filter(t => t.id !== topicId);

      await fsPromises.writeFile(filePath, JSON.stringify(topics, null, 2), 'utf-8');
      logger.info(`[PendingTopicsManager] Cleared topic ${topicId}`);
    } catch (error) {
      logger.error('[PendingTopicsManager] Failed to clear topic:', error);
      throw error;
    }
  }

  /**
   * Mark topic as checked (mentioned in conversation)
   * @param {string} userId - User ID
   * @param {string} topicId - Topic ID
   */
  async markAsChecked(userId, topicId) {
    try {
      const filePath = this.getFilePath(userId);

      if (!fs.existsSync(filePath)) {
        return;
      }

      const data = await fsPromises.readFile(filePath, 'utf-8');
      const topics = JSON.parse(data);

      const topic = topics.pendingTopics.find(t => t.id === topicId);
      if (topic) {
        topic.lastChecked = new Date().toISOString();
        topic.checkCount = (topic.checkCount || 0) + 1;
      }

      await fsPromises.writeFile(filePath, JSON.stringify(topics, null, 2), 'utf-8');
    } catch (error) {
      logger.error('[PendingTopicsManager] Failed to mark topic as checked:', error);
    }
  }

  /**
   * Get topics for a specific conversation partner
   * @param {string} userId - User ID
   * @param {string} withUserId - Partner ID
   * @returns {Promise<Array>} Relevant topics
   */
  async getTopicsForPartner(userId, withUserId) {
    const allTopics = await this.getPendingTopics(userId);
    return allTopics.pendingTopics.filter(t => t.withUserId === withUserId);
  }

  /**
   * Get random topic to mention (probabilistic)
   * @param {string} userId - User ID
   * @param {string} withUserId - Partner ID
   * @param {number} probability - Probability to return a topic (0-1)
   * @returns {Promise<Object|null>} Topic or null
   */
  async getRandomTopicToMention(userId, withUserId, probability = 0.3) {
    if (Math.random() > probability) {
      return null;
    }

    const topics = await this.getTopicsForPartner(userId, withUserId);

    if (topics.length === 0) {
      return null;
    }

    // Prefer high urgency topics
    const highUrgency = topics.filter(t => t.urgency === 'high');
    if (highUrgency.length > 0 && Math.random() < 0.7) {
      return highUrgency[Math.floor(Math.random() * highUrgency.length)];
    }

    return topics[Math.floor(Math.random() * topics.length)];
  }
}

export default PendingTopicsManager;
```

**Step 2: Commit**

```bash
git add server/src/modules/memory/PendingTopicsManager.js
git commit -m "feat(memory): create PendingTopicsManager"
```

---

### Task 6.2: Create Proactive Messaging Prompt

**Files:**
- Create: `server/src/modules/memory/prompts/proactiveMessage.js`

**Step 1: Create proactive message prompt**

```javascript
/**
 * Proactive Message Prompt
 * LLM generates proactive messages based on personality and pending topics
 */

export const PROACTIVE_MESSAGE_PROMPT = `# 角色定义
你是一位模拟真实人类主动发起对话的专家，擅长根据人格特点生成自然、不突兀的主动消息。

# 任务说明
请根据角色卡主人的人格特点和待续话题，生成一条主动发起的消息。

## 角色卡主人的人格信息
\${roleCardPersonality}

## 待续话题信息
\${pendingTopic}

## 时间信息
距离上次对话：\${daysSinceLastChat} 天

---

# 处理步骤

## 步骤1：分析人格特点
根据人格特点确定：
- 说话风格（直接/委婉/幽默/正式）
- 主动性程度（主动/被动/看情况）
- 情感表达方式

## 步骤2：确定消息时机
判断现在是否是合适的时机：
- 如果太久没联系（>7天），可以更直接
- 如果刚聊过（<2天），可以更委婉

## 步骤3：生成消息
生成一条自然的主动消息，要求：
- 符合角色卡主人的说话风格
- 自然地引出待续话题
- 不要显得刻意或突兀
- 长度适中（20-50字）

---

# 输出格式（严格 JSON）

\`\`\`json
{
  "message": "主动发送的消息内容",
  "style": "casual/formal/playful/warm",
  "reasoning": "选择这种风格的原因",
  "topicIntroduced": true,
  "alternativeMessages": [
    "备选消息1",
    "备选消息2"
  ]
}
\`\`\`

# 约束条件
1. 消息必须符合人格特点
2. 不要显得太刻意
3. 保持自然的语气
4. 20-50个汉字`;

export const TIMING_DECISION_PROMPT = `# 角色定义
你是一个判断沟通时机的专家。

# 任务说明
根据角色卡主人的人格特点和当前情况，判断是否应该主动发送消息。

## 角色卡主人的人格信息
\${roleCardPersonality}

## 情况信息
- 距离上次对话：\${daysSinceLastChat} 天
- 待续话题数量：\${pendingTopicCount}
- 待续话题紧急程度：\${urgency}

---

# 输出格式（严格 JSON）

\`\`\`json
{
  "shouldSend": true/false,
  "reasoning": "判断理由",
  "bestTiming": "现在/明天/周末/不确定",
  "confidence": 0.8
}
\`\`\``;

export default { PROACTIVE_MESSAGE_PROMPT, TIMING_DECISION_PROMPT };
```

**Step 2: Commit**

```bash
git add server/src/modules/memory/prompts/proactiveMessage.js
git commit -m "feat(memory): add proactive message prompts"
```

---

### Task 6.3: Create ProactiveMessagingManager

**Files:**
- Create: `server/src/modules/memory/ProactiveMessagingManager.js`

**Step 1: Create proactive messaging manager**

```javascript
/**
 * ProactiveMessagingManager - Proactive Message Generation
 * Handles personality-driven proactive messaging
 *
 * @author AFS Team
 * @version 1.0.0
 */

import LLMClient from '../../core/llm/client.js';
import PendingTopicsManager from './PendingTopicsManager.js';
import DualStorage from '../../core/storage/dual.js';
import { PROACTIVE_MESSAGE_PROMPT, TIMING_DECISION_PROMPT } from './prompts/proactiveMessage.js';
import logger from '../../core/utils/logger.js';

class ProactiveMessagingManager {
  constructor() {
    this.llmClient = new LLMClient(process.env.OLLAMA_MODEL || 'deepseek-r1:14b', {
      temperature: 0.7, // Higher for more natural variation
      timeout: 30000
    });
    this.pendingTopicsManager = new PendingTopicsManager();
    this.dualStorage = new DualStorage();
  }

  /**
   * Check if should send proactive message
   * @param {string} userId - User ID
   * @param {string} withUserId - Partner ID
   * @returns {Promise<Object>} Decision
   */
  async shouldSendProactive(userId, withUserId) {
    try {
      const roleCard = await this.dualStorage.loadRoleCardV2(userId);
      if (!roleCard) {
        return { shouldSend: false, reason: 'No role card' };
      }

      const topics = await this.pendingTopicsManager.getTopicsForPartner(userId, withUserId);
      if (topics.length === 0) {
        return { shouldSend: false, reason: 'No pending topics' };
      }

      // Get last chat time (would need to query ChatSession)
      const daysSinceLastChat = await this.getDaysSinceLastChat(userId, withUserId);

      // Use LLM to decide timing
      const personalityText = this.formatPersonality(roleCard);
      const prompt = TIMING_DECISION_PROMPT
        .replace('${roleCardPersonality}', personalityText)
        .replace('${daysSinceLastChat}', daysSinceLastChat.toString())
        .replace('${pendingTopicCount}', topics.length.toString())
        .replace('${urgency}', this.getHighestUrgency(topics));

      const response = await this.llmClient.generate(prompt, {
        temperature: 0.3,
        maxTokens: 500
      });

      const decision = this.parseResponse(response);
      decision.daysSinceLastChat = daysSinceLastChat;
      decision.topicsCount = topics.length;

      return decision;
    } catch (error) {
      logger.error('[ProactiveMessaging] Failed to check timing:', error);
      return { shouldSend: false, reason: error.message };
    }
  }

  /**
   * Generate proactive message
   * @param {string} userId - User ID
   * @param {string} withUserId - Partner ID
   * @returns {Promise<Object>} Generated message
   */
  async generateProactiveMessage(userId, withUserId) {
    try {
      const roleCard = await this.dualStorage.loadRoleCardV2(userId);
      if (!roleCard) {
        throw new Error('No role card found');
      }

      // Get a random topic to mention
      const topic = await this.pendingTopicsManager.getRandomTopicToMention(userId, withUserId, 1.0);
      if (!topic) {
        throw new Error('No pending topics');
      }

      const daysSinceLastChat = await this.getDaysSinceLastChat(userId, withUserId);
      const personalityText = this.formatPersonality(roleCard);
      const topicText = `话题：${topic.topic}\n背景：${topic.context}\n建议说法：${topic.suggestedFollowUp}`;

      const prompt = PROACTIVE_MESSAGE_PROMPT
        .replace('${roleCardPersonality}', personalityText)
        .replace('${pendingTopic}', topicText)
        .replace('${daysSinceLastChat}', daysSinceLastChat.toString());

      const response = await this.llmClient.generate(prompt, {
        temperature: 0.7,
        maxTokens: 300
      });

      const result = this.parseResponse(response);
      result.topicId = topic.id;
      result.withUserId = withUserId;

      logger.info(`[ProactiveMessaging] Generated message for user ${userId}`);

      return result;
    } catch (error) {
      logger.error('[ProactiveMessaging] Failed to generate message:', error);
      throw error;
    }
  }

  /**
   * Format personality for prompt
   * @param {Object} roleCard - Role card
   * @returns {string} Formatted text
   */
  formatPersonality(roleCard) {
    const coreLayer = roleCard.coreLayer || roleCard;
    const parts = [];

    if (coreLayer.personality?.summary) {
      parts.push(`【性格】${coreLayer.personality.summary}`);
    }
    if (coreLayer.communicationStyle?.summary) {
      parts.push(`【说话风格】${coreLayer.communicationStyle.summary}`);
    }
    if (coreLayer.emotionalNeeds?.summary) {
      parts.push(`【情感需求】${coreLayer.emotionalNeeds.summary}`);
    }

    return parts.join('\n') || '性格温和，说话自然';
  }

  /**
   * Get highest urgency from topics
   * @param {Array} topics - Topics array
   * @returns {string} Highest urgency
   */
  getHighestUrgency(topics) {
    if (topics.some(t => t.urgency === 'high')) return 'high';
    if (topics.some(t => t.urgency === 'medium')) return 'medium';
    return 'low';
  }

  /**
   * Get days since last chat
   * @param {string} userId - User ID
   * @param {string} withUserId - Partner ID
   * @returns {Promise<number>} Days
   */
  async getDaysSinceLastChat(userId, withUserId) {
    try {
      const ChatSession = (await import('../chat/model.js')).default;
      const lastSession = await ChatSession.findOne({
        targetUserId: userId,
        interlocutorUserId: withUserId,
        isActive: false
      }).sort({ endedAt: -1 });

      if (!lastSession || !lastSession.endedAt) {
        return 999; // Never chatted
      }

      const diffMs = Date.now() - new Date(lastSession.endedAt).getTime();
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    } catch (error) {
      return 999;
    }
  }

  /**
   * Parse LLM response
   * @param {string} response - Response text
   * @returns {Object} Parsed JSON
   */
  parseResponse(response) {
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      const cleanResponse = response.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
      return JSON.parse(cleanResponse);
    } catch (error) {
      logger.error('[ProactiveMessaging] Failed to parse response:', error);
      return { message: '', error: 'Parse failed' };
    }
  }
}

export default ProactiveMessagingManager;
```

**Step 2: Commit**

```bash
git add server/src/modules/memory/ProactiveMessagingManager.js
git commit -m "feat(memory): create ProactiveMessagingManager"
```

---

### Task 6.4: Integrate Pending Topics with Conversation

**Files:**
- Modify: `server/src/modules/chat/nodes/contextBuilder.js`

**Step 1: Add pending topics to context**

```javascript
import PendingTopicsManager from '../../memory/PendingTopicsManager.js';

// In contextBuilderNode function:
export async function contextBuilderNode(state) {
  // ... existing code

  // Check for pending topics to mention
  const pendingTopicsManager = new PendingTopicsManager();
  const topic = await pendingTopicsManager.getRandomTopicToMention(
    state.userId,
    state.interlocutor.id,
    0.3 // 30% probability
  );

  if (topic) {
    state.pendingTopicToMention = topic;
    state.context.pendingTopic = {
      topic: topic.topic,
      suggestedFollowUp: topic.suggestedFollowUp,
      context: topic.context
    };

    // Mark as checked
    await pendingTopicsManager.markAsChecked(state.userId, topic.id);

    logger.info(`[ContextBuilder] Including pending topic: ${topic.topic}`);
  }

  // ... rest of function
}
```

**Step 2: Commit**

```bash
git add server/src/modules/chat/nodes/contextBuilder.js
git commit -m "feat(chat): integrate pending topics into conversation context"
```

---

### Task 6.5: Add Proactive Message API

**Files:**
- Modify: `server/src/modules/memory/controller.js`
- Modify: `server/src/modules/memory/route.js`

**Step 1: Add proactive message endpoints**

In `controller.js`:

```javascript
import ProactiveMessagingManager from './ProactiveMessagingManager.js';

const proactiveManager = new ProactiveMessagingManager();

/**
 * Check if should send proactive message
 * GET /api/memory/proactive/check/:withUserId
 */
export async function checkProactive(req, res) {
  try {
    const userId = req.user._id.toString();
    const { withUserId } = req.params;

    const decision = await proactiveManager.shouldSendProactive(userId, withUserId);

    res.json({
      success: true,
      data: decision
    });
  } catch (error) {
    logger.error('[MemoryController] Failed to check proactive:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Generate proactive message
 * POST /api/memory/proactive/generate/:withUserId
 */
export async function generateProactive(req, res) {
  try {
    const userId = req.user._id.toString();
    const { withUserId } = req.params;

    const result = await proactiveManager.generateProactiveMessage(userId, withUserId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('[MemoryController] Failed to generate proactive:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
```

**Step 2: Add routes**

In `route.js`:

```javascript
import { checkProactive, generateProactive } from './controller.js';

// Add routes:
router.get('/proactive/check/:withUserId', checkProactive);
router.post('/proactive/generate/:withUserId', generateProactive);
```

**Step 3: Commit**

```bash
git add server/src/modules/memory/controller.js server/src/modules/memory/route.js
git commit -m "feat(memory): add proactive message API endpoints"
```

---

## Phase 6 Complete

Phase 6 implements pending topics and proactive messaging:

- ✅ PendingTopicsManager for unfinished topics
- ✅ Proactive message prompts (timing + message generation)
- ✅ ProactiveMessagingManager
- ✅ Integration with conversation context
- ✅ API endpoints for proactive messaging

**Key Features:**
- Pending topics stored per user per partner
- Probabilistic topic mention (30% default)
- Personality-driven proactive messages
- LLM-based timing decisions
- 7-day topic expiration

**Next: Phase 7 - Testing & Integration**

---

## Phase 7: Testing & Integration

### Task 7.1: Create Memory Module Unit Tests

**Files:**
- Create: `server/tests/unit/memory/MemoryStore.test.js`
- Create: `server/tests/unit/memory/MemoryExtractor.test.js`

**Step 1: Create MemoryStore tests**

```javascript
/**
 * MemoryStore Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MemoryStore from '../../../src/modules/memory/MemoryStore.js';
import fs from 'fs/promises';
import path from 'path';

describe('MemoryStore', () => {
  let memoryStore;
  const testUserId = 'test_user_123';
  const testWithUserId = 'test_partner_456';
  const testBasePath = './test_storage';

  beforeEach(async () => {
    memoryStore = new MemoryStore();
    memoryStore.basePath = testBasePath;
    await fs.mkdir(testBasePath, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testBasePath, { recursive: true, force: true });
  });

  describe('saveMemory', () => {
    it('should save a memory file', async () => {
      const memoryData = {
        raw: '[对话对象] 你好\n[角色卡] 你好啊',
        messageCount: 2,
        tags: ['greeting']
      };

      const result = await memoryStore.saveMemory(testUserId, testWithUserId, memoryData);

      expect(result.memoryId).toBeDefined();
      expect(result.memoryId).toMatch(/^mem_/);
      expect(result.filePath).toContain('with_test_partner_456');
    });

    it('should create correct folder structure', async () => {
      await memoryStore.saveMemory(testUserId, testWithUserId, { raw: 'test' });

      const folderPath = memoryStore.getConversationPath(testUserId, testWithUserId);
      const exists = await fs.access(folderPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('loadUserMemories', () => {
    it('should return empty object for user with no memories', async () => {
      const memories = await memoryStore.loadUserMemories('nonexistent_user');
      expect(memories).toEqual({});
    });

    it('should load all memories for a user', async () => {
      await memoryStore.saveMemory(testUserId, testWithUserId, {
        raw: 'conversation 1',
        topicSummary: 'test topic'
      });

      const memories = await memoryStore.loadUserMemories(testUserId);

      expect(memories[testWithUserId]).toBeDefined();
      expect(memories[testWithUserId].length).toBe(1);
      expect(memories[testWithUserId][0].content.raw).toBe('conversation 1');
    });
  });

  describe('saveBidirectional', () => {
    it('should save memories for both users', async () => {
      const result = await memoryStore.saveBidirectional({
        userAId: testUserId,
        userBId: testWithUserId,
        conversationData: {
          raw: 'test conversation',
          messageCount: 2
        },
        userAMemory: {
          processed: { summary: 'A视角的摘要' },
          personalityFiltered: { retentionScore: 0.8 }
        },
        userBMemory: {
          processed: { summary: 'B视角的摘要' },
          personalityFiltered: { retentionScore: 0.7 }
        }
      });

      expect(result.userA).toBeDefined();
      expect(result.userB).toBeDefined();

      const memoriesA = await memoryStore.loadUserMemories(testUserId);
      const memoriesB = await memoryStore.loadUserMemories(testWithUserId);

      expect(memoriesA[testWithUserId]).toBeDefined();
      expect(memoriesB[testUserId]).toBeDefined();
    });

    it('should save simplified memory for user without role card', async () => {
      const result = await memoryStore.saveBidirectional({
        userAId: testUserId,
        userBId: testWithUserId,
        conversationData: {
          raw: 'test conversation',
          messageCount: 2
        },
        userAMemory: { processed: { summary: 'A的摘要' } },
        userBMemory: null // No role card
      });

      const memoriesB = await memoryStore.loadUserMemories(testWithUserId);
      expect(memoriesB[testUserId][0].tags).toContain('pending_processing');
    });
  });
});
```

**Step 2: Commit**

```bash
git add server/tests/unit/memory/
git commit -m "test(memory): add MemoryStore unit tests"
```

---

### Task 7.2: Create Compressor Tests

**Files:**
- Create: `server/tests/unit/memory/Compressor.test.js`

**Step 1: Create Compressor tests**

```javascript
/**
 * Compressor Unit Tests
 */

import { describe, it, expect } from 'vitest';
import Compressor from '../../../src/modules/memory/Compressor.js';

describe('Compressor', () => {
  let compressor;

  beforeEach(() => {
    compressor = new Compressor();
  });

  describe('determineCompressionStage', () => {
    it('should return v1 for raw memory older than 3 days', () => {
      const memory = {
        meta: {
          createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          compressionStage: 'raw'
        }
      };

      const stage = compressor.determineCompressionStage(memory);
      expect(stage).toBe('v1');
    });

    it('should return v2 for v1 memory older than 7 days', () => {
      const memory = {
        meta: {
          createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
          compressionStage: 'v1'
        }
      };

      const stage = compressor.determineCompressionStage(memory);
      expect(stage).toBe('v2');
    });

    it('should return null for raw memory less than 3 days old', () => {
      const memory = {
        meta: {
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          compressionStage: 'raw'
        }
      };

      const stage = compressor.determineCompressionStage(memory);
      expect(stage).toBeNull();
    });
  });

  describe('getDaysSinceCreation', () => {
    it('should calculate correct days', () => {
      const createdAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const days = compressor.getDaysSinceCreation(createdAt);
      expect(days).toBe(5);
    });
  });

  describe('formatMemoryForPrompt', () => {
    it('should format processed memory correctly', () => {
      const memory = {
        content: {
          processed: {
            summary: '这是一个测试摘要',
            keyTopics: ['话题1', '话题2'],
            facts: ['事实1']
          }
        }
      };

      const formatted = compressor.formatMemoryForPrompt(memory);
      expect(formatted).toContain('摘要');
      expect(formatted).toContain('话题');
      expect(formatted).toContain('事实');
    });

    it('should use compressed content if available', () => {
      const memory = {
        content: {
          compressed: '压缩后的内容',
          processed: { summary: '原始摘要' }
        }
      };

      const formatted = compressor.formatMemoryForPrompt(memory);
      expect(formatted).toContain('压缩后的内容');
    });
  });
});
```

**Step 2: Commit**

```bash
git add server/tests/unit/memory/Compressor.test.js
git commit -m "test(memory): add Compressor unit tests"
```

---

### Task 7.3: Create Integration Tests

**Files:**
- Create: `server/tests/integration/memory/memory-flow.test.js`

**Step 1: Create integration tests**

```javascript
/**
 * Memory Flow Integration Tests
 * Tests the complete memory lifecycle
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MemoryStore from '../../../src/modules/memory/MemoryStore.js';
import MemoryExtractor from '../../../src/modules/memory/MemoryExtractor.js';
import Indexer from '../../../src/modules/memory/Indexer.js';
import PendingTopicsManager from '../../../src/modules/memory/PendingTopicsManager.js';

describe('Memory Flow Integration', () => {
  let memoryStore, memoryExtractor, indexer, pendingTopicsManager;
  const testUserId = 'integration_test_user';

  beforeEach(() => {
    memoryStore = new MemoryStore();
    memoryExtractor = new MemoryExtractor();
    indexer = new Indexer();
    pendingTopicsManager = new PendingTopicsManager();
  });

  describe('Complete conversation memory flow', () => {
    it('should save, extract, and index a conversation', async () => {
      // 1. Create conversation data
      const messages = [
        { role: 'user', content: '你好，最近怎么样？' },
        { role: 'assistant', content: '挺好的，谢谢关心！你呢？' },
        { role: 'user', content: '我也不错，周末要不要一起吃饭？' },
        { role: 'assistant', content: '好啊，周末见！' }
      ];

      // 2. Save raw memory (user without role card)
      const result = await memoryStore.saveMemory(testUserId, 'partner_123', {
        raw: messages.map(m => `[${m.role === 'user' ? '对话对象' : '角色卡'}] ${m.content}`).join('\n'),
        messageCount: messages.length
      });

      expect(result.memoryId).toBeDefined();

      // 3. Load and verify
      const memories = await memoryStore.loadUserMemories(testUserId);
      expect(memories['partner_123']).toBeDefined();
      expect(memories['partner_123'][0].content.raw).toContain('你好');
    });

    it('should handle bidirectional storage', async () => {
      const conversationData = {
        raw: '[对话对象] 测试消息\n[角色卡] 收到',
        messageCount: 2
      };

      await memoryStore.saveBidirectional({
        userAId: 'user_a',
        userBId: 'user_b',
        conversationData,
        userAMemory: {
          processed: { summary: 'A的视角' },
          personalityFiltered: { retentionScore: 0.9 }
        },
        userBMemory: null
      });

      const memoriesA = await memoryStore.loadUserMemories('user_a');
      const memoriesB = await memoryStore.loadUserMemories('user_b');

      expect(memoriesA['user_b']).toBeDefined();
      expect(memoriesB['user_a']).toBeDefined();
      expect(memoriesB['user_a'][0].tags).toContain('pending_processing');
    });
  });

  describe('Pending topics flow', () => {
    it('should add and retrieve pending topics', async () => {
      const topic = await pendingTopicsManager.addTopic(testUserId, {
        topic: '周末聚餐计划',
        context: '讨论了周末聚餐，但没确定时间',
        suggestedFollowUp: '周末聚餐的事，你想好时间了吗？',
        withUserId: 'partner_123'
      });

      expect(topic.id).toBeDefined();
      expect(topic.status).toBe('pending');

      const topics = await pendingTopicsManager.getPendingTopics(testUserId);
      expect(topics.pendingTopics.length).toBeGreaterThan(0);
    });

    it('should clear pending topic', async () => {
      const topic = await pendingTopicsManager.addTopic(testUserId, {
        topic: '测试话题',
        withUserId: 'partner_123'
      });

      await pendingTopicsManager.clearTopic(testUserId, topic.id);

      const topics = await pendingTopicsManager.getPendingTopics(testUserId);
      const found = topics.pendingTopics.find(t => t.id === topic.id);
      expect(found).toBeUndefined();
    });
  });
});
```

**Step 2: Commit**

```bash
git add server/tests/integration/memory/
git commit -m "test(memory): add integration tests for memory flow"
```

---

### Task 7.4: Update Module Exports

**Files:**
- Modify: `server/src/modules/memory/index.js`

**Step 1: Update exports**

```javascript
/**
 * Memory Management Module
 * Complete module exports
 */

import MemoryStore from './MemoryStore.js';
import MemoryExtractor from './MemoryExtractor.js';
import Compressor from './Compressor.js';
import Scheduler from './Scheduler.js';
import PendingTopicsManager from './PendingTopicsManager.js';
import ProactiveMessagingManager from './ProactiveMessagingManager.js';
import Indexer from './Indexer.js';

export {
  MemoryStore,
  MemoryExtractor,
  Compressor,
  Scheduler,
  PendingTopicsManager,
  ProactiveMessagingManager,
  Indexer
};

export default {
  MemoryStore,
  MemoryExtractor,
  Compressor,
  Scheduler,
  PendingTopicsManager,
  ProactiveMessagingManager,
  Indexer
};
```

**Step 2: Commit**

```bash
git add server/src/modules/memory/index.js
git commit -m "feat(memory): update module exports"
```

---

### Task 7.5: Final Integration Verification

**Step 1: Run all tests**

```bash
npm test -- --grep "memory"
```

**Step 2: Verify module imports**

```bash
node -e "import('./src/modules/memory/index.js').then(m => console.log(Object.keys(m)))"
```

**Step 3: Final commit**

```bash
git add .
git commit -m "feat(memory): complete personality-driven memory system"
```

---

## Phase 7 Complete

Phase 7 implements testing and final integration:

- ✅ MemoryStore unit tests
- ✅ Compressor unit tests
- ✅ Integration tests for memory flow
- ✅ Updated module exports
- ✅ Final verification steps

---

## Implementation Complete

### Summary

This implementation plan covers a complete personality-driven memory system with:

| Phase | Components | Tasks |
|-------|-----------|-------|
| 1 | Memory Storage Foundation | 5 |
| 2 | LLM Memory Extraction | 5 |
| 3 | Compression System | 5 |
| 4 | Vector Index Integration | 5 |
| 5 | Token Management | 5 |
| 6 | Pending Topics & Proactive | 5 |
| 7 | Testing & Integration | 5 |

**Total: 35 Tasks**

### Key Features

1. **Personality-Driven Memory**
   - Retention scores based on personality
   - Different users remember same conversation differently
   - Personality-driven forgetting

2. **Three-Stage Compression**
   - Day 0: Raw memory with LLM extraction
   - Day 3: Initial compression (30-50%)
   - Day 7: Core extraction with memory traces

3. **Bidirectional Storage**
   - Both participants store their own copy
   - Personality-filtered for each user
   - Support for users without role cards

4. **Real-Time Indexing**
   - Auto-index on conversation save
   - "Busy" status during indexing
   - Seamless continuation via RAG

5. **Token Management**
   - 60% warning, 70% termination
   - End intent detection
   - 30-minute timeout auto-save

6. **Proactive Messaging**
   - Personality-driven timing decisions
   - Natural message generation
   - Pending topic integration

### File Structure

```
server/src/modules/memory/
├── index.js
├── controller.js
├── route.js
├── MemoryStore.js
├── MemoryExtractor.js
├── Compressor.js
├── Scheduler.js
├── PendingTopicsManager.js
├── ProactiveMessagingManager.js
├── Indexer.js
└── prompts/
    ├── memoryExtraction.js
    ├── compressV1.js
    ├── compressV2.js
    └── proactiveMessage.js

server/src/modules/chat/
├── SessionManager.js
└── nodes/
    ├── tokenMonitor.js
    └── tokenResponse.js

server/tests/
├── unit/memory/
│   ├── MemoryStore.test.js
│   └── Compressor.test.js
└── integration/memory/
    └── memory-flow.test.js
```

---

## Execution Handoff

**Plan complete and saved to `docs/plans/2026-02-19-personality-driven-memory-system.md`.**

**Two execution options:**

**1. Subagent-Driven (this session)** - Dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans skill, batch execution with checkpoints

**Which approach?**

