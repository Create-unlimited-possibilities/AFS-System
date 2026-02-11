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
   */
  async initialize() {
    if (this.client) return;

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

    if (this.collections.has(collectionName)) {
      return this.collections.get(collectionName);
    }

    try {
      const collection = await this.client.getCollection({ name: collectionName });
      this.collections.set(collectionName, collection);
      return collection;
    } catch (error) {
      if (error.message?.includes('does not exist')) {
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