/**
 * LangGraph Service
 * Business logic for flow configuration management
 */

import LangGraphConfig from './model.js';
import { getDefaultConfig } from './defaults/index.js';
import configLoader from './configLoader.js';
import logger from '../../core/utils/logger.js';

const serviceLogger = {
  info: (msg, meta = {}) => logger.info(msg, { ...meta, module: 'LANGGRAPH_SERVICE' }),
  error: (msg, meta = {}) => logger.error(msg, { ...meta, module: 'LANGGRAPH_SERVICE' }),
  warn: (msg, meta = {}) => logger.warn(msg, { ...meta, module: 'LANGGRAPH_SERVICE' }),
};

class LangGraphService {
  /**
   * Get all flows summary
   */
  async getFlows() {
    return configLoader.getAllConfigs();
  }

  /**
   * Get flow detail by ID
   */
  async getFlowById(flowId) {
    const config = configLoader.getConfig(flowId);
    if (!config) {
      throw new Error(`Flow not found: ${flowId}`);
    }
    return config;
  }

  /**
   * Update node config
   */
  async updateNodeConfig(flowId, nodeId, updates, updatedBy) {
    const config = await LangGraphConfig.findOne({ flowId });
    if (!config) {
      throw new Error(`Flow not found: ${flowId}`);
    }

    const nodeIndex = config.nodes.findIndex(n => n.nodeId === nodeId);
    if (nodeIndex === -1) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const node = config.nodes[nodeIndex];

    // Update staticPrompt if provided and node is static type
    if (updates.staticPrompt !== undefined && node.promptType === 'static') {
      node.staticPrompt = updates.staticPrompt;
    }

    // Update editableSection if provided and node is dynamic type
    if (updates.editableSection !== undefined && node.promptType === 'dynamic') {
      node.editableSection = updates.editableSection;
    }

    // Update LLM config if provided
    if (updates.llmConfig) {
      node.llmConfig = { ...node.llmConfig, ...updates.llmConfig };
    }

    config.updatedBy = updatedBy;
    await config.save();

    // Reload in memory
    await configLoader.reloadConfig(flowId);

    serviceLogger.info(`Updated node config: ${flowId}/${nodeId}`, { updatedBy });

    return {
      nodeId,
      updatedAt: config.updatedAt,
      updatedBy: config.updatedBy
    };
  }

  /**
   * Get available models from Ollama and API providers
   */
  async getAvailableModels(ollamaBaseUrl) {
    const models = {
      ollama: [],
      api: {
        deepseek: ['deepseek-chat', 'deepseek-reasoner'],
        openai: ['gpt-4', 'gpt-3.5-turbo']
      }
    };

    // Fetch Ollama models
    try {
      const response = await fetch(`${ollamaBaseUrl}/api/tags`);
      if (response.ok) {
        const data = await response.json();
        models.ollama = data.models?.map(m => m.name) || [];
      }
    } catch (error) {
      serviceLogger.warn('Failed to fetch Ollama models:', { error: error.message });
    }

    return models;
  }

  /**
   * Reset flow config to defaults
   */
  async resetFlowConfig(flowId) {
    const { getDefaultConfig } = await import('./defaults/index.js');

    // Delete existing config
    await LangGraphConfig.deleteOne({ flowId });

    // Create new from defaults
    const defaultConfig = getDefaultConfig(flowId);
    const created = await LangGraphConfig.create(defaultConfig);

    // Reload in memory
    await configLoader.reloadConfig(flowId);

    serviceLogger.info(`Reset flow config to defaults: ${flowId}`);

    return created.toObject();
  }
}

export default new LangGraphService();
