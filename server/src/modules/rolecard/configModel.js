/**
 * 角色卡生成配置模型
 * 存储角色卡生成各阶段的LLM配置
 *
 * @author AFS Team
 * @version 1.0.0
 */

import mongoose from 'mongoose';

/**
 * 单个操作阶段的LLM配置
 */
const operationConfigSchema = new mongoose.Schema({
  source: {
    type: String,
    enum: ['ollama', 'api'],
    default: 'ollama'
  },
  model: {
    type: String,
    default: 'deepseek-r1:14b'
  },
  apiProvider: {
    type: String,
    enum: ['deepseek', 'openai', null],
    default: null
  },
  temperature: {
    type: Number,
    default: 0.3,
    min: 0,
    max: 2
  },
  maxTokens: {
    type: Number,
    default: 1000,
    min: 100,
    max: 8000
  }
}, { _id: false });

/**
 * 角色卡生成配置Schema
 */
const roleCardLLMConfigSchema = new mongoose.Schema({
  // 配置ID（单例模式）
  configId: {
    type: String,
    default: 'default',
    unique: true
  },

  // 核心层 - 提取配置（从A套答案提取人格特质）
  coreExtraction: {
    type: operationConfigSchema,
    default: () => ({
      source: 'ollama',
      model: 'deepseek-r1:14b',
      apiProvider: null,
      temperature: 0.3,
      maxTokens: 1000
    })
  },

  // 核心层 - 压缩配置（压缩核心层字段）
  coreCompression: {
    type: operationConfigSchema,
    default: () => ({
      source: 'ollama',
      model: 'deepseek-r1:14b',
      apiProvider: null,
      temperature: 0.3,
      maxTokens: 400
    })
  },

  // 关系层 - 提取配置（从B/C套答案提取关系信息）
  relationExtraction: {
    type: operationConfigSchema,
    default: () => ({
      source: 'ollama',
      model: 'deepseek-r1:14b',
      apiProvider: null,
      temperature: 0.3,
      maxTokens: 1000
    })
  },

  // 关系层 - 压缩配置（压缩关系层字段）
  relationCompression: {
    type: operationConfigSchema,
    default: () => ({
      source: 'ollama',
      model: 'deepseek-r1:14b',
      apiProvider: null,
      temperature: 0.3,
      maxTokens: 400
    })
  },

  // 信任等级分析配置
  trustAnalysis: {
    type: operationConfigSchema,
    default: () => ({
      source: 'ollama',
      model: 'deepseek-r1:14b',
      apiProvider: null,
      temperature: 0.2,
      maxTokens: 300
    })
  },

  // 更新时间
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'rolecard_llm_configs'
});

// 确保只有一个配置文档
roleCardLLMConfigSchema.pre('save', async function(next) {
  if (this.configId !== 'default') {
    this.configId = 'default';
  }
  next();
});

/**
 * 获取或创建默认配置
 */
roleCardLLMConfigSchema.statics.getOrCreateDefault = async function() {
  let config = await this.findOne({ configId: 'default' });
  if (!config) {
    config = await this.create({ configId: 'default' });
  }
  return config;
};

const RoleCardLLMConfig = mongoose.model('RoleCardLLMConfig', roleCardLLMConfigSchema);

export default RoleCardLLMConfig;
