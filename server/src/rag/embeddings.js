// 嵌入管理器 (JavaScript版本)
import axios from 'axios';

class EmbeddingManager {
  constructor(modelName = 'multilingual-e5-large') {
    this.modelName = modelName;
    this.apiBaseURL = process.env.EMBEDDING_API_URL || 'http://modelserver:5000'; // 默认连接到模型服务器
    this.cache = new Map(); // 简单的嵌入缓存
  }

  /**
   * 获取文本的嵌入向量
   * @param {string} text - 输入文本
   * @returns {Promise<Array<number>>} 嵌入向量
   */
  async embedText(text) {
    const cacheKey = `${text}_${this.modelName}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // 调用模型服务器的嵌入API
      const response = await axios.post(`${this.apiBaseURL}/embeddings`, {
        input: text,
        model: this.modelName
      });

      const embedding = response.data.embedding;
      
      // 存入缓存
      this.cache.set(cacheKey, embedding);
      
      return embedding;
    } catch (error) {
      console.error('获取文本嵌入失败:', error);
      // 返回零向量作为默认值
      return Array(768).fill(0.0); // 假设模型输出768维向量
    }
  }

  /**
   * 批量获取文本的嵌入向量
   * @param {Array<string>} texts - 输入文本数组
   * @returns {Promise<Array<Array<number>>>} 嵌入向量数组
   */
  async embedTexts(texts) {
    const embeddings = [];
    for (const text of texts) {
      const embedding = await this.embedText(text);
      embeddings.push(embedding);
    }
    return embeddings;
  }

  /**
   * 计算两个向量之间的余弦相似度
   * @param {Array<number>} vec1 - 第一个向量
   * @param {Array<number>} vec2 - 第二个向量
   * @returns {number} 相似度分数 (0-1之间)
   */
  cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) {
      throw new Error('向量维度不匹配');
    }

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      magnitude1 += vec1[i] * vec1[i];
      magnitude2 += vec2[i] * vec2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0; // 如果任意向量为零向量，则相似度为0
    }

    // 计算余弦相似度
    const cosineSim = dotProduct / (magnitude1 * magnitude2);

    // 确保相似度在[0,1]范围内（由于浮点精度可能导致略大于1或小于-1）
    return Math.max(0, Math.min(1, (cosineSim + 1) / 2));
  }
}

export default EmbeddingManager;