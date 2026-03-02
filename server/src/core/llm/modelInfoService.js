/**
 * Ollama Model Info Service
 * Fetches and caches model context length from Ollama API
 *
 * This service dynamically retrieves model information from Ollama's /api/show
 * endpoint, replacing hardcoded context length limits with runtime values.
 *
 * @author AFS Team
 * @version 1.0.0
 */

import logger from '../utils/logger.js';

// Module-specific logger
const modelInfoLogger = {
  info: (message, meta = {}) => logger.info(message, { ...meta, module: 'MODEL_INFO_SERVICE' }),
  error: (message, meta = {}) => logger.error(message, { ...meta, module: 'MODEL_INFO_SERVICE' }),
  warn: (message, meta = {}) => logger.warn(message, { ...meta, module: 'MODEL_INFO_SERVICE' }),
  debug: (message, meta = {}) => logger.debug(message, { ...meta, module: 'MODEL_INFO_SERVICE' })
};

// Default fallback context limit (64K tokens)
const DEFAULT_CONTEXT_LIMIT = 65536;

// API timeout in milliseconds
const API_TIMEOUT = 5000;

/**
 * Ollama Model Info Service
 * Provides dynamic model context length information from Ollama API
 */
class OllamaModelInfoService {
  constructor() {
    // In-memory cache for model context limits
    this.cache = new Map();

    // Ollama base URL from environment or default
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://modelserver:11434';
  }

  /**
   * Get context limit for a model (with caching)
   *
   * @param {string} modelName - Model name (e.g., 'deepseek-r1:14b', 'ziwei-8b')
   * @returns {Promise<number>} Context limit in tokens
   */
  async getContextLimit(modelName) {
    // Validate model name
    if (!modelName || typeof modelName !== 'string') {
      modelInfoLogger.warn('Invalid model name provided, using default');
      return DEFAULT_CONTEXT_LIMIT;
    }

    // Check cache first
    if (this.cache.has(modelName)) {
      modelInfoLogger.debug(`Cache hit for model: ${modelName}`);
      return this.cache.get(modelName);
    }

    // Fetch from Ollama API
    try {
      const contextLimit = await this._fetchContextLimit(modelName);
      this.cache.set(modelName, contextLimit);
      modelInfoLogger.info(`Fetched context limit for ${modelName}: ${contextLimit}`);
      return contextLimit;
    } catch (error) {
      modelInfoLogger.warn(`Failed to fetch context limit for ${modelName}, using default: ${error.message}`);
      return DEFAULT_CONTEXT_LIMIT;
    }
  }

  /**
   * Fetch context limit from Ollama API
   *
   * @param {string} modelName - Model name
   * @returns {Promise<number>} Context limit
   * @private
   */
  async _fetchContextLimit(modelName) {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
      const response = await fetch(`${this.baseUrl}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelName }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      return this._extractContextLength(data);
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Extract context length from API response
   *
   * The Ollama API returns model info with keys like:
   * - 'qwen3.context_length': 131072
   * - 'llama.context_length': 8192
   * - 'context_length': 4096
   *
   * Or in parameters string:
   * - 'num_ctx 4096'
   *
   * @param {Object} data - API response
   * @returns {number} Context length
   * @private
   */
  _extractContextLength(data) {
    // Try to find context_length in model_info
    const modelInfo = data.model_info || {};

    // Look for any key ending with context_length or exact match
    for (const [key, value] of Object.entries(modelInfo)) {
      if (key.endsWith('.context_length') || key === 'context_length') {
        const numValue = Number(value);
        if (!isNaN(numValue) && numValue > 0) {
          return numValue;
        }
      }
    }

    // Fallback: parse from parameters string
    const parameters = data.parameters || '';
    const numCtxMatch = parameters.match(/num_ctx\s+(\d+)/);
    if (numCtxMatch) {
      return parseInt(numCtxMatch[1], 10);
    }

    // No context length found, use default
    modelInfoLogger.debug('No context_length found in response, using default');
    return DEFAULT_CONTEXT_LIMIT;
  }

  /**
   * Force refresh cache for a model
   *
   * @param {string} modelName - Model name
   * @returns {Promise<number>} Fresh context limit
   */
  async refreshContextLimit(modelName) {
    this.cache.delete(modelName);
    modelInfoLogger.info(`Cache cleared for model: ${modelName}`);
    return this.getContextLimit(modelName);
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.cache.clear();
    modelInfoLogger.info('All cache cleared');
  }

  /**
   * Get cache statistics
   *
   * @returns {Object} Cache stats with size and model names
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      models: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
export default new OllamaModelInfoService();
