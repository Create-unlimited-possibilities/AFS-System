/**
 * LLM 配置和多客户端集成测试
 * 测试 LLM 配置管理和多客户端降级机制
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 设置测试环境变量
const testEnvVars = {
  NODE_ENV: 'test',
  USE_API_LLM: 'false',
  OLLAMA_BASE_URL: 'http://localhost:11434',
  OLLAMA_MODEL: 'qwen2.5',
  OLLAMA_MODEL_PATH: './test-models',
  LLM_FALLBACK_STRATEGY: 'local',
  LLM_TIMEOUT: '5000',
  LLM_MAX_RETRIES: '1',
  LLM_TEMPERATURE: '0.5'
};

// 保存原始环境变量
const originalEnv = { ...process.env };

describe('LLM 配置和多客户端集成测试', () => {
  let LLMConfig, MultiLLMClient, llmConfig, multiLLMClient;
  let tempDir;

  beforeEach(async () => {
    // 设置测试环境变量
    Object.assign(process.env, testEnvVars);
    
    // 创建临时目录用于测试
    tempDir = path.join(__dirname, 'temp', Date.now().toString());
    await fs.mkdir(tempDir, { recursive: true });
    
    // 动态导入模块以确保使用最新的环境变量
    const LLMConfigModule = await import('../../src/services/langchain/llmConfig.js');
    const MultiLLMClientModule = await import('../../src/services/langchain/multiLLMClient.js');
    
    LLMConfig = LLMConfigModule.default;
    MultiLLMClient = MultiLLMClientModule.default;
    llmConfig = LLMConfigModule.llmConfig;
    multiLLMClient = MultiLLMClientModule.multiLLMClient;
    
    // 清除日志输出
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    // 恢复原始环境变量
    Object.assign(process.env, originalEnv);
    
    // 清理临时目录
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('清理临时目录失败:', error.message);
      }
    }
    
    // 恢复日志输出
    vi.restoreAllMocks();
  });

  describe('LLM 配置管理', () => {
    it('应该正确加载默认配置', () => {
      const config = llmConfig.getConfig();
      
      expect(config.useApiLLM).toBe(false);
      expect(config.ollamaBaseUrl).toBe('http://localhost:11434');
      expect(config.ollamaModel).toBe('qwen2.5');
      expect(config.fallbackStrategy).toBe('local');
      expect(config.timeout).toBe(5000);
      expect(config.maxRetries).toBe(1);
      expect(config.temperature).toBe(0.5);
    });

    it('应该正确验证配置', () => {
      // 不应该抛出错误
      expect(() => llmConfig._validateConfig()).not.toThrow();
    });

    it('应该在无效配置时抛出错误', async () => {
      // 设置无效的降级策略
      process.env.LLM_FALLBACK_STRATEGY = 'invalid';
      
      // 重新导入模块
      const { default: LLMConfigInvalid } = await import('../../src/services/langchain/llmConfig.js');
      
      expect(() => new LLMConfigInvalid()).toThrow('无效的降级策略');
    });

    it('应该正确获取 API 和本地配置', () => {
      const apiConfig = llmConfig.getApiLLMConfig();
      const ollamaConfig = llmConfig.getOllamaConfig();
      
      expect(apiConfig).toBeNull(); // 因为 useApiLLM = false
      
      expect(ollamaConfig).toEqual({
        baseUrl: 'http://localhost:11434',
        model: 'qwen2.5',
        modelPath: './test-models',
        timeout: 5000,
        maxRetries: 1,
        temperature: 0.5
      });
    });

    it('应该正确识别可用的客户端', () => {
      expect(llmConfig.isApiLLMAvailable()).toBe(false);
      expect(llmConfig.isOllamaAvailable()).toBe(true);
    });

    it('应该正确确定首选客户端', () => {
      expect(llmConfig.getPreferredLLM()).toBe('local');
    });

    it('应该正确获取降级顺序', () => {
      expect(llmConfig.getFallbackOrder()).toEqual(['local']);
    });
  });

  describe('多客户端管理', () => {
    it('应该正确初始化客户端', () => {
      const clientInfo = multiLLMClient.getAllClientsInfo();
      
      expect(clientInfo.local.available).toBe(true);
      expect(clientInfo.api.available).toBe(false);
      expect(clientInfo.preferred).toBe('local');
      expect(clientInfo.fallbackStrategy).toBe('local');
    });

    it('应该正确获取当前客户端信息', () => {
      const currentInfo = multiLLMClient.getCurrentClientInfo();
      
      expect(currentInfo.type).toBe('local');
      expect(currentInfo.info).toBeDefined();
      expect(currentInfo.fallbackOrder).toEqual(['local']);
    });
  });

  describe('API 优先策略测试', () => {
    it('应该支持 API 优先策略', () => {
      // 更新环境变量
      Object.assign(process.env, {
        USE_API_LLM: 'true',
        API_LLM_KEY: 'test-api-key',
        LLM_FALLBACK_STRATEGY: 'api-local'
      });
      
      // 直接创建新的LLMConfig实例，避免模块缓存问题
      const newConfig = new LLMConfig();
      
      expect(newConfig.getPreferredLLM()).toBe('api');
      expect(newConfig.getFallbackOrder()).toEqual(['api', 'local']);
    });
  });

  describe('本地优先策略测试', () => {
    it('应该支持本地优先策略', () => {
      // 更新环境变量
      Object.assign(process.env, {
        USE_API_LLM: 'true',
        API_LLM_KEY: 'test-api-key',
        LLM_FALLBACK_STRATEGY: 'local-api'
      });
      
      // 直接创建新的LLMConfig实例，避免模块缓存问题
      const newConfig = new LLMConfig();
      
      expect(newConfig.getPreferredLLM()).toBe('local');
      expect(newConfig.getFallbackOrder()).toEqual(['local', 'api']);
    });
  });

  describe('配置验证测试', () => {
    it('应该在超时时间无效时抛出错误', () => {
      process.env.LLM_TIMEOUT = '500'; // 小于最小值 1000
      
      try {
        new LLMConfig();
        expect.fail('应该抛出错误');
      } catch (error) {
        expect(error.message).toContain('LLM_TIMEOUT 应在 1000-300000ms 之间');
      }
    });

    it('应该在重试次数无效时抛出错误', () => {
      process.env.LLM_MAX_RETRIES = '11'; // 大于最大值 10
      
      try {
        new LLMConfig();
        expect.fail('应该抛出错误');
      } catch (error) {
        expect(error.message).toContain('LLM_MAX_RETRIES 应在 0-10 之间');
      }
    });

    it('应该在温度参数无效时抛出错误', () => {
      process.env.LLM_TEMPERATURE = '2.5'; // 大于最大值 2
      
      try {
        new LLMConfig();
        expect.fail('应该抛出错误');
      } catch (error) {
        expect(error.message).toContain('LLM_TEMPERATURE 应在 0-2 之间');
      }
    });

    it('应该在缺少 API key 时抛出错误', () => {
      process.env.USE_API_LLM = 'true';
      process.env.API_LLM_KEY = ''; // 空的 API key
      
      try {
        new LLMConfig();
        expect.fail('应该抛出错误');
      } catch (error) {
        expect(error.message).toContain('USE_API_LLM=true 时必须提供 API_LLM_KEY');
      }
    });
  });
});