/**
 * LangGraph Config Loader
 * Loads and caches flow configurations from MongoDB
 */

import LangGraphConfig from './model.js';
import { getDefaultConfig } from './defaults/index.js';
import logger from '../../core/utils/logger.js';

const configLogger = {
  info: (msg, meta = {}) => logger.info(msg, { ...meta, module: 'LANGGRAPH_CONFIG' }),
  error: (msg, meta = {}) => logger.error(msg, { ...meta, module: 'LANGGRAPH_CONFIG' }),
  warn: (msg, meta = {}) => logger.warn(msg, { ...meta, module: 'LANGGRAPH_CONFIG' }),
};

class LangGraphConfigLoader {
  constructor() {
    this.configs = {};
    this.initialized = false;
  }

  /**
   * Initialize configs from MongoDB or defaults
   * Called on server startup
   */
  async initialize() {
    if (this.initialized) {
      configLogger.warn('ConfigLoader already initialized');
      return;
    }

    const flowIds = ['rolecard', 'xiaoshudong'];

    for (const flowId of flowIds) {
      try {
        const saved = await LangGraphConfig.findOne({ flowId });

        if (saved) {
          this.configs[flowId] = saved.toObject();
          configLogger.info(`Loaded config from DB: ${flowId}`);
        } else {
          // First time, create from defaults
          const defaultConfig = getDefaultConfig(flowId);
          const created = await LangGraphConfig.create(defaultConfig);
          this.configs[flowId] = created.toObject();
          configLogger.info(`Created config from defaults: ${flowId}`);
        }
      } catch (error) {
        configLogger.error(`Failed to load config ${flowId}:`, { error: error.message });
        // Fallback to defaults in memory
        this.configs[flowId] = getDefaultConfig(flowId);
      }
    }

    this.initialized = true;
    configLogger.info('LangGraph ConfigLoader initialized');
  }

  /**
   * Get all flow configurations
   */
  getAllConfigs() {
    return Object.values(this.configs).map(config => ({
      flowId: config.flowId,
      flowName: config.flowName,
      nodeCount: config.nodes?.length || 0
    }));
  }

  /**
   * Get full config for a flow
   */
  getConfig(flowId) {
    return this.configs[flowId] || null;
  }

  /**
   * Get node config by flow and node ID
   */
  getNodeConfig(flowId, nodeId) {
    const config = this.configs[flowId];
    if (!config) return null;
    return config.nodes?.find(n => n.nodeId === nodeId) || null;
  }

  /**
   * Get prompt for a node
   * Returns staticPrompt for static type, editableSection for dynamic type
   */
  getPrompt(flowId, nodeId) {
    const node = this.getNodeConfig(flowId, nodeId);
    if (!node) return null;

    if (node.promptType === 'static') {
      return node.staticPrompt;
    } else if (node.promptType === 'dynamic') {
      return node.editableSection;
    }
    return null;
  }

  /**
   * Get LLM config for a node
   */
  getLLMConfig(flowId, nodeId) {
    const node = this.getNodeConfig(flowId, nodeId);
    if (!node || !node.llmEnabled) return null;
    return node.llmConfig;
  }

  /**
   * Reload config from database (after update)
   */
  async reloadConfig(flowId) {
    try {
      const saved = await LangGraphConfig.findOne({ flowId });
      if (saved) {
        this.configs[flowId] = saved.toObject();
        configLogger.info(`Reloaded config: ${flowId}`);
        return true;
      }
      return false;
    } catch (error) {
      configLogger.error(`Failed to reload config ${flowId}:`, { error: error.message });
      return false;
    }
  }
}

// Singleton instance
export const configLoader = new LangGraphConfigLoader();
export default configLoader;
