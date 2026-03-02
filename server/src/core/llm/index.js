/**
 * LLM Service Index
 * Unified LLM service interface for the application
 *
 * Provides a simple chat interface that wraps the underlying LLM clients
 *
 * @author AFS Team
 * @version 1.0.0
 */

import LLMClient, { createDefaultLLMClient } from './client.js';
import { multiLLMClient } from './multi.js';
import modelInfoService from './modelInfoService.js';
import logger from '../utils/logger.js';

/**
 * LLM Service wrapper that provides a simple chat interface
 */
class LLMService {
  constructor() {
    this.client = createDefaultLLMClient();
    this.multiClient = multiLLMClient;
  }

  /**
   * Chat with the LLM using messages format
   *
   * @param {Object} params - Chat parameters
   * @param {Array} params.messages - Array of {role, content} messages
   * @param {number} params.temperature - Temperature for generation
   * @param {number} params.maxTokens - Maximum tokens to generate
   * @returns {Promise<Object>} Response with content field
   */
  async chat({ messages, temperature, maxTokens }) {
    try {
      // Convert messages to a single prompt
      const prompt = this.messagesToPrompt(messages);

      // Use multi client for fallback support
      const response = await this.multiClient.generate(prompt, {
        temperature: temperature ?? 0.7,
        maxTokens: maxTokens ?? 2000
      });

      return {
        content: response,
        role: 'assistant'
      };
    } catch (error) {
      logger.error('[LLMService] Chat failed:', error);
      throw error;
    }
  }

  /**
   * Generate text from a prompt
   *
   * @param {string} prompt - Input prompt
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Generated text
   */
  async generate(prompt, options = {}) {
    return this.multiClient.generate(prompt, options);
  }

  /**
   * Convert messages array to a single prompt string
   *
   * @param {Array} messages - Array of {role, content} messages
   * @returns {string} Combined prompt
   */
  messagesToPrompt(messages) {
    if (!messages || !Array.isArray(messages)) {
      return '';
    }

    return messages
      .map(msg => {
        const role = msg.role || 'user';
        const content = msg.content || '';
        return `[${role}]\n${content}`;
      })
      .join('\n\n');
  }

  /**
   * Health check
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    return this.multiClient.healthCheck();
  }

  /**
   * Get client info
   * @returns {Object}
   */
  getClientInfo() {
    return this.multiClient.getCurrentClientInfo();
  }
}

// Singleton instance
let llmServiceInstance = null;

/**
 * Get the LLM service instance
 * @returns {LLMService}
 */
export function getLLMService() {
  if (!llmServiceInstance) {
    llmServiceInstance = new LLMService();
  }
  return llmServiceInstance;
}

// Export for direct use
export { LLMClient, multiLLMClient, modelInfoService };
export default LLMService;
