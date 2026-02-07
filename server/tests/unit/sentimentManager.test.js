/**
 * SentimentManager 单元测试
 * 测试好感度管理器的核心功能
 * 
 * @author AFS Team
 * @version 3.0.0
 */

import { vi } from 'vitest';

// Mock User 模型
vi.mock('../../src/models/User.js', () => {
  class MockUser {
    constructor(data) {
      this._id = data._id;
      this.companionChat = data.companionChat;
      this.save = vi.fn().mockResolvedValue(this);
    }

    static findById(id) {
      const idStr = id.toString();
      if (idStr === '507f1f77bcf86cd799439011') {
        return Promise.resolve({
          _id: '507f1f77bcf86cd799439011',
          companionChat: {
            roleCard: { strangerInitialSentiment: 60 },
            strangerSentiments: []
          }
        });
      }
      if (idStr === '507f1f77bcf86cd799439012') {
        return Promise.resolve({
          _id: '507f1f77bcf86cd799439012',
          name: '陌生人用户'
        });
      }
      return Promise.resolve(null);
    }

    static updateOne(query, update) {
      return Promise.resolve({ modifiedCount: 1 });
    }
  }

  return {
    __esModule: true,
    default: MockUser
  };
});

// Mock LLMClient 工具
vi.mock('../../src/utils/llmClient.js', () => {
  const mockGenerate = vi.fn().mockResolvedValue('5');
  
  class MockLLMClient {
    constructor(model, options = {}) {
      this.model = model;
      this.baseUrl = options.baseUrl || 'http://modelserver:11434';
      this.temperature = options.temperature || 0.7;
      this.maxRetries = options.maxRetries || 3;
      this.timeout = options.timeout || 30000;
      this.generate = mockGenerate;
    }

    async getModelInfo() {
      return {
        model: this.model,
        baseUrl: this.baseUrl,
        temperature: this.temperature,
        maxRetries: this.maxRetries,
        timeout: this.timeout
      };
    }
  }

  const mockLLMClient = new MockLLMClient();

  return {
    __esModule: true,
    default: vi.fn().mockImplementation((model, options = {}) => {
      return new MockLLMClient(model, options);
    }),
    createSentimentLLMClient: vi.fn().mockReturnValue(mockLLMClient),
    // 导出mock函数供测试使用
    __mockGenerate: mockGenerate
  };
});

// 现在导入SentimentManager和LLMClient mock
import SentimentManager from '../../src/services/langchain/sentimentManager.js';
import { __mockGenerate as mockGenerate } from '../../src/utils/llmClient.js';

describe('SentimentManager', () => {
  let manager;
  const targetUserId = '507f1f77bcf86cd799439011';
  const strangerId = '507f1f77bcf86cd799439012';

  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerate.mockResolvedValue('5');
    manager = new SentimentManager();
  });

  describe('constructor', () => {
    test('should initialize with correct default configuration', () => {
      expect(manager.factors).toEqual({
        sentiment: { range: [-10, 10], weight: 0.6 },
        frequency: { range: [0.2, 1.0], weight: 0.2 },
        quality: { range: [0, 2.0], weight: 0.1 },
        decay: { range: [-10.0, -0.5], weight: 0.1 }
      });

      expect(manager.bounds).toEqual({
        min: 0,
        max: 100
      });
    });

    test('should have factors weights summing to 1.0', () => {
      const totalWeight = Object.values(manager.factors)
        .reduce((sum, factor) => sum + factor.weight, 0);
      
      expect(totalWeight).toBeCloseTo(1.0, 2);
    });
  });

  describe('calculateTotalChange', () => {
    test('should calculate total change correctly', () => {
      const factors = {
        sentiment: 5,
        frequency: 0.5,
        quality: 1,
        decay: 0
      };

      const result = manager.calculateTotalChange(factors);
      
      // 5*0.6 + 0.5*0.2 + 1*0.1 + 0*0.1 = 3.2
      expect(result).toBeCloseTo(3.2, 2);
    });

    test('should handle missing factors', () => {
      const factors = {
        sentiment: 5,
        frequency: 0.5
        // missing quality and decay
      };

      const result = manager.calculateTotalChange(factors);
      
      // 5*0.6 + 0.5*0.2 + 0*0.1 + 0*0.1 = 3.1
      expect(result).toBeCloseTo(3.1, 2);
    });

    test('should handle negative factors', () => {
      const factors = {
        sentiment: -5,
        frequency: 0,
        quality: 0,
        decay: -2
      };

      const result = manager.calculateTotalChange(factors);
      
      // -5*0.6 + 0*0.2 + 0*0.1 + (-2)*0.1 = -3.2
      expect(result).toBeCloseTo(-3.2, 2);
    });

    test('should handle empty factors', () => {
      const factors = {};
      const result = manager.calculateTotalChange(factors);
      expect(result).toBe(0);
    });
  });

  describe('capScore', () => {
    test('should cap score within bounds', () => {
      expect(manager.capScore(-10)).toBe(0);
      expect(manager.capScore(150)).toBe(100);
      expect(manager.capScore(50)).toBe(50);
      expect(manager.capScore(0)).toBe(0);
      expect(manager.capScore(100)).toBe(100);
    });

    test('should cap at minimum bound', () => {
      expect(manager.capScore(-100)).toBe(0);
      expect(manager.capScore(-1)).toBe(0);
    });

    test('should cap at maximum bound', () => {
      expect(manager.capScore(101)).toBe(100);
      expect(manager.capScore(1000)).toBe(100);
    });
  });

  describe('analyzeSentiment', () => {
    test('should analyze positive sentiment correctly', async () => {
      mockGenerate.mockResolvedValueOnce('5');
      
      const result = await manager.analyzeSentiment('我今天心情很好');
      
      expect(result).toBe(5);
      expect(mockGenerate).toHaveBeenCalledWith(
        expect.stringContaining('分析以下消息的情感倾向'),
        expect.objectContaining({ temperature: 0.1, maxTokens: 10 })
      );
    });

    test('should analyze negative sentiment correctly', async () => {
      mockGenerate.mockResolvedValueOnce('-5');
      
      const result = await manager.analyzeSentiment('很难过的事情发生了');
      
      expect(result).toBe(-5);
    });

    test('should handle empty message', async () => {
      const result = await manager.analyzeSentiment('');
      expect(result).toBe(0);
    });

    test('should handle null message', async () => {
      const result = await manager.analyzeSentiment(null);
      expect(result).toBe(0);
    });

    test('should handle undefined message', async () => {
      const result = await manager.analyzeSentiment(undefined);
      expect(result).toBe(0);
    });

    test('should handle whitespace-only message', async () => {
      const result = await manager.analyzeSentiment('   ');
      expect(result).toBe(0);
    });

    test('should cap sentiment values within range', async () => {
      mockGenerate.mockResolvedValueOnce('15');
      
      const result = await manager.analyzeSentiment('测试消息');
      
      expect(result).toBe(10);
    });

    test('should cap negative sentiment values within range', async () => {
      mockGenerate.mockResolvedValueOnce('-20');
      
      const result = await manager.analyzeSentiment('测试消息');
      
      expect(result).toBe(-10);
    });

    test('should handle LLM error gracefully', async () => {
      mockGenerate.mockRejectedValueOnce(new Error('LLM Error'));
      
      const result = await manager.analyzeSentiment('测试消息');
      
      expect(result).toBe(0);
    });

    test('should handle invalid LLM response', async () => {
      mockGenerate.mockResolvedValueOnce('invalid_number');
      
      const result = await manager.analyzeSentiment('测试消息');
      
      expect(result).toBe(0);
    });

    test('should handle NaN response', async () => {
      mockGenerate.mockResolvedValueOnce('NaN');
      
      const result = await manager.analyzeSentiment('测试消息');
      
      expect(result).toBe(0);
    });

    test('should handle object response', async () => {
      mockGenerate.mockResolvedValueOnce({ content: 5 });
      
      const result = await manager.analyzeSentiment('测试消息');
      
      expect(result).toBe(0);
    });

    test('should handle null response', async () => {
      mockGenerate.mockResolvedValueOnce(null);
      
      const result = await manager.analyzeSentiment('测试消息');
      
      expect(result).toBe(0);
    });
  });

  describe('calculateFactors', () => {
    beforeEach(() => {
      vi.spyOn(manager, 'analyzeSentiment');
      vi.spyOn(manager, 'calculateFrequency');
      vi.spyOn(manager, 'calculateQuality');
      vi.spyOn(manager, 'calculateTimeDecay');
    });

    test('should calculate all factors correctly when sentiment is provided', async () => {
      manager.analyzeSentiment.mockResolvedValue(5);
      manager.calculateFrequency.mockResolvedValue(0.5);
      manager.calculateQuality.mockResolvedValue(1.0);
      manager.calculateTimeDecay.mockResolvedValue(0);

      const result = await manager.calculateFactors(
        targetUserId, 
        strangerId, 
        '今天天气很好', 
        [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
          { role: 'user', content: 'How are you?' },
          { role: 'assistant', content: 'I am fine, thank you!' }
        ], 
        5, // pre-computed sentiment
        true
      );

      expect(result).toEqual({
        sentiment: 5,
        frequency: 0.5,
        quality: 1.0,
        decay: 0
      });

      expect(manager.analyzeSentiment).not.toHaveBeenCalled();
      expect(manager.calculateFrequency).toHaveBeenCalledWith(targetUserId, strangerId, true);
      expect(manager.calculateQuality).toHaveBeenCalledWith([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
        { role: 'user', content: 'How are you?' },
        { role: 'assistant', content: 'I am fine, thank you!' }
      ]);
      expect(manager.calculateTimeDecay).toHaveBeenCalledWith(targetUserId, strangerId);
    });

    test('should call analyzeSentiment when sentiment is not provided', async () => {
      manager.analyzeSentiment.mockResolvedValue(3);
      manager.calculateFrequency.mockResolvedValue(0);
      manager.calculateQuality.mockResolvedValue(0);
      manager.calculateTimeDecay.mockResolvedValue(0);

      const result = await manager.calculateFactors(
        targetUserId, 
        strangerId, 
        '今天天气很好', 
        [], 
        undefined, // no sentiment provided
        false
      );

      expect(manager.analyzeSentiment).toHaveBeenCalledWith('今天天气很好');
      expect(result.sentiment).toBe(3);
      expect(manager.calculateFrequency).toHaveBeenCalledWith(targetUserId, strangerId, false);
      expect(manager.calculateQuality).toHaveBeenCalledWith([]);
      expect(manager.calculateTimeDecay).toHaveBeenCalledWith(targetUserId, strangerId);
    });
  });

  describe('generateReason', () => {
    test('should generate positive reason', async () => {
      const totalChange = 5;
      const factors = {
        sentiment: 3,
        frequency: 0.5,
        quality: 1,
        decay: 0
      };

      const result = await manager.generateReason(totalChange, factors);
      
      expect(result).toContain('提升');
      expect(result).toContain('5.0');
      expect(result).toContain('情感积极');
      expect(result).toContain('增加对话频次');
    });

    test('should generate negative reason', async () => {
      const totalChange = -3;
      const factors = {
        sentiment: -5,
        frequency: 0,
        quality: 0,
        decay: -1
      };

      const result = await manager.generateReason(totalChange, factors);
      
      expect(result).toContain('下降');
      expect(result).toContain('3.0');
      expect(result).toContain('情感消极');
      expect(result).toContain('时间衰减');
    });

    test('should generate neutral reason', async () => {
      const totalChange = 0;
      const factors = {
        sentiment: 0,
        frequency: 0,
        quality: 0,
        decay: 0
      };

      const result = await manager.generateReason(totalChange, factors);
      
      expect(result).toContain('保持');
      expect(result).toContain('0.0');
      expect(result).toContain('无明显变化');
    });

    test('should include updateData in reason', async () => {
      const totalChange = 2;
      const factors = { sentiment: 2, frequency: 0, quality: 0, decay: 0 };
      const updateData = { message: '很高兴认识你' };

      const result = await manager.generateReason(totalChange, factors, updateData);
      
      expect(result).toContain('提升');
      expect(result).toContain('2.0');
    });
  });

  describe('capScore edge cases', () => {
    test('should handle boundary values', () => {
      expect(manager.capScore(0)).toBe(0);
      expect(manager.capScore(100)).toBe(100);
    });

    test('should handle floating point values', () => {
      expect(manager.capScore(50.5)).toBe(50.5);
      expect(manager.capScore(99.9)).toBe(99.9);
      expect(manager.capScore(0.1)).toBe(0.1);
    });
  });

  describe('factors configuration', () => {
    test('should have correct factor ranges', () => {
      expect(manager.factors.sentiment.range).toEqual([-10, 10]);
      expect(manager.factors.frequency.range).toEqual([0.2, 1.0]);
      expect(manager.factors.quality.range).toEqual([0, 2.0]);
      expect(manager.factors.decay.range).toEqual([-10.0, -0.5]);
    });

    test('should have correct factor weights', () => {
      expect(manager.factors.sentiment.weight).toBe(0.6);
      expect(manager.factors.frequency.weight).toBe(0.2);
      expect(manager.factors.quality.weight).toBe(0.1);
      expect(manager.factors.decay.weight).toBe(0.1);
    });

    test('should have correct bounds', () => {
      expect(manager.bounds.min).toBe(0);
      expect(manager.bounds.max).toBe(100);
    });
  });

  describe('calculateTotalChange edge cases', () => {
    test('should handle extreme positive values', () => {
      const factors = {
        sentiment: 10,
        frequency: 1.0,
        quality: 2.0,
        decay: -0.5
      };

      const result = manager.calculateTotalChange(factors);
      expect(result).toBeCloseTo(6.35, 3); // 10*0.6 + 1.0*0.2 + 2.0*0.1 + (-0.5)*0.1 = 6.35 (正确值)
    });

    test('should handle extreme negative values', () => {
      const factors = {
        sentiment: -10,
        frequency: 0.2,
        quality: 0,
        decay: -10.0
      };

      const result = manager.calculateTotalChange(factors);
      expect(result).toBeCloseTo(-6.96, 3); // 正确计算：-10*0.6 + 0.2*0.2 + 0*0.1 + (-10.0)*0.1 = -6.96 (正确值)
    });

    test('should handle mixed signs', () => {
      const factors = {
        sentiment: 10,
        frequency: 0.2,
        quality: 0,
        decay: -5.0
      };

      const result = manager.calculateTotalChange(factors);
       expect(result).toBeCloseTo(5.54, 3); // 正确计算：10*0.6 + 0.2*0.2 + 0*0.1 + (-5.0)*0.1 = 5.54 (正确值)
    });
  });
});