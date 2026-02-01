// 向量索引服务 - 使用 ChromaDB 进行向量存储
import { ChromaClient, DefaultEmbeddingFunction } from 'chromadb';
import fs from 'fs/promises';
import path from 'path';

export default class VectorIndexService {
  constructor() {
    this.chroma = null;
    this.embeddings = null;
    this.basePath = path.join(process.cwd(), 'userdata');
  }

  async initialize() {
    try {
      // 初始化 ChromaDB 客户端（本地模式）
      this.chroma = new ChromaClient({
        path: path.join(this.basePath, 'chroma_db')
      });
      
      // 初始化嵌入函数（使用 API 或本地模型）
      this.embeddings = new DefaultEmbeddingFunction();
      
    } catch (err) {
      console.warn('ChromaDB 初始化失败，将使用内存模式:', err.message);
      // 使用内存模式作为降级方案
      this.chroma = new ChromaClient();
      this.embeddings = new DefaultEmbeddingFunction();
    }
  }

  async buildIndex(userId, memories) {
    await this.initialize();

    const collectionName = `user_${userId}`;
    
    try {
      // 检查集合是否存在
      const existingCollection = await this.chroma.getCollection({ name: collectionName });
      await this.chroma.deleteCollection({ name: collectionName });
    } catch (err) {
      // 集合不存在，忽略错误
    }

    // 创建新集合
    const collection = await this.chroma.getOrCreateCollection({
      name: collectionName,
      metadata: { hnsw_space: 'cosine' }
    });

    // 准备数据
    const ids = [];
    const documents = [];
    const metadatas = [];

    memories.forEach((memory, index) => {
      ids.push(`memory_${index}`);
      documents.push(`${memory.question} ${memory.answer}`);
      metadatas.push({
        memoryId: memory.memoryId,
        questionRole: memory.questionRole,
        questionLayer: memory.questionLayer,
        importance: memory.importance,
        tags: memory.tags.join(','),
        source: 'questionnaire'
      });
    });

    // 批量添加
    await collection.add({
      ids,
      documents,
      metadatas
    });

    return { success: true, message: '索引构建完成' };
  }

  async search(userId, query, topK = 5) {
    await this.initialize();

    try {
      const collection = await this.chroma.getCollection({ name: `user_${userId}` });
      
      const results = await collection.query({
        queryTexts: [query],
        nResults: topK
      });

      // 格式化结果
      const formattedResults = results.ids[0].map((id, index) => ({
        memoryId: id,
        content: results.documents[0][index],
        similarity: 1.0 - (results.distances?.[0]?.[index] || 0),
        metadata: results.metadatas?.[0]?.[index] || {}
      }));

      return {
        success: true,
        results: formattedResults
      };

    } catch (err) {
      console.error('向量检索失败:', err);
      return {
        success: false,
        results: []
      };
    }
  }

  async addToIndex(userId, memory) {
    await this.initialize();

    try {
      const collection = await this.chroma.getOrCreateCollection({
        name: `user_${userId}`,
        metadata: { hnsw_space: 'cosine' }
      });

      await collection.add({
        ids: [memory.memoryId],
        documents: [`${memory.question} ${memory.answer}`],
        metadatas: [{
          memoryId: memory.memoryId,
          questionRole: memory.questionRole,
          questionLayer: memory.questionLayer,
          importance: memory.importance,
          tags: memory.tags.join(','),
          source: 'questionnaire'
        }]
      });

      return { success: true };
    } catch (err) {
      console.error('添加到索引失败:', err);
      return { success: false, error: err.message };
    }
  }

  async rebuildIndex(userId) {
    const memoryLoader = (await import('./memoryLoader.js')).default;
    const loader = new memoryLoader();
    const memories = await loader.loadUserMemories(userId);
    
    const allMemories = [
      ...memories.A_set,
      ...memories.B_sets,
      ...memories.C_sets
    ];

    return await this.buildIndex(userId, allMemories);
  }
}