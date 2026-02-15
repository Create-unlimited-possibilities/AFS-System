/**
 * Token 计数器
 * 使用 tiktoken (OpenAI BPE) 进行准确的 token 计算
 *
 * @author AFS Team
 * @version 2.0.0
 */

import { encoding_for_model } from 'tiktoken';

class TokenCounter {
  constructor() {
    // 使用 GPT-3.5-Turbo / GPT-4 的编码器
    this.encoding = encoding_for_model('gpt-3.5-turbo');
  }

  /**
   * 计算单个文本的 token 数量
   * @param {string} text - 输入文本
   * @returns {number} token 数量
   */
  countTokens(text) {
    if (!text || typeof text !== 'string') {
      return 0;
    }

    try {
      const tokens = this.encoding.encode(text);
      return tokens.length;
    } catch (error) {
      console.error('[TokenCounter] Token counting error:', error);
      return 0;
    }
  }

  /**
   * 计算多个文本的总 token 数量
   * @param {Array<string>} texts - 文本数组
   * @returns {number} 总 token 数量
   */
  countTokensBatch(texts) {
    let total = 0;
    for (const text of texts) {
      total += this.countTokens(text);
    }
    return total;
  }

  /**
   * 释放编码器资源
   */
  free() {
    if (this.encoding) {
      this.encoding.free();
      this.encoding = null;
    }
  }
}

// 单例模式
let instance = null;

/**
 * 获取 Token 计数器实例
 * @returns {TokenCounter} Token 计数器实例
 */
export function getTokenCounter() {
  if (!instance) {
    instance = new TokenCounter();
  }
  return instance;
}

/**
 * 释放 Token 计数器实例
 */
export function freeTokenCounter() {
  if (instance) {
    instance.free();
    instance = null;
  }
}

/**
 * 便捷函数：计算单个文本的 token 数量
 * @param {string} text - 输入文本
 * @returns {number} token 数量
 */
export function countTokens(text) {
  const counter = getTokenCounter();
  return counter.countTokens(text);
}

export default TokenCounter;
