/**
 * 向量索引服务
 * 管理向量索引的创建、更新和检索
 * 使用 ChromaDB 向量数据库
 *
 * @author AFS Team
 * @version 2.0.0
 */

import EmbeddingService from './embedding.js';
import ChromaDBService from './chroma.js';
import logger from '../utils/logger.js';

class VectorIndexService {
  constructor() {
    this.embeddingService = null;
    this.chromaService = null;
    this.collectionCache = new Map();
  }

  async initialize() {
    if (this.embeddingService && this.chromaService) return;

    try {
      logger.info('[VectorIndexService] 初始化向量存储 (ChromaDB)');

      this.embeddingService = new EmbeddingService();
      await this.embeddingService.initialize();

      this.chromaService = new ChromaDBService();
      await this.chromaService.initialize();

      logger.info('[VectorIndexService] 向量存储初始化成功');
    } catch (error) {
      this.embeddingService = null;
      this.chromaService = null;
      logger.error('[VectorIndexService] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * Validate userId for ChromaDB collection naming
   * @param {string} userId - User ID to validate
   */
  validateUserId(userId) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid userId: must be a non-empty string');
    }

    // ChromaDB collection names: 3-63 chars, start/end with alphanumeric, contain only alphanumeric, underscores, or hyphens
    const collectionName = `user_${userId}`;
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(userId)) {
      throw new Error('Invalid userId: contains invalid characters for ChromaDB collection names');
    }
    if (collectionName.length < 3 || collectionName.length > 63) {
      throw new Error('Invalid userId: collection name must be between 3-63 characters');
    }
  }

  /**
   * Get collection for user (using ChromaDB)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} ChromaDB Collection
   */
  async getCollection(userId) {
    this.validateUserId(userId);
    await this.initialize();

    const collectionName = `user_${userId}`;

    // Check cache first
    if (this.collectionCache.has(collectionName)) {
      return this.collectionCache.get(collectionName);
    }

    // Get or create collection from ChromaDB
    const collection = await this.chromaService.getCollection(collectionName, {
      type: 'user_memory',
      createdBy: 'VectorIndexService'
    });

    // Cache the collection reference
    this.collectionCache.set(collectionName, collection);
    return collection;
  }

  /**
   * Clear collection cache
   * @param {string|null} userId - User ID to clear, or null to clear all
   */
  clearCollectionCache(userId = null) {
    if (userId) {
      this.collectionCache.delete(`user_${userId}`);
    } else {
      this.collectionCache.clear();
    }
  }

  /**
   * Rebuild vector index for user
   * @param {string} userId - User ID
   * @param {Function} progressCallback - Optional progress callback
   * @returns {Promise<Object>} Rebuild result
   */
  async rebuildIndex(userId, progressCallback) {
    await this.initialize();

    const startTime = Date.now();
    const collectionName = `user_${userId}`;

    try {
      logger.info(`[VectorIndexService] 开始重建索引 - User: ${userId}`);

      // Delete existing collection and recreate
      await this.chromaService.deleteCollection(collectionName);
      this.collectionCache.delete(collectionName);

      // Get fresh collection
      const collection = await this.getCollection(userId);
      logger.info('[VectorIndexService] 旧索引已清空');

      // Load memories from file storage
      const FileStorage = (await import('./file.js')).default;
      const fileStorageInstance = new FileStorage();

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

      // Process in batches
      const batchSize = 50;
      let currentProcessed = 0;

      for (let i = 0; i < allMemories.length; i += batchSize) {
        const batch = allMemories.slice(i, i + batchSize);

        const batchIds = [];
        const batchDocuments = [];
        const batchMetadatas = [];

        for (const memory of batch) {
          const text = this.buildMemoryText(memory);
          const metadata = this.buildMetadata(memory);

          batchIds.push(memory.memoryId);
          batchDocuments.push(text);
          batchMetadatas.push(metadata);

          currentProcessed++;
        }

        logger.info(`[VectorIndexService] 添加批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(total / batchSize)}, ${currentProcessed}/${total} 个文档`);

        // ChromaDB will handle embeddings automatically if we don't provide them
        // But we want to use our own embedding service
        const embeddings = await this.embeddingService.embedDocuments(batchDocuments);

        await collection.add({
          ids: batchIds,
          embeddings: embeddings,
          documents: batchDocuments,
          metadatas: batchMetadatas
        });

        if (progressCallback) {
          progressCallback({
            current: Math.min(currentProcessed, total),
            total,
            message: `正在处理记忆 ${Math.min(currentProcessed, total)}/${total}...`
          });
        }
      }

      const duration = Date.now() - startTime;
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
   * Build searchable text from memory object
   * @param {Object} memory - Memory object
   * @returns {string} Searchable text
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
   * Build metadata from memory object
   * @param {Object} memory - Memory object
   * @returns {Object} Metadata object
   */
  buildMetadata(memory) {
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
   * Get collection statistics
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Stats object
   */
  async getStats(userId) {
    const collection = await this.getCollection(userId);
    const count = await collection.count();

    return {
      totalDocuments: count,
      collectionName: `user_${userId}`
    };
  }

  /**
   * Check if index exists for user
   * @param {string} userId - User ID
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

  /**
   * Search memories by query
   * @param {string} userId - User ID
   * @param {string} query - Search query
   * @param {number} topK - Number of results
   * @param {string|null} relationType - Filter by category (self/family/friend)
   * @param {string|null} relationSpecificId - Filter by helper ID
   * @returns {Promise<Array>} Search results
   */
  async search(userId, query, topK = 5, relationType = null, relationSpecificId = null) {
    await this.initialize();

    try {
      const collection = await this.getCollection(userId);

      const queryEmbedding = await this.embeddingService.embedQuery(query);

      let where = {};
      if (relationType) {
        where.category = relationType;
        if (relationSpecificId) {
          where.helperId = relationSpecificId;
        }
      }

      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK,
        where: Object.keys(where).length > 0 ? where : undefined
      });

      const memories = [];
      if (results && results.documents && results.documents[0]) {
        for (let i = 0; i < results.documents[0].length; i++) {
          memories.push({
            content: results.documents[0][i],
            relevanceScore: results.distances?.[0]?.[i] ?? 0,
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

  /**
   * Add a single memory to the index
   * @param {string} userId - User ID
   * @param {Object} memory - Memory object
   * @returns {Promise<void>}
   */
  async addMemory(userId, memory) {
    await this.initialize();

    const collection = await this.getCollection(userId);
    const text = this.buildMemoryText(memory);
    const embedding = await this.embeddingService.embedQuery(text);
    const metadata = this.buildMetadata(memory);

    await collection.add({
      ids: [memory.memoryId],
      embeddings: [embedding],
      documents: [text],
      metadatas: [metadata]
    });

    logger.info(`[VectorIndexService] 添加记忆 - User: ${userId}, MemoryId: ${memory.memoryId}`);
  }

  /**
   * Delete memories by filter
   * @param {string} userId - User ID
   * @param {Object} where - Filter conditions
   * @returns {Promise<void>}
   */
  async deleteMemory(userId, where = {}) {
    await this.initialize();

    const collection = await this.getCollection(userId);

    await collection.delete({
      where: Object.keys(where).length > 0 ? where : undefined
    });

    logger.info(`[VectorIndexService] 删除记忆 - User: ${userId}, Filter: ${JSON.stringify(where)}`);
  }

  /**
   * Update a memory in the index
   * @param {string} userId - User ID
   * @param {string} memoryId - Memory ID to update
   * @param {Object} memory - Updated memory object
   * @returns {Promise<void>}
   */
  async updateMemory(userId, memoryId, memory) {
    await this.initialize();

    const collection = await this.getCollection(userId);

    // Delete old entry
    await collection.delete({
      ids: [memoryId]
    });

    // Add updated entry
    const text = this.buildMemoryText(memory);
    const embedding = await this.embeddingService.embedQuery(text);
    const metadata = this.buildMetadata(memory);

    await collection.add({
      ids: [memoryId],
      embeddings: [embedding],
      documents: [text],
      metadatas: [metadata]
    });

    logger.info(`[VectorIndexService] 更新记忆 - User: ${userId}, MemoryId: ${memoryId}`);
  }

  /**
   * Health check for the service
   * @returns {Promise<Object>}
   */
  async healthCheck() {
    try {
      await this.initialize();

      const chromaHealth = await this.chromaService.healthCheck();
      const embeddingHealth = await this.embeddingService.healthCheck();

      return {
        status: chromaHealth && embeddingHealth ? 'healthy' : 'degraded',
        chromadb: chromaHealth ? 'connected' : 'disconnected',
        embedding: embeddingHealth ? 'available' : 'unavailable'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

export default VectorIndexService;
