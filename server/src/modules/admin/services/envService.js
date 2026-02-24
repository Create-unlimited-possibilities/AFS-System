/**
 * Environment Variable Management Service
 * Handles reading, validating, and updating environment variables
 *
 * @author AFS Team
 * @version 1.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import logger from '../../../core/utils/logger.js';

// Environment variable configuration
const ENV_CONFIG = {
  // Editable variables
  editable: {
    LLM_BACKEND: {
      type: 'enum',
      values: ['ollama', 'deepseek'],
      default: 'ollama',
      description: 'LLM后端选择',
      category: 'llm'
    },
    OLLAMA_BASE_URL: {
      type: 'url',
      default: 'http://modelserver:11434',
      description: 'Ollama服务地址',
      category: 'llm'
    },
    OLLAMA_MODEL: {
      type: 'string',
      default: 'deepseek-r1:14b',
      description: 'Ollama模型名称',
      category: 'llm'
    },
    DEEPSEEK_BASE_URL: {
      type: 'url',
      default: 'https://api.deepseek.com/v1',
      description: 'DeepSeek API地址',
      category: 'llm'
    },
    DEEPSEEK_MODEL: {
      type: 'enum',
      values: ['deepseek-chat', 'deepseek-reasoner'],
      default: 'deepseek-chat',
      description: 'DeepSeek模型名称',
      category: 'llm'
    },
    LLM_TIMEOUT: {
      type: 'number',
      min: 1000,
      max: 300000,
      default: 60000,
      description: 'LLM请求超时时间(ms)',
      category: 'llm'
    },
    LLM_MAX_RETRIES: {
      type: 'number',
      min: 0,
      max: 10,
      default: 3,
      description: 'LLM最大重试次数',
      category: 'llm'
    },
    LLM_TEMPERATURE: {
      type: 'number',
      min: 0,
      max: 2,
      step: 0.1,
      default: 0.7,
      description: 'LLM生成温度',
      category: 'llm'
    },
    EMBEDDING_BACKEND: {
      type: 'enum',
      values: ['ollama', 'openai'],
      default: 'ollama',
      description: 'Embedding后端选择',
      category: 'embedding'
    },
    EMBEDDING_MODEL: {
      type: 'string',
      default: 'bge-m3',
      description: 'Embedding模型名称',
      category: 'embedding'
    },
    CHROMA_URL: {
      type: 'url',
      default: 'http://chromaserver:8000',
      description: 'ChromaDB服务地址',
      category: 'database'
    }
  },

  // Read-only variables (can be viewed but not edited)
  readOnly: {
    MONGO_URI: {
      type: 'string',
      description: 'MongoDB连接字符串',
      category: 'database'
    },
    JWT_SECRET: {
      type: 'string',
      description: 'JWT密钥',
      category: 'security'
    },
    PORT: {
      type: 'number',
      description: '服务器端口',
      category: 'server'
    },
    NODE_ENV: {
      type: 'enum',
      values: ['development', 'production', 'test'],
      description: '运行环境',
      category: 'server'
    }
  },

  // Sensitive variables (masked in display, requires confirmation to edit)
  sensitive: {
    DEEPSEEK_API_KEY: {
      type: 'string',
      description: 'DeepSeek API密钥',
      category: 'api'
    },
    OPENAI_API_KEY: {
      type: 'string',
      description: 'OpenAI API密钥',
      category: 'api'
    },
    GOOGLE_TRANSLATE_API_KEY: {
      type: 'string',
      description: 'Google翻译API密钥',
      category: 'api'
    }
  }
};

// Get all variable names by category
function getAllVarNames() {
  return {
    editable: Object.keys(ENV_CONFIG.editable),
    readOnly: Object.keys(ENV_CONFIG.readOnly),
    sensitive: Object.keys(ENV_CONFIG.sensitive)
  };
}

/**
 * Mask sensitive value for display
 */
function maskValue(value) {
  if (!value || value.length <= 8) {
    return '****';
  }
  return value.substring(0, 4) + '****' + value.substring(value.length - 4);
}

/**
 * Parse .env file content into key-value pairs
 */
function parseEnvFile(content) {
  const lines = content.split('\n');
  const envVars = {};
  const comments = {};

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    // Skip empty lines
    if (!trimmedLine) return;

    // Store comments
    if (trimmedLine.startsWith('#')) {
      comments[index] = trimmedLine;
      return;
    }

    // Parse key=value
    const equalIndex = trimmedLine.indexOf('=');
    if (equalIndex > 0) {
      const key = trimmedLine.substring(0, equalIndex).trim();
      const value = trimmedLine.substring(equalIndex + 1).trim();
      // Remove quotes if present
      const cleanValue = value.replace(/^["']|["']$/g, '');
      envVars[key] = cleanValue;
    }
  });

  return { envVars, comments };
}

/**
 * Build .env file content from variables and comments
 */
function buildEnvFile(envVars, comments) {
  const lines = [];
  const processedKeys = new Set();

  // Reconstruct with original comments
  let commentIndex = 0;
  const sortedComments = Object.entries(comments).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

  for (const [index, comment] of sortedComments) {
    lines.push(comment);
  }

  // Add all environment variables
  const allVarNames = [...Object.keys(ENV_CONFIG.editable), ...Object.keys(ENV_CONFIG.readOnly), ...Object.keys(ENV_CONFIG.sensitive)];

  // Group by category for better organization
  const categories = {
    server: '======== 基础配置 ========',
    database: '======== 数据库配置 ========',
    llm: '======== LLM 配置 ========',
    embedding: '======== Embedding 配置 ========',
    api: '======== API 密钥 ========',
    security: '======== 安全配置 ========',
    frontend: '======== 前端配置 ========'
  };

  let lastCategory = '';
  for (const key of allVarNames) {
    if (envVars[key] !== undefined) {
      const config = [...Object.entries(ENV_CONFIG.editable), ...Object.entries(ENV_CONFIG.readOnly), ...Object.entries(ENV_CONFIG.sensitive)]
        .find(([k]) => k === key);

      if (config) {
        const [, conf] = config;
        if (conf.category !== lastCategory && categories[conf.category]) {
          lines.push('');
          lines.push(categories[conf.category]);
          lastCategory = conf.category;
        }
      }

      lines.push(`${key}=${envVars[key]}`);
      processedKeys.add(key);
    }
  }

  return lines.join('\n') + '\n';
}

/**
 * Validate a variable value against its config
 */
function validateVariable(key, value, config) {
  if (!config) {
    return { valid: false, error: '未知的环境变量' };
  }

  // Type validation
  switch (config.type) {
    case 'number':
      const num = parseFloat(value);
      if (isNaN(num)) {
        return { valid: false, error: '必须是数字' };
      }
      if (config.min !== undefined && num < config.min) {
        return { valid: false, error: `最小值为 ${config.min}` };
      }
      if (config.max !== undefined && num > config.max) {
        return { valid: false, error: `最大值为 ${config.max}` };
      }
      break;

    case 'enum':
      if (!config.values.includes(value)) {
        return { valid: false, error: `必须是以下值之一: ${config.values.join(', ')}` };
      }
      break;

    case 'url':
      try {
        new URL(value);
      } catch {
        return { valid: false, error: '必须是有效的URL' };
      }
      break;
  }

  return { valid: true };
}

class EnvVarService {
  constructor() {
    // Resolve .env path from project root
    this.envPath = path.join(process.cwd(), '.env');
    this.backupPath = path.join(process.cwd(), '.env.backup');
  }

  /**
   * Read and parse .env file
   */
  async readEnvFile() {
    try {
      const content = await fs.readFile(this.envPath, 'utf-8');
      return parseEnvFile(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, return empty
        return { envVars: {}, comments: {} };
      }
      throw error;
    }
  }

  /**
   * Create backup of .env file
   */
  async createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${this.backupPath}.${timestamp}`;

      await fs.copyFile(this.envPath, backupPath);

      logger.info(`[EnvVarService] Backup created: ${backupPath}`);

      // Clean up old backups (keep last 5)
      await this.cleanupOldBackups();

      return backupPath;
    } catch (error) {
      logger.error('[EnvVarService] Backup creation failed:', error);
      throw new Error('备份创建失败');
    }
  }

  /**
   * Clean up old backup files (keep last 5)
   */
  async cleanupOldBackups() {
    try {
      const backupDir = path.dirname(this.backupPath);
      const backupBase = path.basename(this.backupPath);

      const files = await fs.readdir(backupDir);
      const backups = files
        .filter(f => f.startsWith(`${backupBase}.`))
        .sort()
        .reverse();

      // Remove backups beyond the last 5
      for (let i = 5; i < backups.length; i++) {
        await fs.unlink(path.join(backupDir, backups[i]));
      }
    } catch (error) {
      logger.warn('[EnvVarService] Backup cleanup failed:', error);
    }
  }

  /**
   * Get all environment variables with metadata
   */
  async getEnvironmentVariables() {
    const { envVars } = await this.readEnvFile();

    const result = {
      editable: {},
      readOnly: {},
      sensitive: {}
    };

    // Process editable variables
    for (const [key, config] of Object.entries(ENV_CONFIG.editable)) {
      result.editable[key] = {
        value: envVars[key] || config.default,
        default: config.default,
        description: config.description,
        category: config.category,
        type: config.type,
        ...(config.type === 'enum' && { options: config.values }),
        ...(config.type === 'number' && {
          min: config.min,
          max: config.max,
          ...(config.step && { step: config.step })
        })
      };
    }

    // Process read-only variables
    for (const [key, config] of Object.entries(ENV_CONFIG.readOnly)) {
      let value = envVars[key] || config.default;

      // Mask sensitive read-only values
      if (key === 'JWT_SECRET' || key === 'MONGO_URI') {
        value = this.maskSensitiveValue(key, value);
      }

      result.readOnly[key] = {
        value,
        default: config.default,
        description: config.description,
        category: config.category,
        type: config.type,
        ...(config.type === 'enum' && { options: config.values })
      };
    }

    // Process sensitive variables
    for (const [key, config] of Object.entries(ENV_CONFIG.sensitive)) {
      const value = envVars[key];

      result.sensitive[key] = {
        value: value ? maskValue(value) : '',
        isSet: !!value,
        default: config.default,
        description: config.description,
        category: config.category,
        type: config.type
      };
    }

    return result;
  }

  /**
   * Mask sensitive values appropriately
   */
  maskSensitiveValue(key, value) {
    if (!value) return '';

    if (key === 'MONGO_URI') {
      // Mask password in MongoDB URI
      return value.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
    }

    if (key === 'JWT_SECRET') {
      return maskValue(value);
    }

    return value;
  }

  /**
   * Update environment variables
   */
  async updateEnvironmentVariables(updates, options = {}) {
    const { backup = true, skipValidation = false } = options;

    // Read current .env file
    const { envVars, comments } = await this.readEnvFile();

    // Validate all updates
    const errors = [];
    const validatedUpdates = {};

    for (const [key, { value }] of Object.entries(updates)) {
      // Find config for this variable
      const config = ENV_CONFIG.editable[key] || ENV_CONFIG.sensitive[key];

      if (!config) {
        errors.push({ key, error: '不可编辑的变量' });
        continue;
      }

      // Validate value
      if (!skipValidation) {
        const validation = validateVariable(key, value, config);
        if (!validation.valid) {
          errors.push({ key, error: validation.error });
          continue;
        }
      }

      validatedUpdates[key] = value;
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // Create backup if requested
    if (backup) {
      await this.createBackup();
    }

    // Apply updates
    for (const [key, value] of Object.entries(validatedUpdates)) {
      envVars[key] = value;
    }

    // Write back to .env file
    const newContent = buildEnvFile(envVars, comments);
    await fs.writeFile(this.envPath, newContent, 'utf-8');

    // Update process.env for current process
    for (const [key, value] of Object.entries(validatedUpdates)) {
      process.env[key] = value;
    }

    logger.info('[EnvVarService] Environment variables updated:', {
      keys: Object.keys(validatedUpdates)
    });

    return {
      success: true,
      updated: Object.keys(validatedUpdates),
      message: '环境变量已更新，需要重启服务以应用更改'
    };
  }

  /**
   * Validate a single variable without updating
   */
  validateVariable(key, value) {
    const config = ENV_CONFIG.editable[key] || ENV_CONFIG.sensitive[key];

    if (!config) {
      return { valid: false, error: '未知的变量或不可编辑' };
    }

    return validateVariable(key, value, config);
  }

  /**
   * Get environment variable configuration schema
   */
  getSchema() {
    return {
      editable: ENV_CONFIG.editable,
      readOnly: ENV_CONFIG.readOnly,
      sensitive: ENV_CONFIG.sensitive
    };
  }

  /**
   * Restore .env from backup
   */
  async restoreFromBackup(backupPath) {
    try {
      await fs.copyFile(backupPath, this.envPath);
      logger.info(`[EnvVarService] Restored from backup: ${backupPath}`);

      return { success: true, message: '已从备份恢复' };
    } catch (error) {
      logger.error('[EnvVarService] Restore from backup failed:', error);
      throw new Error('备份恢复失败');
    }
  }

  /**
   * List available backups
   */
  async listBackups() {
    try {
      const backupDir = path.dirname(this.backupPath);
      const backupBase = path.basename(this.backupPath);

      const files = await fs.readdir(backupDir);
      const backups = files
        .filter(f => f.startsWith(`${backupBase}.`))
        .map(f => {
          const filePath = path.join(backupDir, f);
          return {
            filename: f,
            path: filePath,
            createdAt: f.replace(`${backupBase}.`, '').replace(/-/g, ':')
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 10); // Last 10 backups

      return backups;
    } catch (error) {
      logger.error('[EnvVarService] List backups failed:', error);
      return [];
    }
  }
}

export default new EnvVarService();
