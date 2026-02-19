/**
 * Compressor Unit Tests
 * Tests the memory compression functionality
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Compressor from '../../../src/modules/memory/Compressor.js';

// Mock the logger
vi.mock('../../../src/core/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock LLMClient
vi.mock('../../../src/core/llm/client.js', () => ({
  default: class MockLLMClient {
    constructor(model, options) {
      this.model = model;
      this.options = options;
    }

    async generate(prompt, options) {
      // Return mock responses based on prompt content
      // Check for V1 compression (contains keywords from COMPRESS_V1_PROMPT)
      if (prompt.includes('首次压缩') || prompt.includes('去除冗余') || prompt.includes('COMPRESS_V1') || prompt.includes('compressionRatio')) {
        return JSON.stringify({
          compressedContent: '压缩后的内容摘要',
          compressionRatio: 0.45,
          keyPoints: ['要点1', '要点2'],
          emotionalHighlights: [{ content: '情感亮点', emotion: '开心', intensity: 0.8 }],
          personalityAdjustment: {},
          originalLength: 1000,
          compressedLength: 450
        });
      }

      // Check for V2 compression
      if (prompt.includes('核心记忆') || prompt.includes('memoryTraces') || prompt.includes('coreMemory')) {
        return JSON.stringify({
          coreMemory: '这是一段核心记忆，约100-200字符',
          coreMemoryPoints: ['核心要点1', '核心要点2'],
          memoryTraces: {
            clear: ['清晰记忆1'],
            fuzzy: ['模糊记忆1'],
            vague: ['模糊痕迹1']
          },
          forgotten: {
            details: ['已遗忘的细节'],
            reason: '与性格特质关联度低'
          },
          emotionalResidue: {
            dominantEmotion: '愉快',
            intensity: 0.7,
            summary: '整体情绪积极'
          },
          personalityNotes: '与性格特质保持一致'
        });
      }

      // Default response for any other compression
      return JSON.stringify({
        compressedContent: '默认压缩内容',
        compressionRatio: 0.5,
        keyPoints: ['默认要点'],
        emotionalHighlights: [],
        personalityAdjustment: {},
        originalLength: 500,
        compressedLength: 250
      });
    }

    async healthCheck() {
      return true;
    }
  }
}));

describe('Compressor', () => {
  let compressor;

  beforeEach(() => {
    compressor = new Compressor();
  });

  describe('determineCompressionStage', () => {
    it('should return v1 for 3+ day raw memory', () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 4);

      const memory = {
        memoryId: 'mem_test123',
        meta: {
          createdAt: threeDaysAgo.toISOString(),
          compressionStage: 'raw'
        }
      };

      const result = compressor.determineCompressionStage(memory);

      expect(result).not.toBeNull();
      expect(result.needsCompression).toBe(true);
      expect(result.targetStage).toBe('v1');
    });

    it('should return v2 for 7+ day v1 memory', () => {
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

      const memory = {
        memoryId: 'mem_test123',
        meta: {
          createdAt: eightDaysAgo.toISOString(),
          compressionStage: 'v1'
        }
      };

      const result = compressor.determineCompressionStage(memory);

      expect(result).not.toBeNull();
      expect(result.needsCompression).toBe(true);
      expect(result.targetStage).toBe('v2');
    });

    it('should return null for memory younger than 3 days', () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const memory = {
        memoryId: 'mem_test123',
        meta: {
          createdAt: twoDaysAgo.toISOString(),
          compressionStage: 'raw'
        }
      };

      const result = compressor.determineCompressionStage(memory);

      expect(result).toBeNull();
    });

    it('should return null for already compressed v1 memory under 7 days', () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const memory = {
        memoryId: 'mem_test123',
        meta: {
          createdAt: fiveDaysAgo.toISOString(),
          compressionStage: 'v1',
          compressedAt: fiveDaysAgo.toISOString()
        }
      };

      const result = compressor.determineCompressionStage(memory);

      expect(result).toBeNull();
    });

    it('should return null for v2 memory (fully compressed)', () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      const memory = {
        memoryId: 'mem_test123',
        meta: {
          createdAt: tenDaysAgo.toISOString(),
          compressionStage: 'v2'
        }
      };

      const result = compressor.determineCompressionStage(memory);

      expect(result).toBeNull();
    });

    it('should return null for raw memory that already has compressedAt', () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const memory = {
        memoryId: 'mem_test123',
        meta: {
          createdAt: fiveDaysAgo.toISOString(),
          compressionStage: 'raw',
          compressedAt: new Date().toISOString() // Recently compressed
        }
      };

      const result = compressor.determineCompressionStage(memory);

      expect(result).toBeNull();
    });
  });

  describe('getDaysSinceCreation', () => {
    it('should calculate correct day count', () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const days = compressor.getDaysSinceCreation(threeDaysAgo);

      expect(days).toBe(3);
    });

    it('should handle date string input', () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const days = compressor.getDaysSinceCreation(fiveDaysAgo.toISOString());

      expect(days).toBe(5);
    });

    it('should return 0 for today', () => {
      const today = new Date();

      const days = compressor.getDaysSinceCreation(today);

      expect(days).toBe(0);
    });

    it('should handle future dates (edge case)', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const days = compressor.getDaysSinceCreation(tomorrow);

      expect(days).toBeLessThan(0);
    });
  });

  describe('formatMemoryForPrompt', () => {
    it('should format processed memory correctly', () => {
      const memory = {
        content: {
          processed: {
            summary: '对话摘要',
            keyTopics: ['话题1', '话题2'],
            facts: ['事实1', '事实2'],
            memorableMoments: [
              { content: '难忘时刻1', emotionTag: '开心' }
            ]
          }
        },
        pendingTopics: {
          topics: [{ topic: '待处理话题1' }]
        }
      };

      const result = compressor.formatMemoryForPrompt(memory);

      expect(result).toContain('【摘要】对话摘要');
      expect(result).toContain('【主要话题】话题1、话题2');
      expect(result).toContain('【事实信息】事实1；事实2');
      expect(result).toContain('【难忘时刻】');
      expect(result).toContain('【待处理话题】待处理话题1');
    });

    it('should format emotional journey', () => {
      const memory = {
        content: {
          processed: {
            emotionalJourney: {
              start: '平静',
              peak: '兴奋',
              end: '满足'
            }
          }
        }
      };

      const result = compressor.formatMemoryForPrompt(memory);

      expect(result).toContain('【情感变化】');
      expect(result).toContain('开始: 平静');
      expect(result).toContain('高潮: 兴奋');
      expect(result).toContain('结束: 满足');
    });

    it('should use raw content when no processed content', () => {
      const memory = {
        content: {
          raw: JSON.stringify([
            { content: '消息1', isOwner: true },
            { content: '消息2', isOwner: false }
          ])
        }
      };

      const result = compressor.formatMemoryForPrompt(memory);

      expect(result).toContain('【对话记录】');
    });

    it('should handle raw content that is not JSON', () => {
      const memory = {
        content: {
          raw: 'plain text content'
        }
      };

      const result = compressor.formatMemoryForPrompt(memory);

      expect(result).toContain('【原始内容】plain text content');
    });

    it('should return default for empty memory', () => {
      const memory = {};

      const result = compressor.formatMemoryForPrompt(memory);

      expect(result).toBe('无记忆内容');
    });

    it('should handle compressed memory format', () => {
      const memory = {
        compression: {
          compressedContent: '已压缩的内容'
        },
        content: {
          processed: {
            summary: '原始摘要'
          }
        }
      };

      const result = compressor.formatMemoryForPrompt(memory);

      expect(result).toContain('【摘要】原始摘要');
    });
  });

  describe('formatPersonality', () => {
    it('should extract personality from role card', () => {
      const roleCard = {
        coreLayer: {
          personality: { summary: '性格温和，乐观开朗' },
          communicationStyle: { summary: '善于倾听，表达清晰' },
          values: { keyPoints: ['诚实', '善良'] },
          interests: { keyPoints: ['阅读', '旅行'] },
          emotionalNeeds: { keyPoints: ['需要关爱', '渴望理解'] }
        }
      };

      const result = compressor.formatPersonality(roleCard);

      expect(result).toContain('【性格特质】性格温和，乐观开朗');
      expect(result).toContain('【沟通风格】善于倾听，表达清晰');
      expect(result).toContain('【价值观】诚实；善良');
      expect(result).toContain('【兴趣爱好】阅读；旅行');
      expect(result).toContain('【情感需求】需要关爱；渴望理解');
    });

    it('should use compressed version if summary not available', () => {
      const roleCard = {
        coreLayer: {
          personality: { compressed: '压缩的性格描述' },
          values: { compressed: '压缩的价值观' }
        }
      };

      const result = compressor.formatPersonality(roleCard);

      expect(result).toContain('【性格特质】压缩的性格描述');
      expect(result).toContain('【价值观】压缩的价值观');
    });

    it('should return default message for null role card', () => {
      const result = compressor.formatPersonality(null);

      expect(result).toBe('未提供人格特质信息');
    });

    it('should return default message for role card without coreLayer', () => {
      const result = compressor.formatPersonality({});

      expect(result).toBe('未提供人格特质信息');
    });

    it('should return default message for empty coreLayer', () => {
      const result = compressor.formatPersonality({ coreLayer: {} });

      expect(result).toBe('未提供人格特质信息');
    });
  });

  describe('compress', () => {
    it('should route to compressV1 for v1 target stage', async () => {
      // Use content that is definitely longer than 100 characters after formatting
      const memory = {
        memoryId: 'mem_test',
        meta: { createdAt: new Date().toISOString() },
        content: {
          processed: {
            summary: '这是一个足够长的对话摘要需要进行压缩处理压缩后的内容应该保留关键信息同时减少冗余内容这是一段测试文本用于验证压缩功能是否正常工作还需要更多内容来确保超过100字符的限制',
            keyTopics: ['话题一', '话题二', '话题三', '话题四', '话题五'],
            facts: ['事实信息一详细描述内容', '事实信息二详细描述内容', '事实信息三详细描述内容']
          }
        }
      };

      const result = await compressor.compress(memory, 'v1', null);

      // Should either complete compression or skip if content is too short
      if (result.skipped) {
        expect(result.reason).toBeDefined();
      } else {
        expect(result.compressionStage).toBe('v1');
        expect(result.compressedAt).toBeDefined();
      }
    });

    it('should route to compressV2 for v2 target stage', async () => {
      const memory = {
        memoryId: 'mem_test',
        meta: { createdAt: new Date().toISOString() },
        compression: {
          compressedContent: 'Already compressed v1 content that is long enough for further processing'
        }
      };

      const result = await compressor.compress(memory, 'v2', null);

      expect(result.compressionStage).toBe('v2');
    });

    it('should throw error for unknown stage', async () => {
      const memory = {
        memoryId: 'mem_test',
        content: { raw: 'test' }
      };

      await expect(compressor.compress(memory, 'v3', null)).rejects.toThrow('Unknown compression stage');
    });
  });

  describe('compressV1', () => {
    it('should return skipped for short content', async () => {
      const memory = {
        memoryId: 'mem_test',
        content: {
          processed: { summary: '短' }
        }
      };

      const result = await compressor.compressV1(memory, null);

      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('Memory too short');
    });

    it('should compress normal content', async () => {
      const memory = {
        memoryId: 'mem_test',
        meta: { createdAt: new Date().toISOString() },
        content: {
          processed: {
            summary: '这是一个足够长的对话摘要，需要进行压缩处理。' +
                     '压缩后的内容应该保留关键信息，同时减少冗余内容。' +
                     '这是一段测试文本，用于验证压缩功能是否正常工作。',
            keyTopics: ['话题1', '话题2', '话题3'],
            facts: ['事实信息1', '事实信息2']
          }
        }
      };

      const roleCard = {
        coreLayer: {
          personality: { summary: '温和开朗' }
        }
      };

      const result = await compressor.compressV1(memory, roleCard);

      expect(result.compressedContent).toBeDefined();
      expect(result.compressionRatio).toBeDefined();
      expect(result.compressionStage).toBe('v1');
      expect(result.keyPoints).toBeDefined();
    });
  });

  describe('compressV2', () => {
    it('should return skipped for short content', async () => {
      const memory = {
        memoryId: 'mem_test',
        compression: {
          compressedContent: '短'
        }
      };

      const result = await compressor.compressV2(memory, null);

      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('Memory content too short');
    });

    it('should use v1 compressed content if available', async () => {
      const memory = {
        memoryId: 'mem_test',
        compression: {
          compressedContent: '这是一段足够长的V1压缩内容，可以进行进一步的V2压缩处理。' +
                            'V2压缩会将内容进一步提炼为核心记忆，并生成记忆痕迹分类。' +
                            '这是测试用的长文本内容。'
        }
      };

      const roleCard = {
        coreLayer: {
          personality: { summary: '温和开朗' }
        }
      };

      const result = await compressor.compressV2(memory, roleCard);

      expect(result.coreMemory).toBeDefined();
      expect(result.coreMemoryPoints).toBeDefined();
      expect(result.memoryTraces).toBeDefined();
      expect(result.compressionStage).toBe('v2');
    });

    it('should fall back to processed content if no v1 compression', async () => {
      const memory = {
        memoryId: 'mem_test',
        content: {
          processed: {
            summary: '这是一段足够长的处理过的内容，可以进行V2压缩。' +
                     '即使没有经过V1压缩，也可以直接进行V2处理。' +
                     '这是测试用的长文本内容。'
          }
        }
      };

      const result = await compressor.compressV2(memory, null);

      expect(result.coreMemory).toBeDefined();
    });
  });

  describe('parseResponse', () => {
    it('should parse valid JSON response', () => {
      const response = '{"key": "value", "number": 123}';

      const result = compressor.parseResponse(response);

      expect(result.key).toBe('value');
      expect(result.number).toBe(123);
    });

    it('should extract JSON from thinking tags', () => {
      const response = '<think<this is thinking</think {"key": "value"}';

      const result = compressor.parseResponse(response);

      expect(result.key).toBe('value');
    });

    it('should extract JSON from mixed content', () => {
      const response = 'Some text before JSON {"compressed": true} some text after';

      const result = compressor.parseResponse(response);

      expect(result.compressed).toBe(true);
    });

    it('should throw error for empty response', () => {
      expect(() => compressor.parseResponse('')).toThrow('Empty LLM response');
    });

    it('should throw error for invalid JSON', () => {
      expect(() => compressor.parseResponse('not json at all')).toThrow();
    });
  });

  describe('healthCheck', () => {
    it('should return true when healthy', async () => {
      const result = await compressor.healthCheck();
      expect(result).toBe(true);
    });
  });
});
