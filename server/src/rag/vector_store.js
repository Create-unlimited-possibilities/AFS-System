// 向量存储管理 (JavaScript版本)
import { v4 as uuidv4 } from 'uuid';
import chroma from 'chromadb';

class VectorStore {
  constructor(persistDirectory = "./vector_db") {
    // 初始化ChromaDB客户端
    this.client = new chroma.ChromaClient({
      path: persistDirectory
    });
    this.collections = new Map(); // 使用Map存储集合引用
  }

 /**
   * 获取或创建集合
   * @param {string} collectionName - 集合名称
   * @returns {Object} 集合对象
   */
  async getCollection(collectionName) {
    if (!this.collections.has(collectionName)) {
      try {
        // 尝试获取已存在的集合
        const collection = await this.client.getCollection({
          name: collectionName
        });
        this.collections.set(collectionName, collection);
      } catch (error) {
        // 如果集合不存在，则创建新集合
        const collection = await this.client.createCollection({
          name: collectionName,
          metadata: { "hnsw:space": "cosine" }  // 使用余弦距离
        });
        this.collections.set(collectionName, collection);
      }
    }
    return this.collections.get(collectionName);
  }

  /**
   * 添加向量到指定集合
   * @param {string} collectionName - 集合名称
   * @param {Array<string>} documents - 文档列表
   * @param {Array<Object>} metadatas - 元数据列表
   * @param {Array<string>} ids - ID列表
   * @returns {Promise<boolean>} 是否成功添加
   */
  async addVectors(collectionName, documents, metadatas, ids) {
    try {
      const collection = await this.getCollection(collectionName);
      await collection.add({
        documents,
        metadatas,
        ids
      });
      return true;
    } catch (error) {
      console.error(`添加向量到集合 ${collectionName} 出错:`, error);
      return false;
    }
  }

  /**
   * 在指定集合中搜索相似向量
   * @param {string} collectionName - 集合名称
   * @param {Array<number>} queryEmbedding - 查询向量
   * @param {number} topK - 返回前k个结果
   * @returns {Promise<Array<Object>>} 搜索结果列表
   */
  async search(collectionName, queryEmbedding, topK = 5) {
    try {
      const collection = await this.getCollection(collectionName);
      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK
      });

      // 格式化结果
      const formattedResults = [];
      if (results.documents && results.documents[0]) {
        for (let i = 0; i < results.documents[0].length; i++) {
          const result = {
            document: results.documents[0][i],
            metadata: results.metadatas[0] ? results.metadatas[0][i] : {},
            id: results.ids[0] ? results.ids[0][i] : null,
            distance: results.distances && results.distances[0] ? results.distances[0][i] : null
          };
          
          // 计算相似度（如果距离存在）
          if (result.distance !== undefined && result.distance !== null) {
            // 将距离转换为相似度（余弦距离转换为相似度）
            const similarity = 1 - result.distance;
            result.similarity = Math.max(0, Math.min(1, similarity)); // 限制在[0,1]范围内
          }
          
          formattedResults.push(result);
        }
      }

      return formattedResults;
    } catch (error) {
      console.error(`搜索集合 ${collectionName} 出错:`, error);
      return [];
    }
  }

  /**
   * 更新向量（实际上是删除旧向量并添加新向量）
   * @param {string} collectionName - 集合名称
   * @param {Array<string>} documents - 文档列表
   * @param {Array<Object>} metadatas - 元数据列表
   * @param {Array<string>} ids - ID列表
   * @returns {Promise<boolean>} 是否成功更新
   */
  async updateVectors(collectionName, documents, metadatas, ids) {
    try {
      const collection = await this.getCollection(collectionName);
      await collection.upsert({
        documents,
        metadatas,
        ids
      });
      return true;
    } catch (error) {
      console.error(`更新集合 ${collectionName} 的向量出错:`, error);
      return false;
    }
  }

  /**
   * 删除指定ID的向量
   * @param {string} collectionName - 集合名称
   * @param {Array<string>} ids - 要删除的向量ID列表
   * @returns {Promise<boolean>} 是否成功删除
   */
  async deleteVectors(collectionName, ids) {
    try {
      const collection = await this.getCollection(collectionName);
      await collection.delete({ ids });
      return true;
    } catch (error) {
      console.error(`删除集合 ${collectionName} 的向量出错:`, error);
      return false;
    }
  }

  /**
   * 获取集合中的向量数量
   * @param {string} collectionName - 集合名称
   * @returns {Promise<number>} 向量数量
   */
  async getCollectionCount(collectionName) {
    try {
      const collection = await this.getCollection(collectionName);
      return await collection.count();
    } catch (error) {
      console.error(`获取集合 ${collectionName} 数量出错:`, error);
      return 0;
    }
  }

  /**
   * 删除整个集合
   * @param {string} collectionName - 集合名称
   * @returns {Promise<boolean>} 是否成功删除
   */
  async deleteCollection(collectionName) {
    try {
      await this.client.deleteCollection({ name: collectionName });
      this.collections.delete(collectionName);
      return true;
    } catch (error) {
      console.error(`删除集合 ${collectionName} 出错:`, error);
      return false;
    }
  }
}

export default VectorStore;