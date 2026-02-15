/**
 * 多 LLM 客户端
 * 统一的 LLM 调用接口，支持 API KEY 和本地 Ollama 两种方式，支持自动降级
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import { ChatOllama } from '@langchain/ollama';
import LLMClient from './client.js';
import { llmConfig } from './config.js';
import logger from '../utils/logger.js';

/**
 * 多 LLM 客户端类
 * 提供统一的 LLM 调用接口，支持自动降级和错误处理
 */
class MultiLLMClient {
  constructor() {
    this.config = llmConfig.getConfig();
    this.apiClient = null;
    this.localClient = null;
    this.currentClient = null;
    this.currentType = null;
    
    // 初始化客户端
    this._initializeClients();
    
    // 记录配置
    llmConfig.logConfig();
  }

  /**
   * 初始化客户端
   * @private
   */
  _initializeClients() {
    const preferred = llmConfig.getPreferredLLM();
    
    // 初始化本地 Ollama 客户端
    if (llmConfig.isOllamaAvailable()) {
      const ollamaConfig = llmConfig.getOllamaConfig();
      this.localClient = new LLMClient(ollamaConfig.model, {
        baseUrl: ollamaConfig.baseUrl,
        temperature: ollamaConfig.temperature,
        maxRetries: ollamaConfig.maxRetries,
        timeout: ollamaConfig.timeout
      });
      logger.info(`本地 Ollama 客户端已初始化: ${ollamaConfig.model}`);
    }
    
    // 初始化 API 客户端（占位，后续扩展）
    if (llmConfig.isApiLLMAvailable()) {
      const apiConfig = llmConfig.getApiLLMConfig();
      // TODO: 实现真正的 API 客户端
      // this.apiClient = new ApiLLMClient(apiConfig);
      logger.info(`API LLM 客户端占位已创建: ${apiConfig.model}`);
    }
    
    // 设置当前客户端
    this._setCurrentClient(preferred);
  }

  /**
   * 设置当前客户端
   * @param {string} type - 客户端类型 'api' 或 'local'
   * @private
   */
  _setCurrentClient(type) {
    if (type === 'api' && this.apiClient) {
      this.currentClient = this.apiClient;
      this.currentType = 'api';
      logger.info('当前使用 API LLM 客户端');
    } else if (type === 'local' && this.localClient) {
      this.currentClient = this.localClient;
      this.currentType = 'local';
      logger.info('当前使用本地 Ollama 客户端');
    } else if (this.localClient) {
      // 降级到本地客户端
      this.currentClient = this.localClient;
      this.currentType = 'local';
      logger.info('降级到本地 Ollama 客户端');
    } else {
      throw new Error('没有可用的 LLM 客户端');
    }
  }

  /**
   * 尝试降级到下一个客户端
   * @returns {boolean} 是否成功降级
   * @private
   */
  _tryFallback() {
    const fallbackOrder = llmConfig.getFallbackOrder();
    const currentIndex = fallbackOrder.indexOf(this.currentType);
    
    if (currentIndex < fallbackOrder.length - 1) {
      const nextType = fallbackOrder[currentIndex + 1];
      logger.warn(`尝试降级从 ${this.currentType} 到 ${nextType}`);
      
      if (nextType === 'api' && this.apiClient) {
        this._setCurrentClient('api');
        return true;
      } else if (nextType === 'local' && this.localClient) {
        this._setCurrentClient('local');
        return true;
      }
    }
    
    logger.error('没有更多可用的降级选项');
    return false;
  }

  /**
   * 生成文本回复
   * @param {string} prompt - 输入提示
   * @param {Object} options - 生成选项
   * @returns {Promise<string>} 生成的文本
   */
  async generate(prompt, options = {}) {
    let lastError = null;
    const fallbackOrder = llmConfig.getFallbackOrder();
    
    for (const type of fallbackOrder) {
      try {
        // 确保使用正确的客户端
        if (type !== this.currentType) {
          this._setCurrentClient(type);
        }
        
        logger.info(`使用 ${this.currentType} 客户端生成文本`);
        const result = await this.currentClient.generate(prompt, options);
        
        logger.info(`${this.currentType} 客户端生成成功`);
        return result;
      } catch (error) {
        lastError = error;
        logger.error(`${this.currentType} 客户端生成失败:`, error.message);
        
        // 如果还有降级选项，尝试降级
        if (fallbackOrder.indexOf(type) < fallbackOrder.length - 1) {
          continue;
        } else {
          break;
        }
      }
    }
    
    // 所有客户端都失败了
    throw new Error(`所有 LLM 客户端都失败了。最后错误: ${lastError.message}`);
  }

  /**
   * 流式生成文本
   * @param {string} prompt - 输入提示
   * @param {Object} options - 生成选项
   * @param {Function} onChunk - 回调函数，接收每个文本块
   * @returns {Promise<string>} 完整生成的文本
   */
  async generateStream(prompt, options = {}, onChunk) {
    let lastError = null;
    const fallbackOrder = llmConfig.getFallbackOrder();
    
    for (const type of fallbackOrder) {
      try {
        // 确保使用正确的客户端
        if (type !== this.currentType) {
          this._setCurrentClient(type);
        }
        
        logger.info(`使用 ${this.currentType} 客户端流式生成文本`);
        const result = await this.currentClient.generateStream(prompt, options, onChunk);
        
        logger.info(`${this.currentType} 客户端流式生成成功`);
        return result;
      } catch (error) {
        lastError = error;
        logger.error(`${this.currentType} 客户端流式生成失败:`, error.message);
        
        // 如果还有降级选项，尝试降级
        if (fallbackOrder.indexOf(type) < fallbackOrder.length - 1) {
          continue;
        } else {
          break;
        }
      }
    }
    
    // 所有客户端都失败了
    throw new Error(`所有 LLM 客户端流式生成都失败了。最后错误: ${lastError.message}`);
  }

  /**
   * 批量生成（多个提示并行处理）
   * @param {string[]} prompts - 提示数组
   * @param {Object} options - 生成选项
   * @returns {Promise<string[]>} 生成的文本数组
   */
  async batchGenerate(prompts, options = {}) {
    let lastError = null;
    const fallbackOrder = llmConfig.getFallbackOrder();
    
    for (const type of fallbackOrder) {
      try {
        // 确保使用正确的客户端
        if (type !== this.currentType) {
          this._setCurrentClient(type);
        }
        
        logger.info(`使用 ${this.currentType} 客户端批量生成`);
        const result = await this.currentClient.batchGenerate(prompts, options);
        
        logger.info(`${this.currentType} 客户端批量生成成功`);
        return result;
      } catch (error) {
        lastError = error;
        logger.error(`${this.currentType} 客户端批量生成失败:`, error.message);
        
        // 如果还有降级选项，尝试降级
        if (fallbackOrder.indexOf(type) < fallbackOrder.length - 1) {
          continue;
        } else {
          break;
        }
      }
    }
    
    // 所有客户端都失败了
    throw new Error(`所有 LLM 客户端批量生成都失败了。最后错误: ${lastError.message}`);
  }

  /**
   * 健康检查 - 验证当前 LLM 服务是否可用
   * @returns {Promise<boolean>} 是否健康
   */
  async healthCheck() {
    const fallbackOrder = llmConfig.getFallbackOrder();
    
    for (const type of fallbackOrder) {
      try {
        // 确保使用正确的客户端
        if (type !== this.currentType) {
          this._setCurrentClient(type);
        }
        
        const isHealthy = await this.currentClient.healthCheck();
        if (isHealthy) {
          logger.info(`${this.currentType} 客户端健康检查通过`);
          return true;
        }
      } catch (error) {
        logger.error(`${this.currentType} 客户端健康检查失败:`, error.message);
      }
    }
    
    logger.error('所有 LLM 客户端健康检查都失败了');
    return false;
  }

  /**
   * 获取当前客户端信息
   * @returns {Object} 当前客户端信息
   */
  getCurrentClientInfo() {
    return {
      type: this.currentType,
      info: this.currentClient ? this.currentClient.getModelInfo() : null,
      fallbackOrder: llmConfig.getFallbackOrder()
    };
  }

  /**
   * 获取所有可用客户端信息
   * @returns {Object} 所有客户端信息
   */
  getAllClientsInfo() {
    return {
      config: this.config,
      api: {
        available: llmConfig.isApiLLMAvailable(),
        config: llmConfig.getApiLLMConfig()
      },
      local: {
        available: llmConfig.isOllamaAvailable(),
        config: llmConfig.getOllamaConfig(),
        modelInfo: this.localClient ? this.localClient.getModelInfo() : null
      },
      fallbackStrategy: llmConfig.getFallbackStrategy(),
      preferred: llmConfig.getPreferredLLM()
    };
  }
}

// 创建全局实例
export const multiLLMClient = new MultiLLMClient();

export default MultiLLMClient;