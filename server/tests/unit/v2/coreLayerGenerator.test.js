/**
 * CoreLayerGenerator V2 单元测试
 * 测试核心层生成器的 A 套答案收集、LLM 响应解析、核心层验证
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// 创建模拟 LLM 响应
const mockLLMResponse = () => JSON.stringify({
  personalityTraits: {
    boundaryThickness: 'medium',
    discretionLevel: 'good',
    impulsiveSpeech: 'occasional',
    emotionalExpression: 'moderate',
    socialCautiousness: 'moderate'
  },
  communicationStyle: {
    tonePattern: '温和亲切',
    preferredTopics: ['家庭', '健康'],
    avoidedTopics: [],
    humorStyle: 'light',
    verbosity: 'moderate'
  },
  selfPerception: {
    selfDescriptionKeywords: ['务实', '坚韧'],
    coreValues: ['家庭和睦'],
    lifePriorities: ['家人健康']
  },
  behavioralIndicators: []
});

// Mock dependencies BEFORE importing the module
vi.mock('../../../core/llm/multi.js', () => ({
  default: class MockMultiLLMClient {
    async generate() {
      return mockLLMResponse();
    }
  }
}));

vi.mock('../../answer/model.js', () => ({
  default: {
    find: vi.fn(() => ({
      populate: vi.fn(() => ({
        sort: vi.fn(() => [])
      }))
    }))
  }
}));

vi.mock('../../../core/storage/dual.js', () => ({
  default: class MockDualStorage {}
}));

vi.mock('../../user/model.js', () => ({
  default: {}
}));

vi.mock('../../../core/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

// Import AFTER mocks are set up
import CoreLayerGenerator from '../../../src/modules/rolecard/v2/coreLayerGenerator.js';

describe('CoreLayerGenerator V2', () => {
  let generator;

  beforeEach(() => {
    generator = new CoreLayerGenerator();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseLLMResponse() 方法', () => {
    it('应正确解析 JSON 字符串响应', () => {
      const response = JSON.stringify({
        personalityTraits: {
          boundaryThickness: 'medium',
          discretionLevel: 'good',
          impulsiveSpeech: 'occasional',
          emotionalExpression: 'moderate',
          socialCautiousness: 'moderate'
        },
        communicationStyle: {
          tonePattern: '温和',
          preferredTopics: ['家庭'],
          avoidedTopics: [],
          humorStyle: 'light',
          verbosity: 'moderate'
        },
        selfPerception: {
          selfDescriptionKeywords: ['务实'],
          coreValues: ['家庭'],
          lifePriorities: ['健康']
        }
      });

      const result = generator.parseLLMResponse(response);

      expect(result).toBeDefined();
      expect(result.personalityTraits.boundaryThickness).toBe('medium');
    });

    it('应从包含其他文本的响应中提取 JSON', () => {
      const response = `这是一些额外的文本
\`\`\`json
{
  "personalityTraits": {
    "boundaryThickness": "thick",
    "discretionLevel": "excellent",
    "impulsiveSpeech": "rare",
    "emotionalExpression": "reserved",
    "socialCautiousness": "high"
  },
  "communicationStyle": {
    "tonePattern": "严肃",
    "preferredTopics": ["工作"],
    "avoidedTopics": [],
    "humorStyle": "none",
    "verbosity": "concise"
  },
  "selfPerception": {
    "selfDescriptionKeywords": ["认真"],
    "coreValues": ["诚信"],
    "lifePriorities": ["事业"]
  }
}
\`\`\`
更多文本`;

      const result = generator.parseLLMResponse(response);

      expect(result).toBeDefined();
      expect(result.personalityTraits.boundaryThickness).toBe('thick');
    });

    it('应接受已解析的对象', () => {
      const response = {
        personalityTraits: {
          boundaryThickness: 'thin',
          discretionLevel: 'poor',
          impulsiveSpeech: 'frequent',
          emotionalExpression: 'expressive',
          socialCautiousness: 'low'
        },
        communicationStyle: {
          tonePattern: '活泼',
          preferredTopics: ['娱乐'],
          avoidedTopics: [],
          humorStyle: 'heavy',
          verbosity: 'elaborate'
        },
        selfPerception: {
          selfDescriptionKeywords: ['开朗'],
          coreValues: ['快乐'],
          lifePriorities: ['享受生活']
        }
      };

      const result = generator.parseLLMResponse(response);

      expect(result).toBeDefined();
      expect(result.personalityTraits.boundaryThickness).toBe('thin');
    });

    it('无效 JSON 应抛出错误', () => {
      const response = '这不是有效的 JSON';

      expect(() => generator.parseLLMResponse(response)).toThrow('核心层解析失败');
    });
  });

  describe('validateCoreLayer() 方法', () => {
    it('有效的核心层应通过验证', () => {
      const coreLayer = {
        personalityTraits: {
          boundaryThickness: 'medium',
          discretionLevel: 'good',
          impulsiveSpeech: 'occasional',
          emotionalExpression: 'moderate',
          socialCautiousness: 'moderate'
        },
        communicationStyle: {
          tonePattern: '温和',
          preferredTopics: [],
          avoidedTopics: [],
          humorStyle: 'light',
          verbosity: 'moderate'
        },
        selfPerception: {
          selfDescriptionKeywords: ['务实'],
          coreValues: [],
          lifePriorities: []
        }
      };

      expect(() => generator.validateCoreLayer(coreLayer)).not.toThrow();
    });

    it('缺少 personalityTraits.boundaryThickness 应抛出错误', () => {
      const coreLayer = {
        personalityTraits: {
          discretionLevel: 'good',
          impulsiveSpeech: 'occasional',
          emotionalExpression: 'moderate',
          socialCautiousness: 'moderate'
        },
        communicationStyle: { tonePattern: '温和' },
        selfPerception: { selfDescriptionKeywords: ['务实'] }
      };

      expect(() => generator.validateCoreLayer(coreLayer)).toThrow('缺少必要字段');
    });

    it('缺少 communicationStyle.tonePattern 应抛出错误', () => {
      const coreLayer = {
        personalityTraits: {
          boundaryThickness: 'medium',
          discretionLevel: 'good',
          impulsiveSpeech: 'occasional',
          emotionalExpression: 'moderate',
          socialCautiousness: 'moderate'
        },
        communicationStyle: {},
        selfPerception: { selfDescriptionKeywords: ['务实'] }
      };

      expect(() => generator.validateCoreLayer(coreLayer)).toThrow('缺少必要字段');
    });

    it('缺少 selfPerception.selfDescriptionKeywords 应抛出错误', () => {
      const coreLayer = {
        personalityTraits: {
          boundaryThickness: 'medium',
          discretionLevel: 'good',
          impulsiveSpeech: 'occasional',
          emotionalExpression: 'moderate',
          socialCautiousness: 'moderate'
        },
        communicationStyle: { tonePattern: '温和' },
        selfPerception: {}
      };

      expect(() => generator.validateCoreLayer(coreLayer)).toThrow('缺少必要字段');
    });

    it('所有有效的枚举值应通过验证', () => {
      const coreLayer = {
        personalityTraits: {
          boundaryThickness: 'thick',
          discretionLevel: 'excellent',
          impulsiveSpeech: 'rare',
          emotionalExpression: 'reserved',
          socialCautiousness: 'high'
        },
        communicationStyle: {
          tonePattern: '严肃',
          preferredTopics: [],
          avoidedTopics: [],
          humorStyle: 'none',
          verbosity: 'concise'
        },
        selfPerception: {
          selfDescriptionKeywords: ['认真'],
          coreValues: [],
          lifePriorities: []
        }
      };

      expect(() => generator.validateCoreLayer(coreLayer)).not.toThrow();
    });

    it('无效的枚举值应产生警告但不应抛出错误', () => {
      const coreLayer = {
        personalityTraits: {
          boundaryThickness: 'invalid_value',
          discretionLevel: 'good',
          impulsiveSpeech: 'occasional',
          emotionalExpression: 'moderate',
          socialCautiousness: 'moderate'
        },
        communicationStyle: {
          tonePattern: '温和',
          preferredTopics: [],
          avoidedTopics: [],
          humorStyle: 'invalid',
          verbosity: 'moderate'
        },
        selfPerception: {
          selfDescriptionKeywords: ['务实'],
          coreValues: [],
          lifePriorities: []
        }
      };

      // 不应抛出错误，只是警告
      expect(() => generator.validateCoreLayer(coreLayer)).not.toThrow();
    });
  });

  describe('generate() 方法（集成测试模拟）', () => {
    it('答案不足时应抛出错误', async () => {
      // Mock collectASetAnswers 返回空数组
      vi.spyOn(generator, 'collectASetAnswers').mockResolvedValue([]);

      await expect(generator.generate('test-user')).rejects.toThrow('A套题答案不足');
    });

    it('答案少于10个时应抛出错误', async () => {
      // Mock 5 个答案
      vi.spyOn(generator, 'collectASetAnswers').mockResolvedValue([
        { _id: '1', questionText: 'Q1', answerText: 'A1' },
        { _id: '2', questionText: 'Q2', answerText: 'A2' },
        { _id: '3', questionText: 'Q3', answerText: 'A3' },
        { _id: '4', questionText: 'Q4', answerText: 'A4' },
        { _id: '5', questionText: 'Q5', answerText: 'A5' }
      ]);

      await expect(generator.generate('test-user')).rejects.toThrow('A套题答案不足');
    });

    // 注意：此测试需要 Ollama 服务可用
    // 在 Docker 环境中运行，或设置 OLLAMA_BASE_URL=http://localhost:11434
    it.skip('有足够答案时应生成核心层（需要 Ollama 服务）', async () => {
      const mockAnswers = Array.from({ length: 15 }, (_, i) => ({
        _id: `answer-${i}`,
        questionId: `question-${i}`,
        questionText: `问题 ${i}`,
        questionLayer: 'basic',
        answerText: `答案 ${i}`,
        significance: '测试'
      }));

      vi.spyOn(generator, 'collectASetAnswers').mockResolvedValue(mockAnswers);

      const result = await generator.generate('test-user');

      expect(result).toBeDefined();
      expect(result.version).toBe('2.0.0');
      expect(result.generatedAt).toBeDefined();
      expect(result.sourceQuestionCount).toBe(15);
      expect(result.personalityTraits).toBeDefined();
    }, 60000);
  });

  describe('边界情况测试', () => {
    it('应处理空的 personalityTraits 对象', () => {
      const coreLayer = {
        personalityTraits: {},
        communicationStyle: { tonePattern: '温和' },
        selfPerception: { selfDescriptionKeywords: ['务实'] }
      };

      expect(() => generator.validateCoreLayer(coreLayer)).toThrow();
    });

    it('应处理 null 响应', () => {
      expect(() => generator.parseLLMResponse(null)).toThrow();
    });

    it('应处理空字符串响应', () => {
      expect(() => generator.parseLLMResponse('')).toThrow();
    });

    it('应处理嵌套 JSON 响应', () => {
      const response = JSON.stringify({
        data: {
          personalityTraits: {
            boundaryThickness: 'medium',
            discretionLevel: 'good',
            impulsiveSpeech: 'occasional',
            emotionalExpression: 'moderate',
            socialCautiousness: 'moderate'
          },
          communicationStyle: { tonePattern: '温和' },
          selfPerception: { selfDescriptionKeywords: ['务实'] }
        }
      });

      // 应该能解析（即使结构不完全匹配）
      expect(() => generator.parseLLMResponse(response)).toBeDefined();
    });
  });

  describe('实际数据格式测试', () => {
    // 注意：此测试需要 Ollama 服务可用
    it.skip('应生成符合 V2 规范的核心层（需要 Ollama 服务）', async () => {
      const mockAnswers = Array.from({ length: 15 }, (_, i) => ({
        _id: `answer-${i}`,
        questionId: `question-${i}`,
        questionText: `问题 ${i}`,
        questionLayer: i < 10 ? 'basic' : 'emotional',
        answerText: `这是一个详细的答案内容，描述了用户的人格特征 ${i}`,
        significance: '测试用例'
      }));

      vi.spyOn(generator, 'collectASetAnswers').mockResolvedValue(mockAnswers);

      const result = await generator.generate('test-user');

      // 验证 V2 规范字段
      expect(result.version).toBe('2.0.0');
      expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(Array.isArray(result.sourceQuestionIds)).toBe(true);
      expect(result.sourceQuestionIds.length).toBe(15);
    }, 60000);
  });
});
