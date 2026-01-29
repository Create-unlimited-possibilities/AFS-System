// 文本分块器 (JavaScript版本)
import crypto from 'crypto';

class Chunker {
  constructor(maxChunkSize = 1000) {
    this.maxChunkSize = maxChunkSize;
  }

  /**
   * 从答案数据创建chunk
   * @param {Object} answerData - 答案数据字典
   * @returns {Object} chunk数据字典
   */
  create_chunk_from_answer(answerData) {
    // 构建chunk文本内容 - 结合问题和答案
    const questionText = answerData.question || '';
    const answerText = answerData.answer || '';
    const chunkText = `问题: ${questionText}\n答案: ${answerText}`;

    // 生成chunk ID
    let chunkId = answerData._id || answerData.id || '';
    if (!chunkId) {
      // 如果没有ID，则使用问题和答案的哈希值
      chunkId = this.generateHash(chunkText);
    }

    // 创建元数据
    const metadata = {
      question_id: answerData.questionId || '',
      question: questionText,
      answer: answerText,
      userId: answerData.userId || '',
      relationshipType: answerData.relationshipType || '',
      createdAt: answerData.createdAt || new Date().toISOString(),
      updatedAt: answerData.updatedAt || new Date().toISOString(),
      source: 'answer',
      chunk_type: 'qa_pair'
    };

    // 添加其他可能的字段
    for (const [key, value] of Object.entries(answerData)) {
      if (!['id', '_id', 'question', 'answer', 'questionId', 'userId', 
           'relationshipType', 'createdAt', 'updatedAt'].includes(key)) {
        metadata[key] = value;
      }
    }

    return {
      id: String(chunkId),
      text: chunkText,
      metadata: metadata,
      type: 'qa_pair'
    };
  }

  /**
   * 从答案列表创建多个chunks
   * @param {Array<Object>} answersList - 答案数据列表
   * @returns {Array<Object>} chunks列表
   */
  create_chunks_from_answers(answersList) {
    const chunks = [];
    for (const answer of answersList) {
      const chunk = this.create_chunk_from_answer(answer);
      chunks.push(chunk);
    }
    return chunks;
  }

  /**
   * 从问题-答案对直接创建chunk
   * @param {string} question - 问题文本
   * @param {string} answer - 答案文本
   * @param {Object} metadata - 额外的元数据
   * @returns {Object} chunk数据字典
   */
  create_chunk_from_qa_pair(question, answer, metadata = {}) {
    const chunkText = `问题: ${question}\n答案: ${answer}`;

    // 生成chunk ID
    const chunkId = this.generateHash(chunkText);

    // 合并元数据
    const mergedMetadata = {
      question: question,
      answer: answer,
      source: 'qa_pair',
      chunk_type: 'qa_pair',
      ...metadata
    };

    return {
      id: chunkId,
      text: chunkText,
      metadata: mergedMetadata,
      type: 'qa_pair'
    };
  }

  /**
   * 将大文本分割成较小的块
   * @param {string} text - 要分割的文本
   * @param {number} maxChunkSize - 最大块大小，默认使用实例设置
   * @returns {Array<string>} 文本块列表
   */
  splitLargeText(text, maxChunkSize = null) {
    const size = maxChunkSize || this.maxChunkSize;

    if (text.length <= size) {
      return [text];
    }

    // 按句子分割
    const sentences = this._split_by_sentences(text);
    const chunks = [];
    let currentChunk = "";

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= size) {
        currentChunk += sentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * 按句子分割文本
   * @param {string} text - 输入文本
   * @returns {Array<string>} 句子列表
   */
  _split_by_sentences(text) {
    // 匹配中文句号、英文句号、感叹号、问号等作为句子结束符
    const sentences = text.split(/([。！？!?]+)/);

    // 重新组合句子（将标点符号加回到句子末尾）
    const combinedSentences = [];
    for (let i = 0; i < sentences.length - 1; i += 2) {
      let sentence = sentences[i];
      if (i + 1 < sentences.length) {
        sentence += sentences[i + 1];
      }
      combinedSentences.push(sentence);
    }

    // 过滤掉空字符串
    return combinedSentences.filter(s => s.trim());
  }

  /**
   * 序列化chunk为JSON字符串
   * @param {Object} chunk - chunk数据字典
   * @returns {string} JSON字符串
   */
  serialize_chunk(chunk) {
    return JSON.stringify(chunk);
  }

  /**
   * 反序列化JSON字符串为chunk
   * @param {string} chunkStr - JSON字符串
   * @returns {Object} chunk数据字典
   */
  deserialize_chunk(chunkStr) {
    return JSON.parse(chunkStr);
  }

  /**
   * 验证chunk格式是否正确
   * @param {Object} chunk - chunk数据字典
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
      console.warn("Chunk元数据必须是字典类型");
      return false;
    }

    if (chunk.type !== 'qa_pair') {
      console.warn("Chunk类型必须是qa_pair");
      return false;
    }

    return true;
  }

  /**
   * 生成哈希值
   * @param {string} text - 输入文本
   * @returns {string} 哈希值
   */
  generateHash(text) {
    return crypto.createHash('md5').update(text).digest('hex');
  }
}

export default Chunker;