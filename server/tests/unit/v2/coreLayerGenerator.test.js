/**
 * CoreLayerGenerator V2 单元测试
 * 测试核心层生成器的 A 套答案收集、LLM 响应解析、JSON 重试机制
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// 创建模拟 LLM 响应
const mockLLMResponse = () => JSON.stringify({
  extractedFields: {
    personalityTraits: '测试人格特征内容'
  },
  confidence: 'high'
});

// Mock dependencies BEFORE importing the module
vi.mock('../../../core/llm/multi.js', () => ({
  default: class MockMultiLLMClient {
    async generate() {
      return mockLLMResponse();
    }
  }
}));

vi.mock('../../qa/models/answer.js', () => ({
  default: {
    find: vi.fn(() => ({
      populate: vi.fn(() => ({
        sort: vi.fn(() => [])
      }))
    })),
    countDocuments: vi.fn().mockResolvedValue(10)
  }
}));

vi.mock('../../qa/models/question.js', () => ({
  default: {
    countDocuments: vi.fn().mockResolvedValue(10)
  }
}));

vi.mock('../../../core/storage/dual.js', () => ({
  default: class MockDualStorage {
    async saveCoreLayer() {}
  }
}));

vi.mock('../../user/model.js', () => ({
  default: {
    findById: vi.fn().mockResolvedValue({
      _id: 'test-user',
      name: '测试用户',
      profile: {
        gender: '男',
        birthDate: '1960-01-01',
        residence: { cityName: '北京' }
      }
    })
  }
}));

vi.mock('../../../core/utils/logger.js', () => ({
  profileLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

// Import AFTER mocks are set up
import CoreLayerGenerator, { validateASetCompletion } from '../../../src/modules/rolecard/v2/coreLayerGenerator.js';

describe('CoreLayerGenerator V2', () => {
  let generator;

  beforeEach(() => {
    generator = new CoreLayerGenerator();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseJsonResponse() 方法', () => {
    it('应正确解析 JSON 字符串响应', () => {
      const response = JSON.stringify({
        extractedFields: {
          personalityTraits: '测试内容'
        },
        confidence: 'high'
      });

      const result = generator.parseJsonResponse(response);

      expect(result).toBeDefined();
      expect(result.extractedFields.personalityTraits).toBe('测试内容');
    });

    it('应从包含其他文本的响应中提取 JSON', () => {
      const response = `这是一些额外的文本
\`\`\`json
{
  "extractedFields": {
    "personalityTraits": "从混合文本中提取"
  },
  "confidence": "medium"
}
\`\`\`
更多文本`;

      const result = generator.parseJsonResponse(response);

      expect(result).toBeDefined();
      expect(result.extractedFields.personalityTraits).toBe('从混合文本中提取');
    });

    it('应接受已解析的对象', () => {
      const response = {
        extractedFields: {
          personalityTraits: '直接对象'
        },
        confidence: 'high'
      };

      const result = generator.parseJsonResponse(response);

      expect(result).toBeDefined();
      expect(result.extractedFields.personalityTraits).toBe('直接对象');
    });

    it('无效 JSON 应返回 null', () => {
      const response = '这不是有效的 JSON';

      const result = generator.parseJsonResponse(response);

      expect(result).toBeNull();
    });

    it('null 响应应返回 null', () => {
      const result = generator.parseJsonResponse(null);
      expect(result).toBeNull();
    });

    it('空字符串响应应返回 null', () => {
      const result = generator.parseJsonResponse('');
      expect(result).toBeNull();
    });
  });

  describe('callLLMWithRetry() 方法', () => {
    it('首次成功应直接返回结果', async () => {
      const mockResponse = { extractedFields: { personalityTraits: 'test' } };

      vi.spyOn(generator.llmClient, 'generate').mockResolvedValueOnce(JSON.stringify(mockResponse));

      const result = await generator.callLLMWithRetry('test prompt', { temperature: 0.3 });

      expect(result).toEqual(mockResponse);
      expect(generator.llmClient.generate).toHaveBeenCalledTimes(1);
    });

    it('首次失败第二次成功应返回结果', async () => {
      const mockResponse = { extractedFields: { personalityTraits: 'test' } };

      // 第一次返回无效 JSON
      vi.spyOn(generator.llmClient, 'generate')
        .mockResolvedValueOnce('invalid json{{{')
        .mockResolvedValueOnce(JSON.stringify(mockResponse));

      const result = await generator.callLLMWithRetry('test prompt', { temperature: 0.3 });

      expect(result).toEqual(mockResponse);
      expect(generator.llmClient.generate).toHaveBeenCalledTimes(2);
    });

    it('达到最大重试次数应返回 null', async () => {
      // 所有调用都返回无效 JSON
      vi.spyOn(generator.llmClient, 'generate').mockResolvedValue('invalid json{{{');

      const result = await generator.callLLMWithRetry('test prompt', { temperature: 0.3 }, 3);

      expect(result).toBeNull();
      expect(generator.llmClient.generate).toHaveBeenCalledTimes(3);
    });

    it('LLM 调用抛出错误应继续重试', async () => {
      const mockResponse = { extractedFields: { personalityTraits: 'test' } };

      vi.spyOn(generator.llmClient, 'generate')
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(JSON.stringify(mockResponse));

      const result = await generator.callLLMWithRetry('test prompt', { temperature: 0.3 });

      expect(result).toEqual(mockResponse);
      expect(generator.llmClient.generate).toHaveBeenCalledTimes(2);
    });

    it('自定义最大重试次数应生效', async () => {
      vi.spyOn(generator.llmClient, 'generate').mockResolvedValue('invalid json{{{');

      const result = await generator.callLLMWithRetry('test prompt', { temperature: 0.3 }, 2);

      expect(result).toBeNull();
      expect(generator.llmClient.generate).toHaveBeenCalledTimes(2);
    });

    it('响应为对象时应直接返回', async () => {
      const mockResponse = { extractedFields: { personalityTraits: 'test' } };

      vi.spyOn(generator.llmClient, 'generate').mockResolvedValueOnce(mockResponse);

      const result = await generator.callLLMWithRetry('test prompt', { temperature: 0.3 });

      expect(result).toEqual(mockResponse);
      expect(generator.llmClient.generate).toHaveBeenCalledTimes(1);
    });
  });

  describe('processOneAnswer() 方法', () => {
    it('应成功处理有效答案', async () => {
      const mockResponse = {
        extractedFields: {
          personality: '从答案中提取的人格特征'
        },
        confidence: 'high'
      };

      vi.spyOn(generator.llmClient, 'generate').mockResolvedValueOnce(JSON.stringify(mockResponse));

      const item = {
        questionId: 'q1',
        questionText: '测试问题',
        answerText: '测试答案',
        significance: '高'
      };

      await generator.processOneAnswer(item);

      expect(generator.fieldFragments.personality.length).toBe(1);
      expect(generator.fieldFragments.personality[0].content).toBe('从答案中提取的人格特征');
    });

    it('解析失败应使用重试机制', async () => {
      const mockResponse = {
        extractedFields: {
          personality: '重试后提取的内容'
        },
        confidence: 'medium'
      };

      // 第一次失败，第二次成功
      vi.spyOn(generator.llmClient, 'generate')
        .mockResolvedValueOnce('invalid json')
        .mockResolvedValueOnce(JSON.stringify(mockResponse));

      const item = {
        questionId: 'q1',
        questionText: '测试问题',
        answerText: '测试答案',
        significance: '高'
      };

      await generator.processOneAnswer(item);

      expect(generator.fieldFragments.personality.length).toBe(1);
      expect(generator.llmClient.generate).toHaveBeenCalledTimes(2);
    });

    it('LLM 调用异常不应中断流程', async () => {
      vi.spyOn(generator.llmClient, 'generate').mockRejectedValue(new Error('LLM error'));

      const item = {
        questionId: 'q1',
        questionText: '测试问题',
        answerText: '测试答案',
        significance: '高'
      };

      // 不应抛出错误
      await expect(generator.processOneAnswer(item)).resolves.not.toThrow();
    });
  });

  describe('reset() 方法', () => {
    it('应重置所有字段片段', () => {
      generator.fieldFragments.personality.push({ content: 'test' });
      generator.fieldFragments.communicationStyle.push({ content: 'test2' });

      generator.reset();

      expect(generator.fieldFragments.personality.length).toBe(0);
      expect(generator.fieldFragments.communicationStyle.length).toBe(0);
    });
  });

  describe('buildBasicIdentity() 方法', () => {
    it('应从用户档案构建基础身份', () => {
      const user = {
        name: '张三',
        profile: {
          gender: '男',
          birthDate: '1960-01-01',
          residence: { cityName: '北京' },
          occupation: '退休教师',
          maritalStatus: '已婚'
        }
      };

      const result = generator.buildBasicIdentity(user);

      expect(result.raw.name).toBe('张三');
      expect(result.raw.gender).toBe('男');
      expect(result.summary).toContain('张三');
    });
  });

  describe('generateBasicIdentitySummary() 方法', () => {
    it('应生成包含基本信息的摘要', () => {
      const profile = {
        gender: '男',
        occupation: '教师',
        residence: { cityName: '上海' }
      };

      const result = generator.generateBasicIdentitySummary('李四', profile, 65);

      expect(result).toContain('李四');
      expect(result).toContain('男');
      expect(result).toContain('教师');
      expect(result).toContain('上海');
    });

    it('应正确处理子女信息', () => {
      const profile = {
        gender: '女',
        children: { sons: 1, daughters: 2 }
      };

      const result = generator.generateBasicIdentitySummary('王五', profile, 70);

      expect(result).toContain('1子');
      expect(result).toContain('2女');
    });
  });
});
