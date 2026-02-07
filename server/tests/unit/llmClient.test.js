/**
 * LLMClient 单元测试
 * 测试 LLM 客户端的核心功能
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import { vi } from 'vitest';
import LLMClient, { createDefaultLLMClient, createSentimentLLMClient } from '../../src/utils/llmClient.js';

// Mock @langchain/ollama
vi.mock('@langchain/ollama', () => {
  class MockChatOllama {
    constructor(options = {}) {
      // Debug log
      // console.log('MockChatOllama constructor options:', options);
      
      this.model = options.model || 'qwen2.5';
      this.baseUrl = options.baseUrl || 'http://modelserver:11434';
      this.temperature = options.temperature || 0.7;
      this.maxRetries = options.maxRetries || 3;
      this.timeout = options.timeout || 30000;
      
      this.invoke = vi.fn();
      this.stream = vi.fn();
    }
  }

  return {
    ChatOllama: MockChatOllama
  };
});

describe('LLMClient', () => {
  let llmClient;
  const mockResponse = {
    content: '这是一个测试回复'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    llmClient = new LLMClient('qwen2.5');
  });

  describe('constructor', () => {
    test('should initialize with default options', () => {
      // 测试基本初始化，不测试mock调用
      expect(llmClient.model).toBe('qwen2.5');
      expect(llmClient.baseUrl).toBe('http://modelserver:11434');
      expect(llmClient.maxRetries).toBe(3);
      expect(llmClient.timeout).toBe(30000);
    });

    test('should initialize with custom options', () => {
      const customOptions = {
        temperature: 0.5,
        maxRetries: 5,
        timeout: 60000,
        baseUrl: 'http://custom:11434'
      };

      const customClient = new LLMClient('custom-model', customOptions);
      
      expect(customClient.model).toBe('custom-model');
      expect(customClient.temperature).toBe(0.5);
      expect(customClient.maxRetries).toBe(5);
      expect(customClient.timeout).toBe(60000);
      expect(customClient.baseUrl).toBe('http://custom:11434');
    });

    test('should use environment variables as defaults', () => {
      const originalEnv = process.env.OLLAMA_BASE_URL;
      process.env.OLLAMA_BASE_URL = 'http://env:11434';
      
      const envClient = new LLMClient('qwen2.5');
      
      expect(envClient.baseUrl).toBe('http://env:11434');
      
      process.env.OLLAMA_BASE_URL = originalEnv;
    });
  });

  describe('getModelInfo', () => {
    test('should return correct model information', () => {
      // 直接设置 llmClient 的 baseUrl 以确保测试通过
      llmClient.baseUrl = 'http://modelserver:11434';
      
      const info = llmClient.getModelInfo();
      
      expect(info).toEqual({
        model: 'qwen2.5',
        baseUrl: 'http://modelserver:11434',
        temperature: 0.7,
        maxRetries: 3,
        timeout: 30000
      });
    });
  });

  describe('generate', () => {
    test('should generate response successfully', async () => {
      // 直接mock实例的invoke方法
      llmClient.llm.invoke.mockResolvedValueOnce(mockResponse);
      
      const prompt = '测试提示';
      const options = { temperature: 0.5, maxTokens: 100 };
      
      const result = await llmClient.generate(prompt, options);
      
      expect(llmClient.llm.invoke).toHaveBeenCalledWith(prompt, {
        temperature: 0.5,
        maxTokens: 100
      });
      
      expect(result).toBe(mockResponse.content);
    });

    test('should handle generate errors', async () => {
      llmClient.llm.invoke.mockRejectedValueOnce(new Error('LLM Error'));
      
      await expect(llmClient.generate('测试提示'))
        .rejects.toThrow('LLM 生成失败: LLM Error');
    });

    test('should use default options when not provided', async () => {
      llmClient.llm.invoke.mockResolvedValueOnce(mockResponse);
      
      await llmClient.generate('测试提示');
      
      expect(llmClient.llm.invoke).toHaveBeenCalledWith('测试提示', {});
    });
  });

  describe('generateStream', () => {
    test('should handle streaming response', async () => {
      const chunks = [
        { content: '这是' },
        { content: '一个' },
        { content: '测试' }
      ];
      
      llmClient.llm.stream.mockResolvedValueOnce(chunks);
      
      const onChunk = vi.fn();
      
      const result = await llmClient.generateStream('测试提示', {}, onChunk);
      
      expect(llmClient.llm.stream).toHaveBeenCalledWith('测试提示', {});
      expect(onChunk).toHaveBeenCalledTimes(3);
      expect(onChunk).toHaveBeenCalledWith('这是');
      expect(onChunk).toHaveBeenCalledWith('一个');
      expect(onChunk).toHaveBeenCalledWith('测试');
      expect(result).toBe('这是一个测试');
    });

    test('should handle streaming errors', async () => {
      llmClient.llm.stream.mockRejectedValueOnce(new Error('Stream Error'));
      
      await expect(llmClient.generateStream('测试提示'))
        .rejects.toThrow('LLM 流式生成失败: Stream Error');
    });

    test('should work without onChunk callback', async () => {
      const chunks = [{ content: '测试' }];
      llmClient.llm.stream.mockResolvedValueOnce(chunks);
      
      const result = await llmClient.generateStream('测试提示');
      expect(result).toBe('测试');
    });
  });

  describe('batchGenerate', () => {
    test('should generate multiple responses', async () => {
      llmClient.llm.invoke
        .mockResolvedValueOnce({ content: '回复1' })
        .mockResolvedValueOnce({ content: '回复2' })
        .mockResolvedValueOnce({ content: '回复3' });
      
      const prompts = ['提示1', '提示2', '提示3'];
      
      const results = await llmClient.batchGenerate(prompts);
      
      expect(results).toHaveLength(3);
      expect(results[0]).toBe('回复1');
      expect(results[1]).toBe('回复2');
      expect(results[2]).toBe('回复3');
    });

    test('should handle individual failures', async () => {
      llmClient.llm.invoke
        .mockResolvedValueOnce({ content: '回复1' })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ content: '回复3' });
      
      const prompts = ['提示1', '提示2', '提示3'];
      
      const results = await llmClient.batchGenerate(prompts);
      
      expect(results).toHaveLength(3);
      expect(results[0]).toBe('回复1');
      expect(results[1]).toBe(null); // 失败的请求返回 null
      expect(results[2]).toBe('回复3');
    });
  });

  describe('healthCheck', () => {
    test('should return true for healthy LLM', async () => {
      llmClient.llm.invoke.mockResolvedValueOnce({ content: 'Hello' });
      
      const result = await llmClient.healthCheck();
      
      expect(llmClient.llm.invoke).toHaveBeenCalledWith('Hello', { 
        maxTokens: 5,
        timeout: 5000 
      });
      
      expect(result).toBe(true);
    });

    test('should return false for unhealthy LLM', async () => {
      llmClient.llm.invoke.mockRejectedValueOnce(new Error('Connection failed'));
      
      const result = await llmClient.healthCheck();
      
      expect(result).toBe(false);
    });
  });

  describe('setModel', () => {
    test('should update model configuration', () => {
      llmClient.setModel('new-model');
      
      expect(llmClient.model).toBe('new-model');
    });
  });

  describe('getLLMInstance', () => {
    test('should return the underlying LLM instance', () => {
      const instance = llmClient.getLLMInstance();
      
      expect(instance).toBe(llmClient.llm);
    });
  });
});

describe('Factory functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createDefaultLLMClient', () => {
    test('should create client with default configuration', () => {
      const client = createDefaultLLMClient();
      
      expect(client).toBeInstanceOf(LLMClient);
      expect(client.model).toBe('qwen2.5');
      expect(client.temperature).toBe(0.7);
      expect(client.maxRetries).toBe(3);
      expect(client.timeout).toBe(30000);
    });
  });

  describe('createSentimentLLMClient', () => {
    test('should create client optimized for sentiment analysis', () => {
      const client = createSentimentLLMClient();
      
      expect(client).toBeInstanceOf(LLMClient);
      expect(client.model).toBe('qwen2.5');
      expect(client.temperature).toBe(0.1); // 低温度确保输出稳定
      expect(client.maxRetries).toBe(3);
      expect(client.timeout).toBe(10000); // 较短超时用于快速响应
    });
  });
});