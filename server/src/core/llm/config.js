/**
 * LLM 配置管理器
 * 统一管理 LLM 相关配置，支持 API KEY 和本地 Ollama 两种方式
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import dotenv from 'dotenv';
import logger from '../utils/logger.js';

// 加载环境变量
dotenv.config();

/**
 * LLM 配置管理器类
 * 提供配置验证、降级策略管理等功能
 */
class LLMConfig {
  constructor() {
    this.config = this._loadConfig();
    this._validateConfig();
  }

  /**
   * 加载配置
   * @returns {Object} 配置对象
   * @private
   */
  _loadConfig() {
    return {
      // API LLM 配置
      useApiLLM: process.env.USE_API_LLM === 'true',
      apiKey: process.env.API_LLM_KEY || '',
      apiModel: process.env.API_LLM_MODEL || 'gpt-3.5-turbo',
      
      // 本地 Ollama 配置
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://modelserver:11434',
      ollamaModel: process.env.OLLAMA_MODEL || 'qwen2.5',
      ollamaModelPath: process.env.OLLAMA_MODEL_PATH || '@model\\models\\blobs\\',
      
      // 降级策略
      fallbackStrategy: process.env.LLM_FALLBACK_STRATEGY || 'api-local',
      
      // 超时和重试配置
      timeout: parseInt(process.env.LLM_TIMEOUT) || 30000,
      maxRetries: parseInt(process.env.LLM_MAX_RETRIES) || 3,
      
      // 温度参数
      temperature: parseFloat(process.env.LLM_TEMPERATURE) || 0.7
    };
  }

  /**
   * 验证配置
   * @private
   */
  _validateConfig() {
    const errors = [];
    
    // 检查降级策略
    if (!['api-local', 'local-api', 'none', 'local'].includes(this.config.fallbackStrategy)) {
      errors.push(`无效的降级策略: ${this.config.fallbackStrategy}`);
    }
    
    // 检查数值范围
    if (this.config.timeout < 1000 || this.config.timeout > 300000) {
      errors.push('LLM_TIMEOUT 应在 1000-300000ms 之间');
    }
    
    if (this.config.maxRetries < 0 || this.config.maxRetries > 10) {
      errors.push('LLM_MAX_RETRIES 应在 0-10 之间');
    }
    
    if (this.config.temperature < 0 || this.config.temperature > 2) {
      errors.push('LLM_TEMPERATURE 应在 0-2 之间');
    }
    
    // 如果使用 API，检查 API Key
    if (this.config.useApiLLM && !this.config.apiKey) {
      errors.push('USE_API_LLM=true 时必须提供 API_LLM_KEY');
    }
    
    // 检查本地 Ollama 配置
    if (!this.config.ollamaBaseUrl) {
      errors.push('OLLAMA_BASE_URL 不能为空');
    }
    
    if (!this.config.ollamaModel) {
      errors.push('OLLAMA_MODEL 不能为空');
    }
    
    if (errors.length > 0) {
      const errorMsg = 'LLM 配置验证失败:\n' + errors.join('\n');
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    logger.info('LLM 配置验证通过');
  }

  /**
   * 获取完整配置
   * @returns {Object} 配置对象
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * 获取 API LLM 配置
   * @returns {Object|null} API LLM 配置
   */
  getApiLLMConfig() {
    if (!this.config.useApiLLM) {
      return null;
    }
    
    return {
      apiKey: this.config.apiKey,
      model: this.config.apiModel,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      temperature: this.config.temperature
    };
  }

  /**
   * 获取本地 Ollama 配置
   * @returns {Object} 本地 Ollama 配置
   */
  getOllamaConfig() {
    return {
      baseUrl: this.config.ollamaBaseUrl,
      model: this.config.ollamaModel,
      modelPath: this.config.ollamaModelPath,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      temperature: this.config.temperature
    };
  }

  /**
   * 获取降级策略
   * @returns {string} 降级策略
   */
  getFallbackStrategy() {
    return this.config.fallbackStrategy;
  }

  /**
   * 检查 API LLM 是否可用
   * @returns {boolean} 是否可用
   */
  isApiLLMAvailable() {
    return this.config.useApiLLM && !!this.config.apiKey;
  }

  /**
   * 检查本地 Ollama 是否可用
   * @returns {boolean} 是否可用
   */
  isOllamaAvailable() {
    return !!this.config.ollamaBaseUrl && !!this.config.ollamaModel;
  }

  /**
   * 获取优先使用的 LLM 类型
   * @returns {string} 'api' 或 'local'
   */
  getPreferredLLM() {
    const strategy = this.config.fallbackStrategy;
    
    if (strategy === 'api-local' || strategy === 'none') {
      return this.isApiLLMAvailable() ? 'api' : 'local';
    } else if (strategy === 'local-api') {
      return this.isOllamaAvailable() ? 'local' : 'api';
    } else if (strategy === 'local') {
      return this.isOllamaAvailable() ? 'local' : (this.isApiLLMAvailable() ? 'api' : null);
    }
    
    return this.isApiLLMAvailable() ? 'api' : 'local';
  }

  /**
   * 获取降级顺序
   * @returns {string[]} 降级顺序
   */
  getFallbackOrder() {
    const strategy = this.config.fallbackStrategy;
    
    if (strategy === 'api-local') {
      return ['api', 'local'];
    } else if (strategy === 'local-api') {
      return ['local', 'api'];
    } else if (strategy === 'local') {
      return ['local'];
    } else {
      // none - 只使用首选
      return [this.getPreferredLLM()];
    }
  }

  /**
   * 记录配置信息
   */
  logConfig() {
    logger.info('LLM 配置信息:');
    logger.info(`  - 优先 API LLM: ${this.config.useApiLLM}`);
    logger.info(`  - API Key: ${this.config.apiKey ? '已配置' : '未配置'}`);
    logger.info(`  - API 模型: ${this.config.apiModel}`);
    logger.info(`  - Ollama 基础 URL: ${this.config.ollamaBaseUrl}`);
    logger.info(`  - Ollama 模型: ${this.config.ollamaModel}`);
    logger.info(`  - 降级策略: ${this.config.fallbackStrategy}`);
    logger.info(`  - 超时时间: ${this.config.timeout}ms`);
    logger.info(`  - 最大重试: ${this.config.maxRetries}`);
    logger.info(`  - 温度: ${this.config.temperature}`);
    logger.info(`  - 首选 LLM: ${this.getPreferredLLM()}`);
    logger.info(`  - 降级顺序: [${this.getFallbackOrder().join(', ')}]`);
  }
}

// 创建全局实例
export const llmConfig = new LLMConfig();

export default LLMConfig;