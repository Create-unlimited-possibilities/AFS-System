// 索引管理器 (JavaScript版本)
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class IndexManager {
  constructor(vectorStore, embeddingManager) {
    this.vectorStore = vectorStore;
    this.embeddingManager = embeddingManager;
    this.trainingDataDir = "./training-data"; // 默认训练数据目录
 }

  /**
   * 更新特定用户的索引
   * @param {string} uniqueCode - 用户唯一编码
   * @returns {Promise<boolean>} 是否成功更新
   */
  async update_user_index(uniqueCode) {
    try {
      const jsonlPath = path.join(this.trainingDataDir, `${uniqueCode}.jsonl`);

      if (!(await this.fileExists(jsonlPath))) {
        console.warn(`JSONL文件不存在: ${jsonlPath}`);
        // 创建一个空的集合，以便后续可以添加数据
        await this.vectorStore.getCollection(uniqueCode);
        return true;
      }

      // 读取JSONL文件并解析数据
      const chunks = await this._load_jsonl_file(jsonlPath);

      if (!chunks || chunks.length === 0) {
        console.info(`JSONL文件为空: ${jsonlPath}`);
        return true;
      }

      // 批量处理chunks并添加到向量数据库
      const success = await this._process_and_add_chunks(chunks, uniqueCode);

      if (success) {
        console.log(`用户 ${uniqueCode} 的索引更新成功，共处理 ${chunks.length} 个chunks`);
      } else {
        console.error(`用户 ${uniqueCode} 的索引更新失败`);
      }

      return success;
    } catch (error) {
      console.error(`更新用户索引出错 (${uniqueCode}):`, error);
      return false;
    }
  }

  /**
   * 检查文件是否存在
   * @param {string} filePath - 文件路径
   * @returns {Promise<boolean>} 文件是否存在
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 从JSONL文件加载数据
   * @param {string} filePath - JSONL文件路径
   * @returns {Promise<Array<Object>>} 解析后的数据列表
   */
  async _load_jsonl_file(filePath) {
    const chunks = [];
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.trim() !== '');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          const data = JSON.parse(line);
          // 将数据转换为chunk格式
          const chunk = {
            id: data.metadata?.questionId || this.generateId(data.text || data.question),
            text: data.text || `问题: ${data.question}\n答案: ${data.answer}`,
            metadata: data.metadata || {
              question: data.question,
              answer: data.answer,
              source: 'jsonl_line',
              timestamp: new Date().toISOString()
            },
            type: 'qa_pair'
          };
          chunks.push(chunk);
        } catch (e) {
          console.warn(`JSON解析错误 (行 ${i + 1}):`, e.message);
        }
      }
    } catch (error) {
      console.error(`读取文件出错 ${filePath}:`, error);
    }

    return chunks;
  }

  /**
   * 生成ID
   * @param {string} text - 输入文本
   * @returns {string} 生成的ID
   */
  generateId(text) {
    // 简单的ID生成方法，实际应用中可能需要更复杂的逻辑
    const crypto = require('crypto');
    return crypto.createHash('md5').update(text).digest('hex');
  }

  /**
   * 处理并添加chunks到向量数据库
   * @param {Array<Object>} chunks - chunks列表
   * @param {string} collectionName - 集合名称
   * @returns {Promise<boolean>} 是否成功处理
   */
  async _process_and_add_chunks(chunks, collectionName) {
    try {
      // 提取文档、元数据和ID
      const documents = [];
      const metadatas = [];
      const ids = [];

      for (const chunk of chunks) {
        documents.push(chunk.text);
        metadatas.push(chunk.metadata);
        ids.push(chunk.id);
      }

      // 批量添加到向量数据库
      const success = await this.vectorStore.addVectors(
        collectionName,
        documents,
        metadatas,
        ids
      );

      return success;
    } catch (error) {
      console.error(`处理chunks并添加到集合 ${collectionName} 出错:`, error);
      return false;
    }
  }

  /**
   * 重建所有用户的索引
   * @param {Array<string>} uniqueCodes - 用户唯一编码列表
   * @returns {Promise<Object>} 每个用户索引重建结果的字典
   */
  async rebuild_all_indices(uniqueCodes) {
    const results = {};
    for (const code of uniqueCodes) {
      results[code] = await this.update_user_index(code);
    }
    return results;
  }

  /**
   * 更新单个chunk（增量更新）
   * @param {string} uniqueCode - 用户唯一编码
   * @param {Object} chunkData - chunk数据
   * @returns {Promise<boolean>} 是否成功更新
   */
  async update_single_chunk(uniqueCode, chunkData) {
    try {
      // 验证chunk格式
      if (!this.validate_chunk(chunkData)) {
        console.error("传入的chunk数据格式无效");
        return false;
      }

      // 向量化文档
      const document = chunkData.text;
      const metadata = chunkData.metadata;
      const chunkId = chunkData.id;

      // 更新向量数据库中的单个向量
      const success = await this.vectorStore.updateVectors(
        uniqueCode,
        [document],
        [metadata],
        [chunkId]
      );

      return success;
    } catch (error) {
      console.error("更新单个chunk出错:", error);
      return false;
    }
  }

  /**
   * 删除指定的chunk
   * @param {string} uniqueCode - 用户唯一编码
   * @param {string} chunkId - chunk的ID
   * @returns {Promise<boolean>} 是否成功删除
   */
  async delete_chunk(uniqueCode, chunkId) {
    try {
      const success = await this.vectorStore.deleteVectors(
        uniqueCode,
        [chunkId]
      );
      return success;
    } catch (error) {
      console.error("删除chunk出错:", error);
      return false;
    }
  }

  /**
   * 获取索引统计信息
   * @param {string} uniqueCode - 用户唯一编码
   * @returns {Promise<Object>} 统计信息字典
   */
  async get_index_stats(uniqueCode) {
    try {
      const count = await this.vectorStore.getCollectionCount(uniqueCode);
      return {
        collection_name: uniqueCode,
        vector_count: count,
        status: count >= 0 ? 'ready' : 'error'
      };
    } catch (error) {
      console.error("获取索引统计信息出错:", error);
      return {
        collection_name: uniqueCode,
        vector_count: 0,
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * 验证chunk格式
   * @param {Object} chunk - chunk数据
   * @returns {boolean} 是否有效
   */
  validate_chunk(chunk) {
    const requiredFields = ['id', 'text', 'metadata', 'type'];
    for (const field of requiredFields) {
      if (!(field in chunk)) {
        console.warn(`Chunk缺少必需字段: ${field}`);
        return false;
      }
    }

    if (typeof chunk.id !== 'string' || !chunk.id.trim()) {
      console.warn("Chunk ID无效");
      return false;
    }

    if (typeof chunk.text !== 'string' || !chunk.text.trim()) {
      console.warn("Chunk文本无效");
      return false;
    }

    if (typeof chunk.metadata !== 'object') {
      console.warn("Chunk元数据必须是对象类型");
      return false;
    }

    if (chunk.type !== 'qa_pair') {
      console.warn("Chunk类型必须是qa_pair");
      return false;
    }

    return true;
  }

  /**
   * 设置训练数据目录
   * @param {string} dirPath - 目录路径
   */
  set_training_data_dir(dirPath) {
    this.trainingDataDir = dirPath;
  }
}

export default IndexManager;