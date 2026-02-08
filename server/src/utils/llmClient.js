/**
 * LLM 客户端工具
 * 统一的 LLM 调用接口，支持多种模型和错误处理
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import { ChatOllama } from '@langchain/ollama';
import { BaseLanguageModel } from '@langchain/core/language_models/base';

/**
 * LLM 客户端类
 * 提供统一的 LLM 调用接口，支持重试和错误处理
 */
class LLMClient {
  /**
   * 构造函数
   * @param {string} model - 模型名称，默认使用 qwen2.5
   * @param {Object} options - 配置选项
   */
  constructor(model = 'qwen2.5', options = {}) {
    this.model = model;
    this.baseUrl = options.baseUrl || process.env.OLLAMA_BASE_URL || 'http://modelserver:11434';
    this.maxRetries = options.maxRetries || 3;
    this.timeout = options.timeout || 30000;
    this.temperature = options.temperature || 0.7;
    
    // 初始化 ChatOllama 实例
    this.llm = new ChatOllama({
      model,
      baseUrl: this.baseUrl,
      temperature: this.temperature,
      maxRetries: this.maxRetries,
      timeout: this.timeout,
      ...options
    });
  }

  /**
   * 生成文本回复
   * @param {string} prompt - 输入提示
   * @param {Object} options - 生成选项
   * @returns {Promise<string>} 生成的文本
   */
  async generate(prompt, options = {}) {
    try {
      const response = await this.llm.invoke(prompt, {
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        ...options
      });
      
      return response.content;
    } catch (error) {
      console.error('[LLMClient] 生成失败:', error);
      throw new Error(`LLM 生成失败: ${error.message}`);
    }
  }

  /**
   * 流式生成文本
   * @param {string} prompt - 输入提示
   * @param {Object} options - 生成选项
   * @param {Function} onChunk - 回调函数，接收每个文本块
   * @returns {Promise<string>} 完整生成的文本
   */
  async generateStream(prompt, options = {}, onChunk) {
    try {
      const stream = await this.llm.stream(prompt, options);
      let fullText = '';
      
      for await (const chunk of stream) {
        const text = chunk.content || '';
        fullText += text;
        
        if (onChunk && typeof onChunk === 'function') {
          onChunk(text);
        }
      }
      
      return fullText;
    } catch (error) {
      console.error('[LLMClient] 流式生成失败:', error);
      throw new Error(`LLM 流式生成失败: ${error.message}`);
    }
  }

  /**
   * 批量生成（多个提示并行处理）
   * @param {string[]} prompts - 提示数组
   * @param {Object} options - 生成选项
   * @returns {Promise<string[]>} 生成的文本数组
   */
  async batchGenerate(prompts, options = {}) {
    const promises = prompts.map(prompt => 
      this.generate(prompt, options).catch(error => {
        console.error('[LLMClient] 批量生成中的错误:', error);
        return null; // 返回 null 表示失败
      })
    );
    
    return Promise.all(promises);
  }

  /**
   * 健康检查 - 验证 LLM 服务是否可用
   * @returns {Promise<boolean>} 是否健康
   */
  async healthCheck() {
    try {
      const response = await this.llm.invoke('Hello', { 
        maxTokens: 5,
        timeout: 5000 
      });
      return !!(response && response.content);
    } catch (error) {
      console.warn('[LLMClient] 健康检查失败:', error.message);
      return false;
    }
  }

  /**
   * 获取模型信息
   * @returns {Object} 模型信息
   */
  getModelInfo() {
    return {
      model: this.model,
      baseUrl: this.baseUrl,
      temperature: this.temperature,
      maxRetries: this.maxRetries,
      timeout: this.timeout
    };
  }

  /**
   * 设置模型
   * @param {string} model - 新的模型名称
   */
  setModel(model) {
    this.model = model;
    this.llm = new ChatOllama({
      model,
      baseUrl: this.baseUrl,
      temperature: this.llm.temperature,
      maxRetries: this.maxRetries,
      timeout: this.timeout
    });
  }

  /**
   * 获取底层 LLM 实例（用于高级操作）
   * @returns {BaseLanguageModel} LangChain LLM 实例
   */
  getLLMInstance() {
    return this.llm;
  }
}

/**
 * 创建默认 LLM 客户端实例
 * 使用系统默认配置
 */
export const createDefaultLLMClient = () => {
  return new LLMClient('qwen2.5', {
    temperature: 0.7,
    maxRetries: 3,
    timeout: 30000
  });
};

/**
 * 创建情感分析专用客户端
 * 使用适合情感分析的配置
 */
export const createSentimentLLMClient = () => {
  return new LLMClient('qwen2.5', {
    temperature: 0.1, // 低温度确保输出稳定
    maxRetries: 3,
    timeout: 10000
  });
};

export default LLMClient;