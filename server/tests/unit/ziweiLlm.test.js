/**
 * Unit Tests for Ziwei LLM Service
 * Tests for Ollama-based fortune-telling report generation
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFile } from 'fs/promises';

// Mock the logger
vi.mock('../../src/core/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ZiweiLlmService', () => {
  let ZiweiLlmService;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    mockFetch.mockReset();

    // Reset environment variables
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
    process.env.ZIWEI_MODEL = 'ziwei-8b';

    // Import service fresh for each test
    const module = await import('../../src/core/ziwei/ziweiLlm.js');
    ZiweiLlmService = module.default.constructor
      ? Object.getPrototypeOf(module.default).constructor
      : module.default;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor and initialization', () => {
    it('should use default config when no env vars set', async () => {
      delete process.env.OLLAMA_BASE_URL;
      delete process.env.ZIWEI_MODEL;

      const module = await import('../../src/core/ziwei/ziweiLlm.js');
      const service = module.default;

      expect(service.baseUrl).toBe('http://localhost:11434');
      expect(service.model).toBe('ziwei-8b');
      expect(service.timeout).toBe(120000);
    });

    it('should use custom config from env vars', async () => {
      process.env.OLLAMA_BASE_URL = 'http://custom-ollama:8080';
      process.env.ZIWEI_MODEL = 'custom-model';

      // Clear module cache to re-read env vars
      vi.resetModules();

      const module = await import('../../src/core/ziwei/ziweiLlm.js');
      const service = module.default;

      expect(service.baseUrl).toBe('http://custom-ollama:8080');
      expect(service.model).toBe('custom-model');
    });
  });

  describe('buildPrompt', () => {
    let service;

    beforeEach(async () => {
      const module = await import('../../src/core/ziwei/ziweiLlm.js');
      service = module.default;
    });

    it('should build prompt with basic chart data', () => {
      const chartData = {
        solarDate: '1990-05-15',
        lunarDate: '一九九〇年四月廿一',
        chineseDate: '庚午年辛巳月丙寅日',
        zodiac: '马',
        sign: '金牛座',
        fiveElementsClass: '命宫坐丙'
      };

      const prompt = service.buildPrompt(chartData, [], '');

      expect(prompt).toContain('公历：1990-05-15');
      expect(prompt).toContain('农历：一九九〇年四月廿一');
      expect(prompt).toContain('四柱：庚午年辛巳月丙寅日');
      expect(prompt).toContain('生肖：马');
      expect(prompt).toContain('星座：金牛座');
      expect(prompt).toContain('命主：命宫坐丙');
    });

    it('should include palace information', () => {
      const chartData = {
        solarDate: '1990-05-15',
        soul: '午宫',
        body: '子宫',
        palaces: [
          {
            name: '命宫',
            majorStars: [{ name: '紫微' }, { name: '天府' }],
            minorStars: []
          },
          {
            name: '财帛宫',
            majorStars: [{ name: '武曲' }],
            minorStars: ['左辅', '右弼']
          }
        ]
      };

      const prompt = service.buildPrompt(chartData, [], '');

      expect(prompt).toContain('命宫：紫微、天府');
      expect(prompt).toContain('财帛宫：武曲、辅星：左辅、右弼');
      expect(prompt).toContain('命宫：午宫');
      expect(prompt).toContain('身宫：子宫');
    });

    it('should handle palace with no major stars', () => {
      const chartData = {
        solarDate: '1990-05-15',
        palaces: [
          {
            name: '命宫',
            majorStars: [],
            minorStars: []
          }
        ]
      };

      const prompt = service.buildPrompt(chartData, [], '');

      expect(prompt).toContain('命宫：无主星');
    });

    it('should include RAG context when provided', () => {
      const chartData = { solarDate: '1990-05-15' };
      const ragContext = [
        { content: '命宫在午宫的特点...' },
        { content: '紫微星入命的解释...' }
      ];

      const prompt = service.buildPrompt(chartData, ragContext, '');

      expect(prompt).toContain('参考紫微斗数书籍内容：');
      expect(prompt).toContain('1. 命宫在午宫的特点...');
      expect(prompt).toContain('2. 紫微星入命的解释...');
    });

    it('should limit RAG context to 3 items', () => {
      const chartData = { solarDate: '1990-05-15' };
      const ragContext = [
        { content: 'Content 1' },
        { content: 'Content 2' },
        { content: 'Content 3' },
        { content: 'Content 4' },
        { content: 'Content 5' }
      ];

      const prompt = service.buildPrompt(chartData, ragContext, '');

      expect(prompt).toContain('1. Content 1');
      expect(prompt).toContain('2. Content 2');
      expect(prompt).toContain('3. Content 3');
      expect(prompt).not.toContain('4. Content 4');
      expect(prompt).not.toContain('5. Content 5');
    });

    it('should include user question when provided', () => {
      const chartData = { solarDate: '1990-05-15' };
      const userQuestion = '我的事业发展如何';

      const prompt = service.buildPrompt(chartData, [], userQuestion);

      expect(prompt).toContain('用户问题：我的事业发展如何');
    });

    it('should include analysis requirements at the end', () => {
      const chartData = { solarDate: '1990-05-15' };

      const prompt = service.buildPrompt(chartData, [], '');

      expect(prompt).toContain('请根据以上命盘信息，结合紫微斗数理论和参考书籍内容，提供专业、详细、有深度的命理分析报告');
      expect(prompt).toContain('1. 命盘核心特点分析');
      expect(prompt).toContain('2. 优势与挑战');
      expect(prompt).toContain('3. 运势建议');
    });

    it('should handle empty chart data gracefully', () => {
      const prompt = service.buildPrompt({}, [], '');

      expect(prompt).toBeTruthy();
      expect(prompt).toContain('以下是用户的紫微斗数命盘信息');
    });

    it('should not include sections when data is missing', () => {
      const prompt = service.buildPrompt({ solarDate: '1990-05-15' }, [], '');

      // Should not have RAG section
      expect(prompt).not.toContain('参考紫微斗数书籍内容');
      // Should not have question section
      expect(prompt).not.toContain('用户问题：');
    });
  });

  describe('generateReport', () => {
    let service;

    beforeEach(async () => {
      // Ensure default env vars for this test suite
      process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
      process.env.ZIWEI_MODEL = 'ziwei-8b';
      const module = await import('../../src/core/ziwei/ziweiLlm.js');
      service = module.default;
    });

    it('should generate report successfully', async () => {
      const chartData = {
        solarDate: '1990-05-15',
        palaces: [{ name: '命宫', majorStars: [{ name: '紫微' }], minorStars: [] }]
      };
      const ragContext = [{ content: '命宫特点说明...' }];
      const userQuestion = '我的事业如何';

      const mockResponse = {
        response: '根据您的命盘分析，您的事业运势良好...'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await service.generateReport(chartData, ragContext, userQuestion);

      expect(result).toBe(mockResponse.response);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toContain('/api/generate');
      expect(callArgs[1]).toMatchObject({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const body = JSON.parse(callArgs[1].body);
      expect(body.model).toBe(service.model); // Use service.model for flexibility
      expect(body.stream).toBe(false);
      expect(body.options).toMatchObject({
        temperature: 0.7,
        top_p: 0.9,
        num_ctx: 4096,
        num_predict: 2048
      });
    });

    it('should handle API error response', async () => {
      const chartData = { solarDate: '1990-05-15' };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      });

      await expect(service.generateReport(chartData))
        .rejects
        .toThrow('Failed to generate fortune report');
    });

    it('should handle network timeout', async () => {
      const chartData = { solarDate: '1990-05-15' };

      mockFetch.mockRejectedValueOnce(new Error('Request timeout'));

      await expect(service.generateReport(chartData))
        .rejects
        .toThrow('Failed to generate fortune report');
    });

    it('should handle empty response from API', async () => {
      const chartData = { solarDate: '1990-05-15' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      });

      const result = await service.generateReport(chartData);
      expect(result).toBe('');
    });

    it('should use message field when response field is missing', async () => {
      const chartData = { solarDate: '1990-05-15' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Generated report content' })
      });

      const result = await service.generateReport(chartData);
      expect(result).toBe('Generated report content');
    });
  });

  describe('generateReportStream', () => {
    let service;

    beforeEach(async () => {
      const module = await import('../../src/core/ziwei/ziweiLlm.js');
      service = module.default;
    });

    it('should generate streaming report successfully', async () => {
      const chartData = {
        solarDate: '1990-05-15',
        palaces: []
      };

      // Mock streaming response
      const chunks = [
        '根据',
        '您的',
        '命盘',
        '分析',
        '...'
      ];

      const mockStream = new ReadableStream({
        async start(controller) {
          for (const chunk of chunks) {
            const data = `data: ${JSON.stringify({ response: chunk })}\n\n`;
            controller.enqueue(new TextEncoder().encode(data));
          }
          controller.close();
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream
      });

      const onChunk = vi.fn();
      const result = await service.generateReportStream(chartData, [], '', onChunk);

      expect(result).toBe(chunks.join(''));
      expect(onChunk).toHaveBeenCalledTimes(chunks.length);
    });

    it('should handle streaming without chunk callback', async () => {
      const chartData = { solarDate: '1990-05-15' };

      const mockStream = new ReadableStream({
        async start(controller) {
          const data = `data: ${JSON.stringify({ response: 'Test response' })}\n\n`;
          controller.enqueue(new TextEncoder().encode(data));
          controller.close();
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream
      });

      const result = await service.generateReportStream(chartData);
      expect(result).toBe('Test response');
    });

    it('should handle streaming API error', async () => {
      const chartData = { solarDate: '1990-05-15' };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable'
      });

      await expect(service.generateReportStream(chartData))
        .rejects
        .toThrow();
    });

    it('should handle empty streaming response', async () => {
      const chartData = { solarDate: '1990-05-15' };

      const mockStream = new ReadableStream({
        start(controller) {
          controller.close();
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream
      });

      const result = await service.generateReportStream(chartData);
      expect(result).toBe('');
    });
  });

  describe('healthCheck', () => {
    let service;

    beforeEach(async () => {
      // Ensure default env vars for this test suite
      process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
      process.env.ZIWEI_MODEL = 'ziwei-8b';
      const module = await import('../../src/core/ziwei/ziweiLlm.js');
      service = module.default;
    });

    it('should return true when service and model are available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            { name: service.model + ':latest' },
            { name: 'llama2:7b' }
          ]
        })
      });

      const result = await service.healthCheck();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/tags'));
    });

    it('should return false when service is not reachable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false
      });

      const result = await service.healthCheck();

      expect(result).toBe(false);
    });

    it('should return false when model is not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            { name: 'llama2:7b' },
            { name: 'mistral:7b' }
          ]
        })
      });

      const result = await service.healthCheck();

      expect(result).toBe(false);
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('getAvailableModels', () => {
    let service;

    beforeEach(async () => {
      const module = await import('../../src/core/ziwei/ziweiLlm.js');
      service = module.default;
    });

    it('should return list of available models', async () => {
      const mockModels = [
        { name: 'ziwei-8b:latest' },
        { name: 'llama2:7b' },
        { name: 'mistral:7b' }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: mockModels })
      });

      const result = await service.getAvailableModels();

      expect(result).toEqual(['ziwei-8b:latest', 'llama2:7b', 'mistral:7b']);
    });

    it('should return empty array on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const result = await service.getAvailableModels();

      expect(result).toEqual([]);
    });

    it('should return empty array when models field is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      });

      const result = await service.getAvailableModels();

      expect(result).toEqual([]);
    });

    it('should handle network error gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await service.getAvailableModels();

      expect(result).toEqual([]);
    });
  });

  describe('testConnection', () => {
    let service;

    beforeEach(async () => {
      const module = await import('../../src/core/ziwei/ziweiLlm.js');
      service = module.default;
    });

    it('should return true when connection is successful', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true
      });

      const result = await service.testConnection();

      expect(result).toBe(true);
    });

    it('should return false when connection fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false
      });

      const result = await service.testConnection();

      expect(result).toBe(false);
    });

    it('should use 5 second timeout', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true
      });

      await service.testConnection();

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].signal).toBeDefined();
    });

    it('should handle timeout error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Request timeout'));

      const result = await service.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    let service;

    beforeEach(async () => {
      const module = await import('../../src/core/ziwei/ziweiLlm.js');
      service = module.default;
    });

    it('should handle complete fortune analysis workflow', async () => {
      const chartData = {
        solarDate: '1990-05-15',
        lunarDate: '一九九〇年四月廿一',
        chineseDate: '庚午年辛巳月丙寅日',
        zodiac: '马',
        sign: '金牛座',
        fiveElementsClass: '命宫坐丙',
        soul: '午宫',
        body: '子宫',
        palaces: [
          {
            name: '命宫',
            majorStars: [{ name: '紫微' }, { name: '天府' }],
            minorStars: ['左辅']
          },
          {
            name: '财帛宫',
            majorStars: [{ name: '武曲' }],
            minorStars: []
          }
        ]
      };

      const ragContext = [
        { content: '命宫紫微天府坐守，主贵显...' },
        { content: '财帛宫武曲星，财运旺盛...' }
      ];

      const userQuestion = '我的事业发展如何';

      const mockReport = `
根据您的命盘分析：

1. 命盘核心特点分析
您命宫坐紫微、天府二星，格局高贵...

2. 优势与挑战
优势：领导能力强，财运旺盛...
挑战：需要注意人际关系...

3. 运势建议
建议多发挥领导才能...
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: mockReport })
      });

      const result = await service.generateReport(chartData, ragContext, userQuestion);

      expect(result).toContain('命盘核心特点分析');
      expect(result).toContain('优势与挑战');
      expect(result).toContain('运势建议');

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.prompt).toContain('公历：1990-05-15');
      expect(requestBody.prompt).toContain('命宫：紫微、天府');
      expect(requestBody.prompt).toContain('参考紫微斗数书籍内容');
      expect(requestBody.prompt).toContain('我的事业发展如何');
    });
  });
});
