/**
 * RelationLayerGenerator V2 单元测试
 * 测试关系层生成、信任等级 LLM 分析、亲密度评估
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock 依赖
vi.mock('../../../src/core/llm/multi.js', () => ({
  default: class MockMultiLLMClient {
    async generate(prompt, options) {
      if (prompt.includes('trustLevel') || prompt.includes('信任等级')) {
        return JSON.stringify({
          trustLevel: 'tier2_close',
          confidence: 'high',
          reasoning: '关系亲近，有良好的互动'
        });
      }
      if (prompt.includes('压缩')) {
        return JSON.stringify({
          compressed: '测试压缩内容',
          keyPoints: ['要点1', '要点2']
        });
      }
      return JSON.stringify({
        extractedFields: {
          sharedMemories: '共同回忆内容',
          emotionalBond: '情感纽带内容'
        },
        confidence: 'high'
      });
    }
  }
}));

vi.mock('../../../src/core/storage/dual.js', () => ({
  default: class MockDualStorage {
    async saveRelationLayer() {}
    async loadAllRelationLayers() { return {}; }
  }
}));

vi.mock('../../qa/models/answer.js', () => ({
  default: {
    find: vi.fn(() => ({
      populate: vi.fn(() => ({
        sort: vi.fn(() => [{
          _id: 'answer1',
          questionId: { _id: 'q1', question: '测试问题', layer: 'B', role: 'family', significance: '测试' },
          answer: '测试回答'
        }])
      }))
    }))
  }
}));

vi.mock('../../qa/models/question.js', () => ({
  default: {}
}));

vi.mock('../../user/model.js', () => ({
  default: {}
}));

vi.mock('../../assist/model.js', () => ({
  default: {
    find: vi.fn(() => ({
      populate: vi.fn(() => [])
    }))
  }
}));

// 导入被测模块和 Answer 模块
import RelationLayerGenerator from '../../../src/modules/rolecard/v2/relationLayerGenerator.js';
import Answer from '../../../src/modules/qa/models/answer.js';

describe('RelationLayerGenerator V2', () => {
  let generator;

  beforeEach(() => {
    generator = new RelationLayerGenerator();
  });

  describe('classifyRelationType()', () => {
    it('应正确识别家人关系', () => {
      const familyRelations = ['父亲', '母亲', '爸爸', '妈妈', '儿子', '女儿',
                               '兄弟', '姐妹', '爷爷', '奶奶', '丈夫', '妻子'];

      familyRelations.forEach(relation => {
        const result = generator.classifyRelationType(relation);
        expect(result).toBe('family');
      });
    });

    it('应正确识别朋友关系', () => {
      const friendRelations = ['朋友', '同学', '同事', '邻居', '大学同学'];

      friendRelations.forEach(relation => {
        const result = generator.classifyRelationType(relation);
        expect(result).toBe('friend');
      });
    });

    it('空值应默认为朋友关系', () => {
      expect(generator.classifyRelationType('')).toBe('friend');
      expect(generator.classifyRelationType(null)).toBe('friend');
      expect(generator.classifyRelationType(undefined)).toBe('friend');
    });
  });

  describe('determineIntimacyLevel()', () => {
    it('总深度 >= 6 应返回 intimate', () => {
      const compressedFields = {
        sharedMemories: { sourceCount: 3 },
        emotionalBond: { sourceCount: 2 },
        supportDynamics: { sourceCount: 2 }
      };
      const result = generator.determineIntimacyLevel([], compressedFields);
      expect(result).toBe('intimate');
    });

    it('总深度 >= 4 应返回 close', () => {
      const compressedFields = {
        sharedMemories: { sourceCount: 2 },
        emotionalBond: { sourceCount: 1 },
        supportDynamics: { sourceCount: 1 }
      };
      const result = generator.determineIntimacyLevel([], compressedFields);
      expect(result).toBe('close');
    });

    it('总深度 >= 2 应返回 moderate', () => {
      const compressedFields = {
        sharedMemories: { sourceCount: 1 },
        emotionalBond: { sourceCount: 1 },
        supportDynamics: { sourceCount: 0 }
      };
      const result = generator.determineIntimacyLevel([], compressedFields);
      expect(result).toBe('moderate');
    });

    it('总深度 < 2 应返回 distant', () => {
      const compressedFields = {
        sharedMemories: { sourceCount: 0 },
        emotionalBond: { sourceCount: 0 },
        supportDynamics: { sourceCount: 0 }
      };
      const result = generator.determineIntimacyLevel([], compressedFields);
      expect(result).toBe('distant');
    });
  });

  describe('determineTrustLevel()', () => {
    it('应使用 LLM 分析信任等级', async () => {
      const compressedFields = {
        sharedMemories: { summary: '有很多共同回忆' },
        emotionalBond: { summary: '情感连接很深' },
        supportDynamics: { summary: '互相支持' }
      };

      const result = await generator.determineTrustLevel(
        'family',
        '父亲',
        'intimate',
        compressedFields
      );

      expect(result).toBe('tier2_close');
    });

    it('LLM 返回无效结果时应用回退逻辑', async () => {
      generator.llmClient.generate = vi.fn().mockResolvedValue(
        JSON.stringify({ trustLevel: 'invalid_level' })
      );

      const result = await generator.determineTrustLevel(
        'family',
        '父亲',
        'intimate',
        {}
      );

      expect(result).toBe('tier1_intimate');
    });

    it('LLM 失败时应用回退逻辑', async () => {
      generator.llmClient.generate = vi.fn().mockRejectedValue(new Error('LLM error'));

      const result = await generator.determineTrustLevel(
        'friend',
        '朋友',
        'moderate',
        {}
      );

      expect(result).toBe('tier3_familiar');
    });
  });

  describe('fallbackTrustLevel()', () => {
    it('家人 + intimate 应返回 tier1_intimate', () => {
      const result = generator.fallbackTrustLevel('intimate', 'family');
      expect(result).toBe('tier1_intimate');
    });

    it('家人 + close 应返回 tier1_intimate', () => {
      const result = generator.fallbackTrustLevel('close', 'family');
      expect(result).toBe('tier1_intimate');
    });

    it('家人 + moderate 应返回 tier2_close', () => {
      const result = generator.fallbackTrustLevel('moderate', 'family');
      expect(result).toBe('tier2_close');
    });

    it('家人 + distant 应返回 tier3_familiar', () => {
      const result = generator.fallbackTrustLevel('distant', 'family');
      expect(result).toBe('tier3_familiar');
    });

    it('朋友 + intimate 应返回 tier2_close', () => {
      const result = generator.fallbackTrustLevel('intimate', 'friend');
      expect(result).toBe('tier2_close');
    });

    it('朋友 + close 应返回 tier2_close', () => {
      const result = generator.fallbackTrustLevel('close', 'friend');
      expect(result).toBe('tier2_close');
    });

    it('朋友 + moderate 应返回 tier3_familiar', () => {
      const result = generator.fallbackTrustLevel('moderate', 'friend');
      expect(result).toBe('tier3_familiar');
    });

    it('朋友 + distant 应返回 tier4_acquaintance', () => {
      const result = generator.fallbackTrustLevel('distant', 'friend');
      expect(result).toBe('tier4_acquaintance');
    });
  });

  describe('parseJsonResponse()', () => {
    it('应正确解析 JSON 字符串', () => {
      const result = generator.parseJsonResponse('{"test": "value"}');
      expect(result).toEqual({ test: 'value' });
    });

    it('应从文本中提取 JSON', () => {
      const result = generator.parseJsonResponse(
        'some text {"trustLevel": "tier1_intimate"} more text'
      );
      expect(result).toEqual({ trustLevel: 'tier1_intimate' });
    });

    it('无效 JSON 应返回 null', () => {
      const result = generator.parseJsonResponse('not json');
      expect(result).toBeNull();
    });

    it('对象应直接返回', () => {
      const obj = { test: 'value' };
      const result = generator.parseJsonResponse(obj);
      expect(result).toBe(obj);
    });
  });

  describe('callLLMWithRetry()', () => {
    it('第一次成功时应返回解析后的 JSON', async () => {
      const mockResponse = { test: 'value' };
      generator.llmClient.generate = vi.fn().mockResolvedValue(JSON.stringify(mockResponse));

      const result = await generator.callLLMWithRetry('test prompt', {});

      expect(result).toEqual(mockResponse);
      expect(generator.llmClient.generate).toHaveBeenCalledTimes(1);
    });

    it('第一次失败第二次成功时应返回解析后的 JSON', async () => {
      generator.llmClient.generate = vi.fn()
        .mockResolvedValueOnce('invalid json {{{')
        .mockResolvedValueOnce(JSON.stringify({ test: 'value' }));

      const result = await generator.callLLMWithRetry('test prompt', {});

      expect(result).toEqual({ test: 'value' });
      expect(generator.llmClient.generate).toHaveBeenCalledTimes(2);
    });

    it('所有重试都失败时应返回 null', async () => {
      generator.llmClient.generate = vi.fn().mockResolvedValue('invalid json');

      const result = await generator.callLLMWithRetry('test prompt', {}, 3);

      expect(result).toBeNull();
      expect(generator.llmClient.generate).toHaveBeenCalledTimes(3);
    });

    it('LLM 调用抛出错误时应继续重试', async () => {
      generator.llmClient.generate = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce(JSON.stringify({ test: 'success' }));

      const result = await generator.callLLMWithRetry('test prompt', {});

      expect(result).toEqual({ test: 'success' });
      expect(generator.llmClient.generate).toHaveBeenCalledTimes(3);
    });

    it('应接受自定义 maxRetries 参数', async () => {
      generator.llmClient.generate = vi.fn().mockResolvedValue('invalid');

      const result = await generator.callLLMWithRetry('test prompt', {}, 5);

      expect(result).toBeNull();
      expect(generator.llmClient.generate).toHaveBeenCalledTimes(5);
    });

    it('应正确处理对象类型的响应', async () => {
      const mockResponse = { trustLevel: 'tier2_close' };
      generator.llmClient.generate = vi.fn().mockResolvedValue(mockResponse);

      const result = await generator.callLLMWithRetry('test prompt', {});

      expect(result).toEqual(mockResponse);
    });
  });

  describe('resetFieldFragments()', () => {
    it('应重置家人关系的字段片段', () => {
      generator.resetFieldFragments('family');

      expect(generator.fieldFragments).toHaveProperty('relationshipBasis');
      expect(generator.fieldFragments).toHaveProperty('sharedMemories');
      expect(generator.fieldFragments).toHaveProperty('familyRole');
      expect(generator.fieldFragments).toHaveProperty('intergenerationalImpact');
    });

    it('应重置朋友关系的字段片段', () => {
      generator.resetFieldFragments('friend');

      expect(generator.fieldFragments).toHaveProperty('relationshipBasis');
      expect(generator.fieldFragments).toHaveProperty('sharedMemories');
      expect(generator.fieldFragments).toHaveProperty('socialRole');
      expect(generator.fieldFragments).toHaveProperty('friendshipHistory');
    });
  });

  describe('collectAssistantAnswers()', () => {
    it('应使用 role 字段过滤家人关系答案', async () => {
      // 重新设置 mock 以测试 family 过滤
      const mockAnswers = [
        {
          _id: 'answer1',
          questionId: { _id: 'q1', question: '家人问题', layer: 'B', role: 'family', significance: 'high' },
          answer: '家人回答'
        },
        {
          _id: 'answer2',
          questionId: { _id: 'q2', question: '朋友问题', layer: 'C', role: 'friend', significance: 'medium' },
          answer: '朋友回答'
        }
      ];

      Answer.find = vi.fn(() => ({
        populate: vi.fn(() => ({
          sort: vi.fn(() => mockAnswers)
        }))
      }));

      const result = await generator.collectAssistantAnswers('user1', 'assistant1', 'family');

      expect(result).toHaveLength(1);
      expect(result[0].questionRole).toBe('family');
      expect(result[0].questionText).toBe('家人问题');
    });

    it('应使用 role 字段过滤朋友关系答案', async () => {
      const mockAnswers = [
        {
          _id: 'answer1',
          questionId: { _id: 'q1', question: '家人问题', layer: 'B', role: 'family', significance: 'high' },
          answer: '家人回答'
        },
        {
          _id: 'answer2',
          questionId: { _id: 'q2', question: '朋友问题', layer: 'C', role: 'friend', significance: 'medium' },
          answer: '朋友回答'
        }
      ];

      Answer.find = vi.fn(() => ({
        populate: vi.fn(() => ({
          sort: vi.fn(() => mockAnswers)
        }))
      }));

      const result = await generator.collectAssistantAnswers('user1', 'assistant1', 'friend');

      expect(result).toHaveLength(1);
      expect(result[0].questionRole).toBe('friend');
      expect(result[0].questionText).toBe('朋友问题');
    });

    it('返回对象应包含 questionRole 字段', async () => {
      const result = await generator.collectAssistantAnswers('user1', 'assistant1', 'family');

      expect(result[0]).toHaveProperty('questionRole');
      expect(result[0].questionRole).toBe('family');
    });
  });
});

describe('Trust Level Analysis Prompts', () => {
  it('TRUST_LEVEL_ANALYSIS_PROMPT 应包含所有信任等级', async () => {
    const { TRUST_LEVEL_ANALYSIS_PROMPT } = await import(
      '../../../src/modules/rolecard/v2/prompts/relationExtractionV2.js'
    );

    expect(TRUST_LEVEL_ANALYSIS_PROMPT).toContain('tier1_intimate');
    expect(TRUST_LEVEL_ANALYSIS_PROMPT).toContain('tier2_close');
    expect(TRUST_LEVEL_ANALYSIS_PROMPT).toContain('tier3_familiar');
    expect(TRUST_LEVEL_ANALYSIS_PROMPT).toContain('tier4_acquaintance');
  });

  it('buildTrustLevelAnalysisPrompt 应生成有效的 Prompt', async () => {
    const { buildTrustLevelAnalysisPrompt } = await import(
      '../../../src/modules/rolecard/v2/prompts/relationExtractionV2.js'
    );

    const compressedFields = {
      sharedMemories: { summary: 'shared memories summary' },
      emotionalBond: { summary: 'emotional bond summary' },
      supportDynamics: { summary: 'support dynamics summary' }
    };

    const prompt = buildTrustLevelAnalysisPrompt(
      'family',
      'father',
      'intimate',
      compressedFields
    );

    expect(prompt).toContain('family');
    expect(prompt).toContain('father');
    expect(prompt).toContain('tier1_intimate');
    expect(prompt).toContain('shared memories summary');
    expect(prompt).toContain('emotional bond summary');
  });
});
