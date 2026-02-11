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
    this.collections = new Map();
  }

  /**
   * 初始化ChromaDB客户端和embeddings
   * @throws {Error} If OPENAI_API_KEY is not set or initialization fails
   */
  async initialize() {
    if (this.client) return;

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    try {
      this.client = new ChromaClient({
        path: process.env.STORAGE_PATH || '/app/storage/userdata/chroma_db'
      });

      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: 'text-embedding-3-small'
      });

      logger.info('[VectorIndexService] ChromaDB客户端初始化成功');
    } catch (error) {
      this.client = null;
      this.embeddings = null;
      logger.error('[VectorIndexService] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取或创建用户collection
   * @param {string} userId - 用户ID
   * @returns {Promise<Collection>} ChromaDB collection
   * @throws {Error} If userId is invalid or initialization fails
   */
  async getCollection(userId) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid userId: must be a non-empty string');
    }

    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(userId)) {
      throw new Error('Invalid userId: contains invalid characters for ChromaDB collection names');
    }

    await this.initialize();

    const collectionName = `user_${userId}`;

    if (this.collections.has(collectionName)) {
      return this.collections.get(collectionName);
    }

    try {
      const collection = await this.client.getCollection({ name: collectionName });
      this.collections.set(collectionName, collection);
      return collection;
    } catch (error) {
      const errorMessage = error?.message || String(error);
      const collectionNotFoundPatterns = [
        'does not exist',
        'not found',
        'not exist',
        'NotFoundError',
        '404'
      ];

      const isCollectionNotFound = collectionNotFoundPatterns.some(pattern =>
        errorMessage.toLowerCase().includes(pattern.toLowerCase())
      );

      if (isCollectionNotFound) {
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

  /**
   * 清理collection缓存
   * @param {string|null} userId - 可选，指定要清理的用户ID。如果为null，则清理所有缓存
   */
  clearCollectionCache(userId = null) {
    if (userId) {
      this.collections.delete(`user_${userId}`);
    } else {
      this.collections.clear();
    }
  }

  async rebuildIndex(userId, progressCallback) {
    await this.initialize();

    const startTime = Date.now();
    const collection = await this.getCollection(userId);

    try {
      logger.info(`[VectorIndexService] 开始重建索引 - User: ${userId}`);

      await collection.delete({ where: {} });
      logger.info('[VectorIndexService] 旧索引已清空');

      const FileStorage = (await import('./fileStorage.js')).default;
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

      const batchSize = 50;
      const processedMemories = [];

      for (let i = 0; i < allMemories.length; i += batchSize) {
        const batch = allMemories.slice(i, i + batchSize);

        for (const memory of batch) {
          const text = this.buildMemoryText(memory);

          const embedding = await this.embeddings.embedQuery(text);

          const metadata = this.buildMetadata(memory);

          processedMemories.push({
            id: memory.memoryId,
            embedding,
            document: text,
            metadata
          });

          const current = processedMemories.length + (i);
          if (progressCallback) {
            progressCallback({
              current: Math.min(current, total),
              total,
              message: `正在处理记忆 ${Math.min(current, total)}/${total}...`
            });
          }
        }

        if (processedMemories.length > 0) {
          await this.batchInsert(collection, processedMemories);
          processedMemories.length = 0;
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

  async getStats(userId) {
    const collection = await this.getCollection(userId);
    const result = await collection.count();

    return {
      totalDocuments: result,
      collectionName: `user_${userId}`
    };
  }

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

  async search(userId, query, topK = 5, relationType = null, relationSpecificId = null) {
    await this.initialize();

    try {
      const collection = await this.getCollection(userId);

      const queryEmbedding = await this.embeddings.embedQuery(query);

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
}

export default VectorIndexService;

