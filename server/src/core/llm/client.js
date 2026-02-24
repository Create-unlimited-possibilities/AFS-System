/**
 * LLM 客户端工具
 * 统一的 LLM 调用接口，支持多种模型和错误处理
 * 支持: Ollama (本地) 和 DeepSeek API
 *
 * @author AFS Team
 * @version 2.0.0
 */

import { ChatOllama } from '@langchain/ollama';
import { ChatOpenAI } from '@langchain/openai';
import { BaseLanguageModel } from '@langchain/core/language_models/base';

// LLM 后端选择: ollama | deepseek
const LLM_BACKEND = process.env.LLM_BACKEND || 'ollama';

// Ollama 配置
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://modelserver:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'deepseek-r1:14b';
// Ollama 健康检查超时配置（毫秒）- 默认30秒
const OLLAMA_HEALTH_CHECK_TIMEOUT = parseInt(process.env.OLLAMA_TIMEOUT || '30000', 10);

// DeepSeek API 配置
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
// DeepSeek API 需要使用 /v1 路径（OpenAI 兼容接口）
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

// 默认模型（必须在调试日志之前定义）
const DEFAULT_MODEL = LLM_BACKEND === 'deepseek' ? DEEPSEEK_MODEL : OLLAMA_MODEL;

// 调试日志
console.log(`[LLMClient] 配置 - Backend: ${LLM_BACKEND}, Model: ${DEFAULT_MODEL}`);
if (LLM_BACKEND === 'deepseek') {
  console.log(`[LLMClient] DeepSeek - BaseURL: ${DEEPSEEK_BASE_URL}, API Key: ${DEEPSEEK_API_KEY ? DEEPSEEK_API_KEY.substring(0, 10) + '...' : 'NOT SET'}`);
}

/**
 * LLM 客户端类
 * 提供统一的 LLM 调用接口，支持重试和错误处理
 */
class LLMClient {
  /**
   * 构造函数
   * @param {string} model - 模型名称，默认使用环境变量配置
   * @param {Object} options - 配置选项
   */
  constructor(model = DEFAULT_MODEL, options = {}) {
    this.model = model;
    this.backend = options.backend || LLM_BACKEND;
    this.maxRetries = options.maxRetries || 3;
    this.timeout = options.timeout || 60000;
    this.temperature = options.temperature ?? (parseFloat(process.env.LLM_TEMPERATURE) || 0.7);

    // 根据后端类型初始化不同的LLM实例
    if (this.backend === 'deepseek') {
      this.baseUrl = options.baseUrl || DEEPSEEK_BASE_URL;

      // 调试：打印 API Key 信息
      console.log(`[LLMClient] DeepSeek 初始化 - Model: ${this.model}`);
      console.log(`[LLMClient] DeepSeek BaseURL: ${this.baseUrl}`);
      console.log(`[LLMClient] DEEPSEEK_API_KEY 值: "${DEEPSEEK_API_KEY}"`);
      console.log(`[LLMClient] DEEPSEEK_API_KEY 长度: ${DEEPSEEK_API_KEY?.length || 0}`);

      // 使用 configuration 对象设置所有参数
      this.llm = new ChatOpenAI({
        model: this.model,
        temperature: this.temperature,
        maxRetries: this.maxRetries,
        timeout: this.timeout,
        configuration: {
          baseURL: this.baseUrl,
          apiKey: DEEPSEEK_API_KEY,
          defaultHeaders: {
            'Content-Type': 'application/json'
          }
        }
      });

      console.log(`[LLMClient] ChatOpenAI 创建完成`);
    } else {
      // 默认使用 Ollama
      this.baseUrl = options.baseUrl || OLLAMA_BASE_URL;
      this.llm = new ChatOllama({
        model: this.model,
        baseUrl: this.baseUrl,
        temperature: this.temperature,
        maxRetries: this.maxRetries,
        timeout: this.timeout,
        ...options
      });
    }
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
   * 健康检查 - 验证 LLM 服务是否可用（不消耗 tokens）
   * @param {Object} options - 健康检查选项
   * @param {number} options.timeout - 自定义超时时间（毫秒）
   * @returns {Promise<boolean|Object>} 是否健康（向后兼容）或详细健康信息
   */
  async healthCheck(options = {}) {
    // 根据后端类型选择合适的超时时间
    const healthCheckTimeout = options.timeout ??
      (this.backend === 'ollama' ? OLLAMA_HEALTH_CHECK_TIMEOUT : 5000);

    try {
      if (this.backend === 'deepseek' || this.backend === 'openai') {
        const result = await this._healthCheckOpenAI(healthCheckTimeout);
        // Return object for detailed info, but also support boolean check
        return options.detailed ? result : result.healthy;
      } else {
        // Default: Ollama
        const result = await this._healthCheckOllama(healthCheckTimeout);
        return options.detailed ? result : result.healthy;
      }
    } catch (error) {
      console.warn('[LLMClient] 健康检查失败:', error.message);
      return options.detailed ? { healthy: false, error: error.message } : false;
    }
  }

  /**
   * Ollama 健康检查 - 使用 /api/tags 端点（不消耗 tokens）
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise<Object>} 健康检查结果
   */
  async _healthCheckOllama(timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          healthy: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const data = await response.json();
      const models = data.models || [];
      const modelNames = models.map(m => m.name);

      // Check if configured model is available
      const modelAvailable = modelNames.some(name =>
        name === this.model || name.startsWith(this.model + ':')
      );

      return {
        healthy: true,
        modelAvailable,
        availableModels: modelNames,
        configuredModel: this.model
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        return { healthy: false, error: `Timeout after ${timeout}ms` };
      }
      return { healthy: false, error: error.message };
    }
  }

  /**
   * OpenAI/DeepSeek 健康检查 - 使用 /models 端点（不消耗 tokens）
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise<Object>} 健康检查结果
   */
  async _healthCheckOpenAI(timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Get API key based on backend
    const apiKey = this.backend === 'deepseek' ? DEEPSEEK_API_KEY :
                   (process.env.OPENAI_API_KEY || '');

    if (!apiKey) {
      return {
        healthy: false,
        error: `No API key configured for ${this.backend}`
      };
    }

    try {
      // For DeepSeek, the baseUrl already includes /v1, so we just append /models
      // For OpenAI, baseUrl might be the base or include /v1
      let modelsUrl = this.baseUrl;
      if (modelsUrl.endsWith('/v1')) {
        modelsUrl = modelsUrl + '/models';
      } else if (!modelsUrl.endsWith('/models')) {
        modelsUrl = modelsUrl.replace(/\/$/, '') + '/v1/models';
      }

      const response = await fetch(modelsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          healthy: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const data = await response.json();
      const models = data.data || [];
      const modelIds = models.map(m => m.id);

      // Check if configured model is available
      const modelAvailable = modelIds.some(id =>
        id === this.model || id.includes(this.model)
      );

      return {
        healthy: true,
        modelAvailable,
        availableModels: modelIds.slice(0, 20), // Limit to first 20 for response size
        configuredModel: this.model
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        return { healthy: false, error: `Timeout after ${timeout}ms` };
      }
      return { healthy: false, error: error.message };
    }
  }

  /**
   * 获取模型信息
   * @returns {Object} 模型信息
   */
  getModelInfo() {
    return {
      backend: this.backend,
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

    if (this.backend === 'deepseek') {
      this.llm = new ChatOpenAI({
        model: this.model,
        openAIApiKey: DEEPSEEK_API_KEY,
        configuration: {
          baseURL: this.baseUrl,
        },
        temperature: this.temperature,
        maxRetries: this.maxRetries,
        timeout: this.timeout
      });
    } else {
      this.llm = new ChatOllama({
        model: this.model,
        baseUrl: this.baseUrl,
        temperature: this.temperature,
        maxRetries: this.maxRetries,
        timeout: this.timeout
      });
    }
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
 * 使用系统默认配置（从环境变量读取模型）
 */
export const createDefaultLLMClient = () => {
  return new LLMClient(DEFAULT_MODEL, {
    backend: LLM_BACKEND,
    temperature: 0.7,
    maxRetries: 3,
    timeout: 60000
  });
};

/**
 * 创建情感分析专用客户端
 * 使用适合情感分析的配置
 */
export const createSentimentLLMClient = () => {
  return new LLMClient(DEFAULT_MODEL, {
    backend: LLM_BACKEND,
    temperature: 0.1, // 低温度确保输出稳定
    maxRetries: 3,
    timeout: 30000
  });
};

export default LLMClient;