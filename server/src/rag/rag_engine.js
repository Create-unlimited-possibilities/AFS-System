// RAG核心引擎 (JavaScript版本)
import VectorStore from './vector_store.js';
import EmbeddingManager from './embeddings.js';
import IndexManager from './indexer.js';

class RAGEngine {
  constructor() {
    this.vectorStore = new VectorStore();
    this.embeddingManager = new EmbeddingManager();
    this.indexManager = new IndexManager(this.vectorStore, this.embeddingManager);
    this.cache = new Map(); // 使用Map作为缓存
  }

  /**
   * 搜索与查询最相关的问答对
   * @param {string} queryText - 查询文本
   * @param {string} uniqueCode - 用户唯一编码
   * @param {number} topK - 返回前k个结果，默认为5
   * @param {number} similarityThreshold - 相似度阈值，默认为0.5
   * @returns {Promise<Array<Object>>} 匹配的问答对列表
   */
  async search(queryText, uniqueCode, topK = 5, similarityThreshold = 0.5) {
    try {
      // 检查缓存
      const cacheKey = `${uniqueCode}:${queryText}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      // 向量化查询文本
      const queryEmbedding = await this.embeddingManager.embedText(queryText);

      // 在指定用户的向量索引中搜索
      const results = await this.vectorStore.search(
        uniqueCode,  // collectionName
        queryEmbedding,
        topK
      );

      // 过滤低于相似度阈值的结果
      const filteredResults = results.filter(result => 
        (result.similarity !== undefined ? result.similarity : 1) >= similarityThreshold
      );

      // 缓存结果
      this.cache.set(cacheKey, filteredResults);

      return filteredResults;
    } catch (error) {
      console.error('RAG搜索出错:', error);
      return [];
    }
  }

  /**
   * 更新特定用户的索引
   * @param {string} uniqueCode - 用户唯一编码
   * @returns {Promise<boolean>} 是否成功更新
   */
  async update_user_index(uniqueCode) {
    try {
      const success = await this.indexManager.update_user_index(uniqueCode);
      // 清除相关缓存
      this._clear_cache_for_user(uniqueCode);
      return success;
    } catch (error) {
      console.error('更新用户索引出错:', error);
      return false;
    }
  }

  /**
   * 清除指定用户的缓存
   * @param {string} uniqueCode - 用户唯一编码
   * @private
   */
  _clear_cache_for_user(uniqueCode) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(uniqueCode)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 批量更新多个用户的索引
   * @param {Array<string>} uniqueCodes - 用户唯一编码列表
   * @returns {Promise<Object>} 每个用户索引更新结果的字典
   */
  async batch_update_indices(uniqueCodes) {
    const results = {};
    for (const code of uniqueCodes) {
      results[code] = await this.update_user_index(code);
    }
    return results;
  }
}

export default RAGEngine;