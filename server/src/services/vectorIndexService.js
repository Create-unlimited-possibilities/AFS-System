/**
 * 向量索引服务
 * 管理向量索引的创建、更新和检索
 * 使用内存向量存储
 *
 * @author AFS Team
 * @version 1.3.0
 */

import EmbeddingService from './EmbeddingService.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

class VectorIndexService {
  constructor() {
    this.embeddingService = null;
    this.collections = new Map();
    this.storagePath = process.env.STORAGE_PATH || path.join(process.cwd(), 'storage', 'vector_index');
    
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  async initialize() {
    if (this.embeddingService) return;

    try {
      logger.info(`[VectorIndexService] 初始化向量存储, Storage: ${this.storagePath}`);
      
      this.embeddingService = new EmbeddingService();
      await this.embeddingService.initialize();

      await this.loadSavedIndexes();

      logger.info('[VectorIndexService] 向量存储初始化成功');
    } catch (error) {
      this.embeddingService = null;
      logger.error('[VectorIndexService] 初始化失败:', error);
      throw error;
    }
  }

  getCollectionPath(collectionName) {
    return path.join(this.storagePath, `${collectionName}.json`);
  }

  async loadSavedIndexes() {
    try {
      const files = fs.readdirSync(this.storagePath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const collectionName = file.replace('.json', '');
          const filePath = this.getCollectionPath(collectionName);
          
          try {
            const data = fs.readFileSync(filePath, 'utf8');
            const collection = JSON.parse(data);
            
            if (collection && Array.isArray(collection.documents)) {
              this.collections.set(collectionName, collection);
              logger.info(`[VectorIndexService] 加载collection: ${collectionName}, 文档数: ${collection.documents.length}`);
            }
          } catch (parseError) {
            logger.warn(`[VectorIndexService] 解析collection文件失败 ${file}:`, parseError.message);
          }
        }
      }
    } catch (error) {
      logger.warn('[VectorIndexService] 加载索引失败:', error.message);
    }
  }

  saveCollection(collection) {
    try {
      const filePath = this.getCollectionPath(collection.name);
      const data = JSON.stringify(collection, null, 2);
      fs.writeFileSync(filePath, data, 'utf8');
      logger.debug(`[VectorIndexService] 保存collection ${collection.name}, 文档数: ${collection.documents.length}`);
    } catch (error) {
      logger.error(`[VectorIndexService] 保存collection失败 ${collection.name}:`, error);
      throw error;
    }
  }

  async getCollection(userId) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid userId: must be a non-empty string');
    }

    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(userId)) {
      throw new Error('Invalid userId: contains invalid characters for collection names');
    }

    const collectionName = `user_${userId}`;

    if (this.collections.has(collectionName)) {
      return this.collections.get(collectionName);
    }

    const collection = {
      name: collectionName,
      documents: [],
      embeddings: [],
      metadatas: [],
      
      add: async ({ ids, embeddings, documents, metadatas }) => {
        logger.info(`[VectorIndexService] [${collection.name}] 添加 ${ids.length} 个文档`);
        
        if (!Array.isArray(collection.documents) || !Array.isArray(collection.embeddings) || !Array.isArray(collection.metadatas)) {
          logger.error(`[VectorIndexService] collection数组结构异常: ${collection.name}`);
          collection.documents = [];
          collection.embeddings = [];
          collection.metadatas = [];
        }
        
        for (let i = 0; i < ids.length; i++) {
          collection.documents.push({
            id: ids[i],
            text: documents[i]
          });
          collection.embeddings.push(embeddings[i]);
          collection.metadatas.push(metadatas[i]);
        }
        
        this.saveCollection(collection);
      },
      
      get: async ({ ids, where, limit }) => {
        if (!Array.isArray(collection.documents)) {
          logger.error(`[VectorIndexService] get: documents不是数组`);
          return [];
        }
        
        let results = [];
        
        for (let i = 0; i < collection.documents.length; i++) {
          const doc = collection.documents[i];
          const embedding = collection.embeddings[i];
          const metadata = collection.metadatas[i];
          
          if (!doc || !embedding || !metadata) continue;
          
          results.push({
            id: doc.id,
            document: doc.text,
            embedding: embedding,
            metadata: metadata
          });
        }
        
        if (ids && ids.length > 0) {
          const idSet = new Set(ids);
          results = results.filter(r => idSet.has(r.id));
        }
        
        if (where && Object.keys(where).length > 0) {
          for (const key in where) {
            results = results.filter(r => r.metadata && r.metadata[key] === where[key]);
          }
        }
        
        if (limit && limit > 0 && results.length > limit) {
          results = results.slice(0, limit);
        }
        
        return results;
      },
      
      query: async ({ queryEmbeddings, nResults, where }) => {
        if (!Array.isArray(collection.documents) || collection.documents.length === 0) {
          return { results: [[]], distances: [[]] };
        }
        
        let candidates = [];
        for (let i = 0; i < collection.documents.length; i++) {
          const doc = collection.documents[i];
          const embedding = collection.embeddings[i];
          const metadata = collection.metadatas[i];
          
          if (!doc || !embedding || !metadata) continue;
          
          candidates.push({
            document: doc.text,
            embedding: embedding,
            metadata: metadata
          });
        }
        
        if (where && Object.keys(where).length > 0) {
          for (const key in where) {
            candidates = candidates.filter(r => r.metadata && r.metadata[key] === where[key]);
          }
        }
        
        const results = [];
        const distances = [];
        
        for (const queryEmbedding of queryEmbeddings) {
          const docResults = [];
          const docDistances = [];
          
          for (const candidate of candidates) {
            const similarity = this.cosineSimilarity(queryEmbedding, candidate.embedding);
            docResults.push({
              document: candidate.document,
              embedding: candidate.embedding,
              metadata: candidate.metadata
            });
            docDistances.push(1 - similarity);
          }
          
          const sortedIndices = docDistances
            .map((dist, idx) => ({ dist, idx }))
            .sort((a, b) => a.dist - b.dist)
            .slice(0, nResults)
            .map(item => item.idx);
          
          const topResults = sortedIndices.map(idx => docResults[idx]);
          
          results.push(topResults);
          distances.push(sortedIndices.map(idx => docDistances[idx]));
        }
        
        return { results, distances };
      },
      
      count: async () => {
        return Array.isArray(collection.documents) ? collection.documents.length : 0;
      },
      
      delete: async ({ where }) => {
        if (!Array.isArray(collection.documents)) {
          logger.error(`[VectorIndexService] delete: documents不是数组`);
          collection.documents = [];
          collection.embeddings = [];
          collection.metadatas = [];
          this.saveCollection(collection);
          return;
        }
        
        if (where && Object.keys(where).length > 0) {
          const indicesToDelete = [];
          
          for (let i = 0; i < collection.documents.length; i++) {
            const metadata = collection.metadatas[i];
            
            if (!metadata) continue;
            
            let matches = true;
            for (const key in where) {
              if (!metadata[key] || metadata[key] !== where[key]) {
                matches = false;
                break;
              }
            }
            
            if (matches) {
              indicesToDelete.push(i);
            }
          }
          
          indicesToDelete.sort((a, b) => b - a);
          
          const newDocs = [];
          const newEmbeddings = [];
          const newMetadatas = [];
          
          for (let i = 0; i < collection.documents.length; i++) {
            if (!indicesToDelete.includes(i)) {
              newDocs.push(collection.documents[i]);
              newEmbeddings.push(collection.embeddings[i]);
              newMetadatas.push(collection.metadatas[i]);
            }
          }
          
          collection.documents = newDocs;
          collection.embeddings = newEmbeddings;
          collection.metadatas = newMetadatas;
        } else {
          collection.documents = [];
          collection.embeddings = [];
          collection.metadatas = [];
        }
        
        this.saveCollection(collection);
      }
    };

    this.collections.set(collectionName, collection);
    return collection;
  }

  cosineSimilarity(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length === 0 || vec2.length === 0) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  clearCollectionCache(userId = null) {
    if (this.collections.has(`user_${userId}`)) {
      this.collections.delete(`user_${userId}`);
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
      let currentProcessed = 0;

      for (let i = 0; i < allMemories.length; i += batchSize) {
        const batch = allMemories.slice(i, i + batchSize);

        const batchIds = [];
        const batchEmbeddings = [];
        const batchDocuments = [];
        const batchMetadatas = [];

        for (const memory of batch) {
          const text = this.buildMemoryText(memory);
          const embedding = await this.embeddingService.embedQuery(text);
          const metadata = this.buildMetadata(memory);

          batchIds.push(memory.memoryId);
          batchEmbeddings.push(embedding);
          batchDocuments.push(text);
          batchMetadatas.push(metadata);

          currentProcessed++;
        }

        logger.info(`[VectorIndexService] 添加批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(total / batchSize)}, ${currentProcessed}/${total} 个文档`);

        await collection.add({
          ids: batchIds,
          embeddings: batchEmbeddings,
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

  async getStats(userId) {
    const collection = await this.getCollection(userId);
    const count = await collection.count();

    return {
      totalDocuments: count,
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

      const queryEmbedding = await this.embeddingService.embedQuery(query);

      let where = {};
      if (relationType) {
        where.category = relationType;
        if (relationSpecificId) {
          where.helperId = relationSpecificId;
        }
      }

      const { results, distances } = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK,
        where: Object.keys(where).length > 0 ? where : undefined
      });

      const memories = [];
      if (results && results[0]) {
        for (let i = 0; i < results[0].length; i++) {
          const result = results[0][i];
          memories.push({
            content: result.document,
            relevanceScore: distances[0]?.[i] || 0,
            category: result.metadata?.category || 'self',
            metadata: result.metadata || {}
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
